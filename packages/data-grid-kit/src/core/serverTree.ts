import { LruCache } from './dataSource/cache'
import { DataSourceController, type DataSourceControllerOptions, type DataSourceSnapshot, type Grouping } from './dataSource/controller'
import type { DataSource } from './dataSource/contract'
import type { FilterModel, RowId, SortItem } from './types'

/** One level of the tree: the rows under one parent (or the top level), loaded by their own controller. */
export interface TreeNode<R> {
  ctrl: DataSourceController<R>
  /** the parent row's id (`null` for the top level) */
  id: RowId | null
  /** keys of the path from the top to this level's parent */
  path: string[]
  /** 0 for the top level */
  depth: number
  parent: TreeNode<R> | null
}

/** A run of consecutive rows of one level; an expanded row splits its level's rows in two, its children go between. */
export interface Segment<R> {
  node: TreeNode<R>
  /** positions in the level's own rows: [from, to) */
  from: number
  to: number
  /** position of its first row in the whole list */
  start: number
}

export interface ServerTreeOptions<R> extends Omit<DataSourceControllerOptions<R>, 'groupKeys'> {
  isExpanded: (id: RowId) => boolean
}

/**
 * Tree data and row grouping on the server. The top level and every expanded row's children are each a
 * `DataSourceController` (blocks, cache, abort, retry); this keeps them together, makes the one list the grid shows out
 * of their segments, and loads a level only when its parent is expanded.
 */
export class ServerTree<R> {
  readonly root: TreeNode<R>
  private children = new Map<RowId, TreeNode<R>>()
  private listeners = new Set<() => void>()
  private version = 0
  private query: { sortModel: SortItem[]; filterModel: FilterModel; grouping?: Grouping } = { sortModel: [], filterModel: { items: [] } }
  private layout: { version: number; segments: Segment<R>[]; total: number } | null = null
  private alive = false
  private unwatch = new Map<DataSourceController<R>, () => void>()

  constructor(private o: ServerTreeOptions<R>) {
    // one cache for every level (each key says which level it is for), so reopening a row does not ask again
    if (o.cache === undefined) this.o = { ...o, cache: new LruCache<R>({ now: o.now }) }
    this.root = { ctrl: this.makeController([]), id: null, path: [], depth: 0, parent: null }
  }

  /* ---------------------------------------------------------------- subscribe */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }
  getVersion = () => this.version

  private changed() {
    this.version++
    for (const l of this.listeners) l()
  }

  private makeController(path: string[]): DataSourceController<R> {
    const { isExpanded: _ignored, ...rest } = this.o
    const top = path.length === 0
    const ctrl = new DataSourceController<R>({ ...rest, groupKeys: path, prefetchChunks: top ? rest.prefetchChunks : 0, revalidateMs: top ? rest.revalidateMs : undefined, settleMs: top ? rest.settleMs : 0 })
    this.watch(ctrl)
    return ctrl
  }

  /** be told when a level changes (a controller forgets its listeners when it is destroyed, so this is done again on `resume`) */
  private watch(ctrl: DataSourceController<R>) {
    this.unwatch.get(ctrl)?.()
    this.unwatch.set(ctrl, ctrl.subscribe(() => this.changed()))
  }

  /* ---------------------------------------------------------------- lifecycle */

  resume() {
    this.alive = true
    for (const n of this.levels) {
      this.watch(n.ctrl)
      n.ctrl.resume()
    }
  }
  destroy() {
    this.alive = false
    for (const n of this.levels) n.ctrl.destroy()
  }
  configure(patch: Partial<DataSourceControllerOptions<R>>) {
    Object.assign(this.o, patch)
    this.root.ctrl.configure(patch)
    for (const n of this.children.values()) n.ctrl.configure({ ...patch, prefetchChunks: 0, revalidateMs: undefined, settleMs: 0 })
  }

  /** A different sort, filter, grouping or aggregation: every level is a different set of rows, so start over from the top. */
  setQuery(sortModel: SortItem[], filterModel: FilterModel, grouping?: Grouping) {
    this.query = { sortModel, filterModel, grouping }
    for (const n of this.children.values()) n.ctrl.destroy()
    this.children.clear()
    this.layout = null
    this.root.ctrl.setQuery(sortModel, filterModel, grouping)
  }

  refresh() {
    for (const n of this.children.values()) n.ctrl.destroy()
    this.children.clear()
    this.layout = null
    this.root.ctrl.refresh()
  }

  /* ----------------------------------------------------------------- expansion */

  /** Open a level for every loaded row that is expanded and has children; close the ones that are not (or whose row is gone). */
  sync(): void {
    const source = this.o.getSource()
    if (!source?.getChildrenCount || !source.getGroupKey) return
    let touched = false
    for (const [id, node] of this.children) {
      const parentAt = node.parent!.ctrl.indexOfId(id)
      if (!this.o.isExpanded(id) || (parentAt < 0 && !this.hasLoaded(node.parent!))) {
        this.drop(id)
        touched = true
      }
    }
    // breadth first: a level opened here shows up in the next sync (its own change notifies)
    const levels: TreeNode<R>[] = [this.root, ...this.children.values()]
    for (const node of levels) {
      node.ctrl.forEachLoaded((_pos, row) => {
        if (source.getChildrenCount!(row) === 0) return
        const id = this.o.getRowId(row)
        if (this.children.has(id) || !this.o.isExpanded(id)) return
        this.open(node, id, [...node.path, source.getGroupKey!(row)])
        touched = true
      })
    }
    if (touched) {
      this.layout = null
      this.changed()
    }
  }

  private hasLoaded(node: TreeNode<R>) {
    return node.ctrl.snapshot().loadedEnd > 0
  }

  private open(parent: TreeNode<R>, id: RowId, path: string[]) {
    const ctrl = this.makeController(path)
    const node: TreeNode<R> = { ctrl, id, path, depth: parent.depth + 1, parent }
    this.children.set(id, node)
    ctrl.setQuery(this.query.sortModel, this.query.filterModel, this.query.grouping)
    ctrl.setView(0, this.o.chunkSize ? this.o.chunkSize - 1 : 99)
    if (this.alive) ctrl.resume()
  }

  /** a collapsed row's level, and the levels under it, are closed (what they loaded stays in the cache) */
  private drop(id: RowId) {
    const node = this.children.get(id)
    if (!node) return
    node.ctrl.destroy()
    this.children.delete(id)
    for (const [childId, n] of [...this.children]) if (n.parent === node) this.drop(childId)
  }

  /* -------------------------------------------------------------------- layout */

  /** how many rows a level shows, loaded or not */
  private countOf(node: TreeNode<R>): number {
    const snap = node.ctrl.snapshot()
    if (snap.rowCount >= 0) return snap.rowCount
    if (node.depth === 0) return snap.loadedEnd + (snap.hasNextPage ? snap.chunkSize : 0)
    const parentRow = node.parent!.ctrl.rowAt(node.parent!.ctrl.indexOfId(node.id!))
    const known = parentRow === undefined ? -1 : (this.o.getSource()?.getChildrenCount?.(parentRow) ?? -1)
    return known > 0 ? Math.max(known, snap.loadedEnd) : snap.loadedEnd + (snap.hasNextPage ? 1 : 0)
  }

  /** the list the grid shows, as runs of consecutive rows of each level (cached until something changes) */
  segments(): { version: number; segments: Segment<R>[]; total: number } {
    if (this.layout && this.layout.version === this.version) return this.layout
    const segments: Segment<R>[] = []
    let total = 0
    const kidsOf = new Map<TreeNode<R>, { at: number; node: TreeNode<R> }[]>()
    for (const n of this.children.values()) {
      const at = n.parent!.ctrl.indexOfId(n.id!)
      if (at < 0) continue
      const list = kidsOf.get(n.parent!) ?? []
      list.push({ at, node: n })
      kidsOf.set(n.parent!, list)
    }
    const walk = (node: TreeNode<R>) => {
      const count = this.countOf(node)
      const kids = (kidsOf.get(node) ?? []).filter((k) => k.at < count).sort((a, b) => a.at - b.at)
      let cursor = 0
      for (const k of kids) {
        segments.push({ node, from: cursor, to: k.at + 1, start: total })
        total += k.at + 1 - cursor
        cursor = k.at + 1
        walk(k.node)
      }
      if (cursor < count || kids.length === 0) {
        segments.push({ node, from: cursor, to: count, start: total })
        total += count - cursor
      }
    }
    walk(this.root)
    return (this.layout = { version: this.version, segments, total })
  }

  /** the level and position of row `index` of the whole list */
  locate(index: number): { node: TreeNode<R>; local: number } | undefined {
    const { segments } = this.segments()
    let lo = 0
    let hi = segments.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (segments[mid]!.start <= index) lo = mid
      else hi = mid - 1
    }
    const s = segments[lo]
    return s && index >= s.start && index < s.start + (s.to - s.from) ? { node: s.node, local: s.from + index - s.start } : undefined
  }

  /** the position in the whole list of a loaded row, or -1 */
  indexOfId(id: RowId): number {
    const { segments } = this.segments()
    for (const s of segments) {
      const at = s.node.ctrl.indexOfId(id)
      if (at >= s.from && at < s.to) return s.start + at - s.from
    }
    return -1
  }

  /** the rows wanted now: positions [start, end] of the whole list. Each level fetches what falls in it. */
  setView(start: number, end: number) {
    const wanted = new Map<TreeNode<R>, { lo: number; hi: number }>()
    for (const s of this.segments().segments) {
      const len = s.to - s.from
      if (s.start > end || s.start + len - 1 < start) continue
      const lo = s.from + Math.max(0, start - s.start)
      const hi = s.from + Math.min(len - 1, end - s.start)
      const w = wanted.get(s.node)
      wanted.set(s.node, { lo: w ? Math.min(w.lo, lo) : lo, hi: w ? Math.max(w.hi, hi) : hi })
    }
    for (const [node, w] of wanted) node.ctrl.setView(w.lo, w.hi)
  }

  /* ------------------------------------------------------------------ reading */

  /** what the grid needs to know about loading: the top level's numbers, loading and errors across all levels */
  snapshot(): DataSourceSnapshot {
    const top = this.root.ctrl.snapshot()
    let loading = top.loading
    let error = top.error
    for (const n of this.children.values()) {
      const s = n.ctrl.snapshot()
      loading ||= s.loading
      error ||= s.error
    }
    return { ...top, loading, error }
  }

  get levels(): TreeNode<R>[] {
    return [this.root, ...this.children.values()]
  }

  source(): DataSource<R> | undefined {
    return this.o.getSource()
  }
}
