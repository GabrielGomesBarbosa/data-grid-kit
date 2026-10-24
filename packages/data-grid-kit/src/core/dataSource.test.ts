import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DataSourceController,
  DataSourceError,
  LruCache,
  type DataSource,
  type DataSourceControllerOptions,
  type GetRowsParams,
  type GetRowsResponse,
} from './dataSource'
import type { FilterModel, SortItem } from './types'

interface Row {
  id: number
  /** the query this row was produced for: proves a row on screen belongs to the current sort / filter */
  q: string
  v: number
}

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

const tagOf = (sort: SortItem[], filter: FilterModel) => JSON.stringify([sort, filter.quickFilter ?? ''])

interface Call {
  params: GetRowsParams
  /** answer with the real rows for the range */
  resolve(over?: Partial<GetRowsResponse<Row>>): void
  reject(error?: unknown): void
  settled: boolean
}

/** A server that answers only when told to, so tests control the order in which responses arrive. */
function makeServer(total: number | ((filter: FilterModel) => number) = 1000, withCount = true, ignoreAbort = false) {
  const calls: Call[] = []
  const totalOf = (f: FilterModel) => (typeof total === 'function' ? total(f) : total)
  const build = (p: GetRowsParams): GetRowsResponse<Row> => {
    const n = totalOf(p.filterModel)
    const q = tagOf(p.sortModel, p.filterModel)
    const desc = p.sortModel[0]?.direction === 'desc'
    const rows: Row[] = []
    for (let pos = p.start; pos <= p.end && pos < n; pos++) rows.push({ id: desc ? n - pos : pos + 1, q, v: 0 })
    return withCount ? { rows, rowCount: n } : { rows }
  }
  const source: DataSource<Row> = {
    getRows(params) {
      return new Promise((resolve, reject) => {
        const call: Call = {
          params,
          settled: false,
          resolve: (over) => {
            call.settled = true
            resolve({ ...build(params), ...over })
          },
          reject: (e) => {
            call.settled = true
            reject(e ?? new Error('boom'))
          },
        }
        // a polite server stops when told to; a rude one (ignoreAbort) answers anyway, whenever it likes
        if (!ignoreAbort) {
          params.signal.addEventListener('abort', () => {
            if (call.settled) return
            call.settled = true
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }
        calls.push(call)
      })
    },
  }
  return { source, calls, build, open: () => calls.filter((c) => !c.settled) }
}

const make = (server: ReturnType<typeof makeServer>, over: Partial<DataSourceControllerOptions<Row>> = {}) => {
  const c = new DataSourceController<Row>({
    getSource: () => server.source,
    getRowId: (r) => r.id,
    chunkSize: 10,
    settleMs: 0,
    prefetchChunks: 0,
    ...over,
  })
  c.resume()
  return c
}

const asc: SortItem[] = [{ field: 'v', direction: 'asc' }]
const desc: SortItem[] = [{ field: 'v', direction: 'desc' }]
const none: FilterModel = { items: [] }
const ids = (c: DataSourceController<Row>, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => c.rowAt(from + i)?.id)

afterEach(() => vi.useRealTimers())

describe('lifecycle', () => {
  it('does nothing until resume(), then catches up; destroy() stops and resume() restarts', async () => {
    const s = makeServer()
    const c = new DataSourceController<Row>({ getSource: () => s.source, getRowId: (r) => r.id, chunkSize: 10, settleMs: 0, prefetchChunks: 0 })
    c.setView(0, 9)
    await flush()
    expect(s.calls).toHaveLength(0) // constructing and configuring one (as a render would) starts nothing
    c.resume()
    await flush()
    expect(s.calls).toHaveLength(1)
    c.destroy()
    expect(s.calls[0]!.params.signal.aborted).toBe(true)
    c.resume() // StrictMode: unmount then mount again
    await flush()
    expect(s.calls).toHaveLength(2)
    s.calls[1]!.resolve()
    await flush()
    expect(c.rowAt(0)?.id).toBe(1)
  })
})

describe('requests', () => {
  it('asks for the blocks in view as one aligned request, with the query and a signal', async () => {
    const s = makeServer(1000)
    const c = make(s)
    c.setQuery(asc, { items: [], quickFilter: 'x' })
    c.setView(5, 24)
    await flush()
    expect(s.calls).toHaveLength(1)
    const p = s.calls[0]!.params
    expect([p.start, p.end]).toEqual([0, 29]) // blocks 0-2 of 10, inclusive end
    expect(p.sortModel).toEqual(asc)
    expect(p.filterModel.quickFilter).toBe('x')
    expect(p.signal).toBeInstanceOf(AbortSignal)
    s.calls[0]!.resolve()
    await flush()
    expect(ids(c, 0, 4)).toEqual([1, 2, 3, 4, 5])
    expect(c.snapshot().rowCount).toBe(1000)
    expect(c.snapshot().loading).toBe(false)
  })

  it('reports loading while the visible blocks are on their way', async () => {
    const s = makeServer()
    const c = make(s)
    c.setView(0, 9)
    expect(c.snapshot().loading).toBe(true)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    expect(c.snapshot().loading).toBe(false)
  })

  it('does not ask for blocks beyond the known row count', async () => {
    const s = makeServer(25)
    const c = make(s)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.setView(0, 500) // far past the end
    await flush()
    expect(s.calls.every((x) => x.params.start < 25)).toBe(true)
    expect(s.calls.at(-1)!.params.end).toBeLessThanOrEqual(24)
  })

  it('coalesces a burst of view changes into requests for where the view ended up', async () => {
    vi.useFakeTimers()
    const s = makeServer()
    const c = make(s, { settleMs: 50 })
    for (let pos = 0; pos < 900; pos += 30) c.setView(pos, pos + 20)
    await vi.advanceTimersByTimeAsync(60)
    expect(s.calls.length).toBeGreaterThan(0)
    expect(s.calls.every((x) => x.params.start >= 840)).toBe(true) // nothing for the places scrolled past
  })

  it('joins neighbouring blocks into one request, capped by maxRunChunks', async () => {
    const s = makeServer()
    const c = make(s, { maxRunChunks: 3 })
    c.setView(0, 69) // 7 blocks
    await flush()
    // requests go out nearest-the-view first, so compare them by position
    const runs = s.calls.map((x) => [x.params.start, x.params.end] as const).sort((a, b) => a[0] - b[0])
    expect(runs.every(([a, b]) => b - a + 1 <= 30)).toBe(true) // never more than 3 blocks of 10
    expect(runs.length).toBeLessThanOrEqual(3)
    expect(runs[0]![0]).toBe(0)
    expect(runs.at(-1)![1]).toBe(69)
    for (let i = 1; i < runs.length; i++) expect(runs[i]![0]).toBe(runs[i - 1]![1] + 1) // no gap, no overlap
  })
})

describe('cache', () => {
  it('serves what it has without a request, and fetches only what is missing', async () => {
    const s = makeServer()
    const c = make(s)
    c.setView(0, 19)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    expect(s.calls).toHaveLength(1)
    c.setView(10, 39) // blocks 1 (have), 2-3 (missing)
    await flush()
    expect(s.calls).toHaveLength(2)
    expect([s.calls[1]!.params.start, s.calls[1]!.params.end]).toEqual([20, 39])
  })

  it('answers a query it has seen before from the cache, after the grid moved on', async () => {
    const s = makeServer()
    const cache = new LruCache<Row>()
    const c = make(s, { cache })
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.setQuery(desc, none)
    await flush()
    s.open()[0]!.resolve()
    await flush()
    const before = s.calls.length
    c.setQuery(asc, none) // back to the first query
    await flush()
    expect(s.calls.length).toBe(before) // no request: the block came from the cache
    expect(ids(c, 0, 2)).toEqual([1, 2, 3])
  })

  it('caches the answer of a request that was aborted before it came back, but never shows it', async () => {
    const s = makeServer(1000, true, true)
    const c = make(s)
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    const old = s.calls[0]!
    c.setQuery(desc, none) // the first request is now useless
    await flush()
    expect(old.params.signal.aborted).toBe(true)
    // a server that ignores the abort and answers anyway
    old.resolve()
    await flush()
    expect(c.rowAt(0)).toBeUndefined() // not shown: it belongs to the old query
    // ...but it was cached: asking for that query again needs no request
    const before = s.calls.length
    c.setQuery(asc, none)
    await flush()
    expect(s.calls.length).toBe(before)
    expect(c.rowAt(0)?.q).toBe(tagOf(asc, none))
  })

  it('works with no cache at all', async () => {
    const s = makeServer()
    const c = make(s, { cache: null })
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.setView(100, 109)
    await flush()
    s.open()[0]!.resolve()
    await flush()
    c.setView(0, 9)
    await flush()
    expect(s.calls).toHaveLength(2) // block 0 is still held in memory, so no request even without a cache
    expect(c.rowAt(0)?.id).toBe(1)
    c.refresh() // but a refresh has nothing to fall back on
    await flush()
    expect(s.calls).toHaveLength(3)
  })

  it('LruCache: bounded size, least recently used out first, entries expire', () => {
    let t = 0
    const cache = new LruCache<Row>({ maxEntries: 2, ttl: 100, now: () => t })
    const key = (n: number) => ({ sortModel: [], filterModel: none, start: n, end: n })
    const val = (n: number) => ({ rows: [{ id: n, q: '', v: 0 }] })
    cache.set(key(1), val(1))
    cache.set(key(2), val(2))
    cache.get(key(1)) // 1 is now more recent than 2
    cache.set(key(3), val(3)) // evicts 2
    expect(cache.get(key(2))).toBeUndefined()
    expect(cache.get(key(1))).toBeDefined()
    expect(cache.size).toBe(2)
    t = 101
    expect(cache.get(key(1))).toBeUndefined() // expired
    expect(cache.size).toBe(1)
  })
})

describe('changing the query', () => {
  it('aborts what is in flight and starts over', async () => {
    const s = makeServer()
    const c = make(s)
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    const first = s.calls[0]!
    c.setQuery(desc, none)
    await flush()
    expect(first.params.signal.aborted).toBe(true)
    expect(c.stats.inFlight).toBe(1)
    s.open()[0]!.resolve()
    await flush()
    expect(ids(c, 0, 2)).toEqual([1000, 999, 998])
  })

  it('a late answer of the old query never replaces rows of the new one', async () => {
    const s = makeServer(1000, true, true)
    const c = make(s)
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    const old = s.calls[0]!
    c.setQuery(desc, none)
    await flush()
    const fresh = s.calls.at(-1)! // a rude server leaves the old call open too
    expect(fresh).not.toBe(old)
    fresh.resolve()
    await flush()
    old.resolve() // arrives after the new one
    await flush()
    expect(c.rowAt(0)?.q).toBe(tagOf(desc, none))
  })

  it('keepPreviousData shows the old rows until the new ones arrive', async () => {
    const s = makeServer()
    const c = make(s, { keepPreviousData: true })
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.setQuery(desc, none)
    expect(c.rowAt(0)?.id).toBe(1) // still the old ones
    await flush()
    s.open()[0]!.resolve()
    await flush()
    expect(c.rowAt(0)?.id).toBe(1000) // replaced
  })

  it('without keepPreviousData the rows are gone immediately', async () => {
    const s = makeServer()
    const c = make(s)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.setQuery(desc, none)
    expect(c.rowAt(0)).toBeUndefined()
  })

  it('the same query again is a no-op', async () => {
    const s = makeServer()
    const c = make(s)
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    const n = s.calls.length
    c.setQuery([...asc], { items: [] })
    await flush()
    expect(s.calls.length).toBe(n)
  })
})

describe('row count and the end of the data', () => {
  it('a short answer with no row count is the end of the data', async () => {
    const s = makeServer(25, false)
    const c = make(s)
    c.setView(0, 29)
    await flush()
    expect(c.snapshot().rowCount).toBe(-1)
    s.calls[0]!.resolve()
    await flush()
    expect(c.snapshot().rowCount).toBe(25)
    expect(c.snapshot().hasNextPage).toBe(false)
    expect(c.rowAt(24)?.id).toBe(25)
    expect(c.rowAt(25)).toBeUndefined()
  })

  it('a full answer with no count keeps going; pageInfo.hasNextPage ends it', async () => {
    const s = makeServer(1000, false)
    const c = make(s)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    expect(c.snapshot().rowCount).toBe(-1)
    expect(c.snapshot().hasNextPage).toBe(true)
    c.setView(10, 19)
    await flush()
    s.open()[0]!.resolve({ pageInfo: { hasNextPage: false } })
    await flush()
    expect(c.snapshot().hasNextPage).toBe(false)
  })

  it('a row count of -1 means unknown, an empty data set is a count of 0', async () => {
    const s = makeServer(0)
    const c = make(s)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    expect(c.snapshot().rowCount).toBe(0)
    const n = s.calls.length
    c.setView(0, 99)
    await flush()
    expect(s.calls.length).toBe(n) // nothing to ask for
  })

  it('blocks that arrive out of order do not corrupt hasNextPage', async () => {
    const s = makeServer(100)
    const c = make(s, { maxRunChunks: 1 })
    c.setView(0, 99)
    await flush()
    const open = s.open()
    expect(open.length).toBe(4) // maxConcurrent
    // answer the last ones first, then the first ones
    for (const call of [...open].reverse()) call.resolve()
    await flush()
    for (let guard = 0; guard < 10 && s.open().length; guard++) {
      s.open().forEach((x) => x.resolve())
      await flush()
    }
    expect(c.snapshot().rowCount).toBe(100)
    expect(ids(c, 95, 99)).toEqual([96, 97, 98, 99, 100])
  })
})

describe('concurrency and scrolling away', () => {
  it('never has more than maxConcurrent requests open and drains the queue as they finish', async () => {
    const s = makeServer()
    const c = make(s, { maxConcurrent: 2, maxRunChunks: 1 })
    c.setView(0, 59)
    await flush()
    expect(s.open()).toHaveLength(2)
    s.open()[0]!.resolve()
    await flush()
    expect(s.open()).toHaveLength(2)
    expect(c.stats.inFlight).toBeLessThanOrEqual(2)
  })

  it('does not start queued requests for places the view has left', async () => {
    const s = makeServer()
    const c = make(s, { maxConcurrent: 1, maxRunChunks: 1 })
    c.setView(0, 39) // blocks 0-3: one request open, three queued
    await flush()
    expect(s.open()).toHaveLength(1)
    c.setView(500, 509) // scrolled far away
    await flush()
    s.open()[0]!.resolve() // the first one finishes
    await flush()
    const starts = s.calls.map((x) => x.params.start)
    // block 2 was the one in flight when the view moved; blocks 0, 1 and 3 were still queued and must be gone
    expect(starts.filter((x) => x < 40)).toEqual([20])
    expect(starts).toContain(500)
  })

  it('asks for the blocks nearest the view first', async () => {
    const s = makeServer()
    const c = make(s, { maxConcurrent: 1, maxRunChunks: 1, prefetchChunks: 2 })
    c.setView(50, 59) // block 5, with 3-4 and 6-7 around it
    await flush()
    expect(s.calls[0]!.params.start).toBe(50)
  })

  it('drops the farthest blocks past maxLoadedChunks, and gets them back from the cache', async () => {
    const s = makeServer()
    const c = make(s, { maxLoadedChunks: 3, maxRunChunks: 1 })
    for (let b = 0; b < 8; b++) {
      c.setView(b * 10, b * 10 + 9)
      await flush()
      s.open().forEach((x) => x.resolve())
      await flush()
    }
    expect(c.stats.loadedChunks).toBeLessThanOrEqual(4)
    const before = s.calls.length
    c.setView(0, 9) // long gone from memory, still in the cache
    await flush()
    expect(s.calls.length).toBe(before)
    expect(c.rowAt(0)?.id).toBe(1)
  })
})

describe('errors', () => {
  it('reports a failed request with its params, and shows the rest', async () => {
    const s = makeServer()
    const errors: DataSourceError[] = []
    const c = make(s, { onError: (e) => errors.push(e), maxRunChunks: 1 })
    c.setView(0, 19)
    await flush()
    const first = s.calls.find((x) => x.params.start === 0)!
    const second = s.calls.find((x) => x.params.start === 10)!
    first.reject(new Error('503'))
    second.resolve()
    await flush()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(DataSourceError)
    expect(errors[0]!.message).toBe('503')
    expect(errors[0]!.params).toMatchObject({ start: 0, end: 9 })
    expect(c.snapshot().error).toBe(errors[0])
    expect(c.rowAt(0)).toBeUndefined()
    expect(c.rowAt(10)?.id).toBe(11)
  })

  it('aborting is not an error', async () => {
    const s = makeServer()
    const onError = vi.fn()
    const c = make(s, { onError })
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    c.setQuery(desc, none)
    await flush()
    expect(onError).not.toHaveBeenCalled()
    expect(c.snapshot().error).toBeNull()
  })

  it('a getRows that throws is a failed request, not a crash', async () => {
    const onError = vi.fn()
    const c = new DataSourceController<Row>({
      getSource: () => ({
        getRows: () => {
          throw new Error('sync boom')
        },
      }),
      getRowId: (r) => r.id,
      chunkSize: 10,
      settleMs: 0,
      prefetchChunks: 0,
      onError,
    })
    c.resume()
    c.setView(0, 9)
    await flush()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('retries a failed block only after retryAfterMs, when it is in view', async () => {
    vi.useFakeTimers()
    const s = makeServer()
    const c = make(s, { retryAfterMs: 1000 })
    c.setView(0, 9)
    await vi.advanceTimersByTimeAsync(0)
    s.calls[0]!.reject()
    await vi.advanceTimersByTimeAsync(0)
    c.setView(1, 9) // nudge inside the same block: must not retry yet
    await vi.advanceTimersByTimeAsync(10)
    expect(s.calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1100)
    expect(s.calls).toHaveLength(2) // retried on its own
    s.open()[0]!.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(c.rowAt(0)?.id).toBe(1)
    expect(c.snapshot().error).toBeNull()
  })

  it('refresh() gives a failed block another chance right away', async () => {
    const s = makeServer()
    const c = make(s, { retryAfterMs: 60_000 })
    c.setView(0, 9)
    await flush()
    s.calls[0]!.reject()
    await flush()
    c.refresh()
    await flush()
    expect(s.calls).toHaveLength(2)
  })
})

describe('editing and refreshing', () => {
  it('replaceRows changes the shown row and the cached copy', async () => {
    const s = makeServer()
    const cache = new LruCache<Row>()
    const c = make(s, { cache })
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    expect(c.replaceRows([{ id: 3, q: 'edited', v: 9 }])).toBe(1)
    expect(c.rowAt(2)).toMatchObject({ id: 3, v: 9 })
    expect(c.replaceRows([{ id: 99999, q: '', v: 0 }])).toBe(0) // unknown id: nothing happens
    const other = make(s, { cache }) // a second grid on the same cache
    other.setView(0, 9)
    await flush()
    expect(s.calls).toHaveLength(1) // served from the cache
    expect(other.rowAt(2)).toMatchObject({ v: 9 })
  })

  it('refresh keeps the rows on screen until the new ones arrive, and clears the cache', async () => {
    const s = makeServer()
    const c = make(s)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.refresh()
    expect(c.rowAt(0)?.id).toBe(1) // still shown
    await flush()
    expect(s.calls).toHaveLength(2) // the cache was cleared: a real request
    s.open()[0]!.resolve({ rows: [{ id: 77, q: 'new', v: 0 }, ...s.build(s.calls[1]!.params).rows.slice(1)] })
    await flush()
    expect(c.rowAt(0)?.id).toBe(77)
  })

  it('a background revalidation keeps unchanged row objects and stays silent when nothing changed', async () => {
    const s = makeServer()
    const c = make(s, { revalidateMs: 1000 })
    const seen: number[] = []
    c.subscribe(() => seen.push(c.getVersion()))
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    const row = c.rowAt(3)
    const notified = seen.length
    c.revalidate()
    await flush()
    s.open()[0]!.resolve() // identical data
    await flush()
    expect(c.rowAt(3)).toBe(row) // same object
    expect(seen.length).toBe(notified) // nobody was told
    c.revalidate()
    await flush()
    const changed = s.build(s.open()[0]!.params).rows
    changed[5] = { ...changed[5]!, v: 42 }
    s.open()[0]!.resolve({ rows: changed })
    await flush()
    expect(c.rowAt(5)?.v).toBe(42)
    expect(c.rowAt(3)).toBe(row) // untouched rows keep their identity
    expect(seen.length).toBeGreaterThan(notified)
    c.destroy()
  })

  it('polling re-reads on a timer and stops on destroy', async () => {
    vi.useFakeTimers()
    const s = makeServer()
    const c = make(s, { revalidateMs: 500 })
    c.setView(0, 9)
    await vi.advanceTimersByTimeAsync(0)
    s.calls[0]!.resolve()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(500)
    expect(s.calls).toHaveLength(2)
    c.destroy()
    await vi.advanceTimersByTimeAsync(2000)
    expect(s.calls).toHaveLength(2)
  })
})

/* ----------------------------------------------------------------- the race */

describe('races (randomised)', () => {
  function rng(seed: number) {
    let s = seed >>> 0
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  }

  it('never shows a row of another query, whatever order answers arrive in', async () => {
    for (let seed = 1; seed <= 120; seed++) {
      const rand = rng(seed * 2654435761)
      const int = (n: number) => Math.floor(rand() * n)
      const rude = rand() < 0.5
      const s = makeServer((f) => (f.quickFilter ? 400 : 1000), rand() < 0.5, rude)
      const errors: unknown[] = []
      const c = make(s, {
        maxConcurrent: 1 + int(4),
        maxRunChunks: 1 + int(3),
        prefetchChunks: int(2),
        maxLoadedChunks: 4 + int(30),
        keepPreviousData: false,
        onError: (e) => errors.push(e),
      })
      const queries: [SortItem[], FilterModel][] = [
        [asc, none],
        [desc, none],
        [asc, { items: [], quickFilter: 'a' }],
        [desc, { items: [], quickFilter: 'b' }],
      ]
      let [sort, filter] = queries[0]!
      c.setQuery(sort, filter)

      for (let step = 0; step < 60; step++) {
        const what = int(10)
        if (what <= 3) {
          const start = int(950)
          c.setView(start, start + int(40))
        } else if (what === 4) {
          ;[sort, filter] = queries[int(queries.length)]!
          c.setQuery(sort, filter)
        } else if (what === 5) c.refresh()
        else if (what <= 7) {
          // answer a random open request, maybe with an error
          const open = s.open()
          if (open.length) {
            const call = open[int(open.length)]!
            if (rand() < 0.15) call.reject(new Error('flaky'))
            else call.resolve()
          }
        } else if (what === 8) c.replaceRows([{ id: 1 + int(1000), q: tagOf(sort, filter), v: 1 }])
        else {
          // answer everything that is open, newest first (worst case for ordering bugs)
          for (const call of [...s.open()].reverse()) call.resolve()
        }
        await flush()

        // 1. nothing on screen belongs to another query
        const want = tagOf(sort, filter)
        for (const { row } of c.loadedRows()) {
          if (row.q !== want && row.q !== 'edited') expect(row.q, `seed ${seed} step ${step}`).toBe(want)
        }
        // 2. limits hold
        expect(c.stats.inFlight).toBeLessThanOrEqual(4)
        // 3. the id index agrees with the positions
        for (const { pos, row } of c.loadedRows()) expect(c.indexOfId(row.id), `seed ${seed} step ${step} id ${row.id}`).toBe(pos)
        // 4. a polite server has nothing left open for an aborted request
        if (!rude) for (const call of s.open()) expect(call.params.signal.aborted).toBe(false)
      }
      c.destroy()
    }
  })

  it('eventually shows the whole view once every request has been answered', async () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rand = rng(seed * 40503)
      const int = (n: number) => Math.floor(rand() * n)
      const s = makeServer(300, rand() < 0.5)
      const c = make(s, { maxConcurrent: 1 + int(3), maxRunChunks: 1 + int(3), prefetchChunks: int(2) })
      let start = 0
      for (let step = 0; step < 25; step++) {
        start = int(280)
        c.setView(start, start + 15)
        if (int(3) === 0) c.setQuery(int(2) ? asc : desc, none)
        for (let i = 0; i < int(3); i++) {
          const open = s.open()
          if (open.length) open[int(open.length)]!.resolve()
          await flush()
        }
      }
      // drain: first let the pump that the last view change scheduled run, then answer everything
      await flush()
      for (let guard = 0; guard < 200 && (s.open().length || c.stats.queued); guard++) {
        s.open().forEach((x) => x.resolve())
        await flush()
      }
      const view = [start, Math.min(start + 15, 299)]
      const missing = []
      for (let p = view[0]!; p <= view[1]!; p++) if (c.rowAt(p) === undefined) missing.push(p)
      expect(missing, `seed ${seed} view ${view} stats ${JSON.stringify(c.stats)} snap ${JSON.stringify({ ...c.snapshot(), error: null })}`).toEqual([])
      expect(c.snapshot().loading).toBe(false)
      c.destroy()
    }
  })
})
