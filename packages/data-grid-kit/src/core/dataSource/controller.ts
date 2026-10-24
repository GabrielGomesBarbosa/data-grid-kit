import type { FilterModel, RowId, SortItem } from '../types'
import { DataSourceError, type GetRowsParams, type GetRowsResponse, type DataSource } from './contract'
import { LruCache, type DataSourceCache } from './cache'
import { isAbort, sameShallow } from './util'

export interface DataSourceControllerOptions<R> {
  /** read on every request, so a new `dataSource` prop takes effect without recreating the controller */
  getSource: () => DataSource<R> | undefined
  getRowId: (row: R) => RowId
  /** rows per block: the unit of fetching, caching and loading. Default 100. */
  chunkSize?: number
  /** `null` = no cache */
  cache?: DataSourceCache<R> | null
  /** requests in flight at once (default 4) */
  maxConcurrent?: number
  /** consecutive blocks fetched with a single request, at most (default 4) */
  maxRunChunks?: number
  /** wait this long after the visible range stops moving before asking for blocks (default 60 ms; 0 for pages) */
  settleMs?: number
  /** a failed block is retried when it comes into view again after this long (default 3 s) */
  retryAfterMs?: number
  /** blocks fetched beyond the visible ones, each side (default 1) */
  prefetchChunks?: number
  /** blocks kept in memory; the farthest from the view are dropped (they stay in the cache). Default 400. */
  maxLoadedChunks?: number
  /** keep showing the old rows (instead of skeletons) while a new sort / filter loads */
  keepPreviousData?: boolean
  /** re-read the visible rows this often, in the background (0 / undefined = off) */
  revalidateMs?: number
  onError?: (error: DataSourceError) => void
  now?: () => number
}

interface Run {
  epoch: number
  chunks: number[]
  controller: AbortController
  background: boolean
}

export interface DataSourceSnapshot {
  /** rows in the data set, or -1 when the server hasn't said */
  rowCount: number
  hasNextPage: boolean
  /** a request for rows that are in view (or about to be) is waiting or running */
  loading: boolean
  error: DataSourceError | null
  chunkSize: number
  /** bumps on every change that can alter what is shown */
  version: number
  /** one past the last loaded row position */
  loadedEnd: number
}


/**
 * Keeps the rows a grid shows when they live on a server.
 *
 * Rows are stored by *position* in fixed-size blocks: only the blocks near the view exist, everything else
 * is a gap that the grid draws as a skeleton. Nothing is created per unloaded row, so a million-row data
 * set costs the same as a thousand-row one.
 *
 * Every sort / filter change (and `refresh`) starts a new *epoch*: requests of the old one are aborted and
 * whatever they return is cached but never shown.
 */
export class DataSourceController<R> {
  private o: Required<Pick<DataSourceControllerOptions<R>, 'chunkSize' | 'maxConcurrent' | 'maxRunChunks' | 'settleMs' | 'retryAfterMs' | 'prefetchChunks' | 'maxLoadedChunks'>> &
    DataSourceControllerOptions<R>
  private cache: DataSourceCache<R> | null
  private listeners = new Set<() => void>()
  private now: () => number

  private query = { sortModel: [] as SortItem[], filterModel: { items: [] } as FilterModel, key: '' }
  private epoch = 0
  private blocks = new Map<number, R[]>()
  /** shown instead of gaps while a new query / refresh is still loading (keepPreviousData, refresh) */
  private previous: Map<number, R[]> | null = null
  private idIndex = new Map<RowId, number>()
  private rowCount = -1
  private hasNextPage = true
  private view: { start: number; end: number } | null = null
  private queue: number[] = []
  private runs = new Set<Run>()
  private pending = new Map<number, Run>()
  private failed = new Map<number, number>()
  private error: DataSourceError | null = null
  private version = 0
  private pumpTimer: ReturnType<typeof setTimeout> | undefined
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private pollTimer: ReturnType<typeof setInterval> | undefined
  private snapshotCache: DataSourceSnapshot | null = null
  /** nothing runs (no requests, no timers) until `resume()`: constructing one during render must be harmless */
  private destroyed = true
  /** something visible changed since the last notification */
  private dirty = false

  constructor(options: DataSourceControllerOptions<R>) {
    this.o = {
      chunkSize: 100,
      maxConcurrent: 4,
      maxRunChunks: 4,
      settleMs: 60,
      retryAfterMs: 3000,
      prefetchChunks: 1,
      maxLoadedChunks: 400,
      ...options,
    }
    this.now = options.now ?? Date.now
    this.cache = options.cache === null ? null : (options.cache ?? new LruCache<R>({ now: this.now }))
    this.query.key = this.queryKey()
  }

  /* ---------------------------------------------------------------- subscribe */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }
  getVersion = () => this.version

  private changed() {
    this.version++
    this.snapshotCache = null
    for (const l of this.listeners) l()
  }

  /* ------------------------------------------------------------------ reading */

  get chunkSize() {
    return this.o.chunkSize
  }

  snapshot(): DataSourceSnapshot {
    if (this.snapshotCache) return this.snapshotCache
    let loadedEnd = 0
    for (const [c, rows] of this.blocks) loadedEnd = Math.max(loadedEnd, c * this.o.chunkSize + rows.length)
    this.snapshotCache = {
      rowCount: this.rowCount,
      hasNextPage: this.hasNextPage,
      loading: this.isLoading(),
      error: this.error,
      chunkSize: this.o.chunkSize,
      version: this.version,
      loadedEnd,
    }
    return this.snapshotCache
  }

  /** the row at a position: loaded, or (while something newer loads) the one shown before */
  rowAt(pos: number): R | undefined {
    const cs = this.o.chunkSize
    const c = Math.floor(pos / cs)
    const i = pos - c * cs
    return this.blocks.get(c)?.[i] ?? this.previous?.get(c)?.[i]
  }

  indexOfId(id: RowId): number {
    return this.idIndex.get(id) ?? -1
  }

  /** every loaded row, in position order */
  loadedRows(): { pos: number; row: R }[] {
    const out: { pos: number; row: R }[] = []
    const cs = this.o.chunkSize
    const chunks = [...(this.blocks.size ? this.blocks : (this.previous ?? this.blocks)).keys()].sort((a, b) => a - b)
    for (const c of chunks) {
      const rows = this.blocks.get(c) ?? this.previous?.get(c)
      rows?.forEach((row, i) => out.push({ pos: c * cs + i, row }))
    }
    return out
  }

  private isLoading(): boolean {
    if (!this.view) return false
    const want = this.wantedWindow(false)
    for (const run of this.runs) if (!run.background && run.chunks.some((c) => c >= want.first && c <= want.last)) return true
    return this.queue.some((c) => c >= want.first && c <= want.last)
  }

  /* ----------------------------------------------------------------- settings */

  /** Change what is asked for. A different sort / filter starts over. */
  setQuery(sortModel: SortItem[], filterModel: FilterModel) {
    const key = JSON.stringify([filterModel, sortModel])
    if (key === this.query.key) return
    this.query = { sortModel, filterModel, key }
    this.reset(this.o.keepPreviousData === true, true)
  }

  setChunkSize(size: number) {
    const next = Math.max(1, Math.floor(size))
    if (next === this.o.chunkSize) return
    this.o.chunkSize = next
    this.reset(false, true)
  }

  /** Rows per block, concurrency, etc. can follow the props; chunk size has its own setter. */
  configure(patch: Partial<DataSourceControllerOptions<R>>) {
    const { chunkSize, cache, revalidateMs, ...rest } = patch
    Object.assign(this.o, rest)
    if (chunkSize !== undefined) this.setChunkSize(chunkSize)
    if (cache !== undefined && cache !== this.cache) this.cache = cache
    if (revalidateMs !== this.o.revalidateMs && 'revalidateMs' in patch) {
      this.o.revalidateMs = revalidateMs
      this.startPolling()
    }
  }

  /** The rows wanted now: [start, end], both positions. Fetches whatever blocks are missing. */
  setView(start: number, end: number, immediate = false) {
    const same = this.view && this.view.start === start && this.view.end === end
    this.view = { start: Math.max(0, start), end: Math.max(start, end) }
    if (same) return
    this.plan(immediate)
  }

  /** Throw everything away and fetch again. The visible rows stay on screen until their replacements arrive. */
  refresh() {
    this.cache?.clear()
    this.reset(true, true)
  }

  /* -------------------------------------------------------------------- edits */

  /** Replace rows (by id) in the loaded blocks and in the cache. Returns how many were found. */
  replaceRows(rows: R[]): number {
    const cs = this.o.chunkSize
    const touched = new Set<number>()
    let found = 0
    for (const row of rows) {
      const pos = this.idIndex.get(this.o.getRowId(row))
      if (pos === undefined) continue
      const c = Math.floor(pos / cs)
      const block = this.blocks.get(c)
      if (!block) continue
      block[pos - c * cs] = row
      touched.add(c)
      found++
    }
    for (const c of touched) this.cacheBlock(c, this.blocks.get(c)!, undefined)
    if (found) this.changed()
    return found
  }

  /* ---------------------------------------------------------------- internals */

  private queryKey() {
    return JSON.stringify([this.query.filterModel, this.query.sortModel])
  }

  private reset(keepShown: boolean, abort: boolean) {
    this.epoch++
    if (abort) for (const run of this.runs) run.controller.abort()
    this.runs.clear()
    this.pending.clear()
    this.queue = []
    this.failed.clear()
    this.error = null
    this.previous = keepShown ? (this.blocks.size ? this.blocks : this.previous) : null
    this.blocks = new Map()
    // rows still on screen (kept from before) keep their ids findable until they are replaced
    if (!this.previous) this.idIndex = new Map()
    this.rowCount = -1
    this.hasNextPage = true
    this.changed()
    if (this.view && !this.destroyed) this.plan(true)
  }

  /** the blocks around the view that should exist */
  private wantedWindow(withPrefetch: boolean) {
    const cs = this.o.chunkSize
    const v = this.view ?? { start: 0, end: 0 }
    const pre = withPrefetch ? this.o.prefetchChunks : 0
    let first = Math.max(0, Math.floor(v.start / cs) - pre)
    let last = Math.floor(v.end / cs) + pre
    if (this.rowCount >= 0) last = Math.min(last, Math.max(0, Math.ceil(this.rowCount / cs) - 1))
    if (this.rowCount === 0) last = -1
    first = Math.min(first, last + 1)
    return { first, last }
  }

  private plan(immediate: boolean) {
    const wasLoading = this.isLoading()
    const { first, last } = this.wantedWindow(true)
    const wanted = new Set<number>()
    for (let c = first; c <= last; c++) wanted.add(c)

    // what scrolled away is no longer worth asking for
    this.queue = this.queue.filter((c) => wanted.has(c))

    const center = this.view ? (this.view.start + this.view.end) / 2 / this.o.chunkSize : 0
    const add: number[] = []
    let installed = false
    for (let c = first; c <= last; c++) {
      if (this.blocks.has(c) || this.pending.has(c) || this.queue.includes(c)) continue
      const failedAt = this.failed.get(c)
      if (failedAt !== undefined && this.now() - failedAt < this.o.retryAfterMs) continue
      const hit = this.fromCache(c)
      if (hit) {
        installed = true
        continue
      }
      add.push(c)
    }
    this.queue.push(...add)
    this.queue.sort((a, b) => Math.abs(a - center) - Math.abs(b - center))
    this.evictFar(wanted)
    if (installed || this.isLoading() !== wasLoading) this.changed()
    this.scheduleRetry()
    this.schedulePump(immediate || this.o.settleMs <= 0)
  }

  private fromCache(c: number): boolean {
    if (!this.cache) return false
    const cs = this.o.chunkSize
    const hit = this.cache.get({ sortModel: this.query.sortModel, filterModel: this.query.filterModel, start: c * cs, end: c * cs + cs - 1 })
    if (!hit) return false
    this.install(c, hit.rows, hit.rowCount, hit.pageInfo, cs)
    return true
  }

  private evictFar(wanted: Set<number>) {
    if (this.blocks.size <= this.o.maxLoadedChunks) return
    const center = this.view ? (this.view.start + this.view.end) / 2 / this.o.chunkSize : 0
    const far = [...this.blocks.keys()].filter((c) => !wanted.has(c)).sort((a, b) => Math.abs(b - center) - Math.abs(a - center))
    for (const c of far) {
      if (this.blocks.size <= this.o.maxLoadedChunks) break
      this.dropBlock(c)
    }
  }

  private dropBlock(c: number) {
    const cs = this.o.chunkSize
    const rows = this.blocks.get(c)
    if (!rows) return
    rows.forEach((row, i) => {
      const id = this.o.getRowId(row)
      if (this.idIndex.get(id) === c * cs + i) this.idIndex.delete(id)
    })
    this.blocks.delete(c)
  }

  private schedulePump(immediate: boolean) {
    if (this.pumpTimer !== undefined) {
      if (!immediate) return // a pump is already due; the queue is re-checked when it runs
      clearTimeout(this.pumpTimer)
    }
    if (immediate) {
      this.pumpTimer = undefined
      queueMicrotask(() => this.pump())
      return
    }
    this.pumpTimer = setTimeout(() => {
      this.pumpTimer = undefined
      this.pump()
    }, this.o.settleMs)
  }

  private scheduleRetry() {
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer)
    this.retryTimer = undefined
    if (!this.failed.size || !this.view) return
    const { first, last } = this.wantedWindow(true)
    let soonest = Infinity
    for (const [c, t] of this.failed) if (c >= first && c <= last) soonest = Math.min(soonest, t + this.o.retryAfterMs - this.now())
    if (soonest === Infinity) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined
      if (this.view) this.plan(true)
    }, Math.max(0, soonest) + 1)
  }

  private pump() {
    if (this.destroyed) return
    // the queue may be stale by now: drop what is no longer around the view
    const { first, last } = this.wantedWindow(true)
    this.queue = this.queue.filter((c) => c >= first && c <= last && !this.blocks.has(c) && !this.pending.has(c))
    while (this.runs.size < this.o.maxConcurrent && this.queue.length) {
      const head = this.queue.shift()!
      const chunks = [head]
      // join the blocks right next to it into one request
      for (let grow = true; grow && chunks.length < this.o.maxRunChunks; ) {
        grow = false
        const lo = Math.min(...chunks) - 1
        const hi = Math.max(...chunks) + 1
        for (const next of [hi, lo]) {
          const at = this.queue.indexOf(next)
          if (at >= 0 && chunks.length < this.o.maxRunChunks) {
            this.queue.splice(at, 1)
            chunks.push(next)
            grow = true
          }
        }
      }
      this.start(chunks.sort((a, b) => a - b), false)
    }
    if (this.runs.size || this.queue.length) this.changed()
  }

  private start(chunks: number[], background: boolean) {
    const source = this.o.getSource()
    if (!source) return
    const cs = this.o.chunkSize
    const run: Run = { epoch: this.epoch, chunks, controller: new AbortController(), background }
    this.runs.add(run)
    for (const c of chunks) this.pending.set(c, run)
    const params: GetRowsParams = {
      start: chunks[0]! * cs,
      end: chunks[chunks.length - 1]! * cs + cs - 1,
      sortModel: this.query.sortModel,
      filterModel: this.query.filterModel,
      signal: run.controller.signal,
    }
    if (this.rowCount >= 0) params.end = Math.min(params.end, Math.max(params.start, this.rowCount - 1))
    const query = { sortModel: this.query.sortModel, filterModel: this.query.filterModel }
    let request: Promise<GetRowsResponse<R>>
    try {
      request = Promise.resolve(source.getRows(params))
    } catch (err) {
      request = Promise.reject(err) // a getRows that throws before returning is an ordinary failed request
    }
    request.then(
      (res) => this.onResponse(run, params, query, res),
      (err) => this.onFailure(run, params, err),
    )
  }

  private finish(run: Run) {
    this.runs.delete(run)
    for (const c of run.chunks) if (this.pending.get(c) === run) this.pending.delete(c)
  }

  private onResponse(run: Run, params: GetRowsParams, query: { sortModel: SortItem[]; filterModel: FilterModel }, res: GetRowsResponse<R>) {
    this.finish(run)
    if (this.destroyed) return
    const cs = this.o.chunkSize
    const rows = Array.isArray(res?.rows) ? res.rows : []
    const wanted = params.end - params.start + 1
    const stale = run.epoch !== this.epoch || run.controller.signal.aborted

    // cache what came back, even if it is too late to show it: the same query may be asked again
    const chunks = run.chunks
    const ended = rows.length < wanted
    if (this.cache) {
      for (const c of chunks) {
        const slice = rows.slice(c * cs - params.start, c * cs - params.start + cs)
        if (!slice.length && !ended) continue
        this.cache.set(
          { sortModel: query.sortModel, filterModel: query.filterModel, start: c * cs, end: c * cs + cs - 1 },
          { rows: slice, rowCount: res.rowCount, pageInfo: ended || c === chunks[chunks.length - 1] ? res.pageInfo : { hasNextPage: true } },
        )
      }
    }
    if (stale) {
      this.afterRun(true)
      return
    }

    this.dirty = false
    for (const c of chunks) {
      this.failed.delete(c)
      const slice = rows.slice(c * cs - params.start, c * cs - params.start + cs)
      if (!slice.length && !ended) continue
      this.install(c, slice, res.rowCount, c === chunks[chunks.length - 1] || ended ? res.pageInfo : undefined, cs)
    }
    if (this.failed.size === 0) this.error = null // another block may still be failing: keep reporting it
    // a short answer with no row count is the end of the data
    if (ended && (res.rowCount === undefined || res.rowCount < 0)) {
      if (this.rowCount !== params.start + rows.length || this.hasNextPage) this.dirty = true
      this.rowCount = params.start + rows.length
      this.hasNextPage = false
    }
    this.afterRun(run.background)
  }

  private onFailure(run: Run, params: GetRowsParams, err: unknown) {
    this.finish(run)
    if (this.destroyed || isAbort(err) || run.controller.signal.aborted || run.epoch !== this.epoch) {
      this.afterRun()
      return
    }
    for (const c of run.chunks) this.failed.set(c, this.now())
    const error = new DataSourceError('getRows', params, err)
    this.error = error
    this.o.onError?.(error)
    this.scheduleRetry()
    this.afterRun()
  }

  private afterRun(quiet = false) {
    const hadPrevious = this.previous !== null
    if (this.previous && this.coveredNow()) {
      this.previous = null
      this.rebuildIndex() // the old rows are gone: forget their ids
    }
    // a background re-read that changed nothing stays silent: no re-render at every poll
    if (!quiet || this.dirty || hadPrevious !== (this.previous !== null)) this.changed()
    this.dirty = false
    if (this.queue.length) this.schedulePump(true)
  }

  /** the new epoch has loaded (or failed) everything in view: the old rows can go */
  private coveredNow(): boolean {
    const { first, last } = this.wantedWindow(false)
    for (let c = first; c <= last; c++) if (!this.blocks.has(c) && !this.failed.has(c)) return false
    return true
  }

  private install(c: number, rows: R[], rowCount: number | undefined, pageInfo: { hasNextPage?: boolean } | undefined, cs: number) {
    const old = this.blocks.get(c)
    // keep the objects of rows that didn't change, so memoised rows don't re-render after a background refresh
    const next = old ? rows.map((row, i) => (old[i] !== undefined && sameShallow(old[i], row) ? old[i]! : row)) : rows.slice()
    const unchanged = old !== undefined && old.length === next.length && next.every((row, i) => row === old[i])
    this.blocks.set(c, next)
    next.forEach((row, i) => this.idIndex.set(this.o.getRowId(row), c * cs + i))
    if (unchanged && rowCount === this.rowCount) return // a background re-read that found nothing new
    if (rowCount !== undefined) this.rowCount = rowCount
    // only meaningful while the row count is unknown; installing blocks out of order must not flip it
    if (pageInfo?.hasNextPage !== undefined) this.hasNextPage = pageInfo.hasNextPage
    this.dirty = true
  }

  private rebuildIndex() {
    const cs = this.o.chunkSize
    const index = new Map<RowId, number>()
    for (const [c, rows] of this.blocks) rows.forEach((row, i) => index.set(this.o.getRowId(row), c * cs + i))
    this.idIndex = index
  }

  private cacheBlock(c: number, rows: R[], pageInfo: { hasNextPage?: boolean } | undefined) {
    if (!this.cache) return
    const cs = this.o.chunkSize
    this.cache.set(
      { sortModel: this.query.sortModel, filterModel: this.query.filterModel, start: c * cs, end: c * cs + cs - 1 },
      { rows: rows.slice(), rowCount: this.rowCount >= 0 ? this.rowCount : undefined, pageInfo },
    )
  }

  /* ---------------------------------------------------------------- polling */

  private startPolling() {
    if (this.pollTimer !== undefined) clearInterval(this.pollTimer)
    this.pollTimer = undefined
    const ms = this.o.revalidateMs
    if (!ms || ms <= 0 || this.destroyed) return
    this.pollTimer = setInterval(() => this.revalidate(), ms)
  }

  /** Read the rows in view again, quietly: no loading state, no skeletons, changed rows only. */
  revalidate() {
    if (this.destroyed || !this.view || !this.o.getSource()) return
    const { first, last } = this.wantedWindow(false)
    const loaded: number[] = []
    for (let c = first; c <= last; c++) if (this.blocks.has(c) && !this.pending.has(c)) loaded.push(c)
    for (let i = 0; i < loaded.length; ) {
      let j = i
      while (j + 1 < loaded.length && loaded[j + 1] === loaded[j]! + 1 && j - i + 1 < this.o.maxRunChunks) j++
      if (this.runs.size < this.o.maxConcurrent) this.start(loaded.slice(i, j + 1), true)
      i = j + 1
    }
  }

  /* ----------------------------------------------------------------- teardown */

  destroy() {
    this.destroyed = true
    for (const run of this.runs) run.controller.abort()
    this.runs.clear()
    this.pending.clear()
    clearTimeout(this.pumpTimer)
    clearTimeout(this.retryTimer)
    if (this.pollTimer !== undefined) clearInterval(this.pollTimer)
    this.listeners.clear()
  }

  /**
   * Start working: begin requesting and polling. Also undoes `destroy()`: React may unmount and mount an effect
   * again (StrictMode, Suspense), and the same controller must keep working.
   */
  resume() {
    if (!this.destroyed) return
    this.destroyed = false
    this.startPolling()
    if (this.view) this.plan(true)
  }

  /** Visit every row that can be shown: the loaded ones, and the kept-from-before ones for blocks not yet replaced. */
  forEachLoaded(visit: (pos: number, row: R) => void, ordered = false) {
    const cs = this.o.chunkSize
    const chunks: number[] = []
    if (this.previous) for (const c of this.previous.keys()) if (!this.blocks.has(c)) chunks.push(c)
    for (const c of this.blocks.keys()) chunks.push(c)
    if (ordered) chunks.sort((a, b) => a - b)
    for (const c of chunks) (this.blocks.get(c) ?? this.previous?.get(c))!.forEach((row, i) => visit(c * cs + i, row))
  }

  /** for tests and the docs' request log */
  get stats() {
    return { epoch: this.epoch, inFlight: this.runs.size, queued: this.queue.length, loadedChunks: this.blocks.size, failedChunks: this.failed.size }
  }
}
