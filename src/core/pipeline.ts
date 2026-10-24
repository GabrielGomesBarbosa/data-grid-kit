import { coerceFilterValue } from './columns'
import { accAdd, accFinish, accMerge, accSub, isBuiltinAggregation, newAcc, type AggAcc, type BuiltinAggregation } from './aggregation'
import type {
  ColumnDef,
  CustomAggregation,
  FilterItem,
  FilterModel,
  PaginationModel,
  RenderRow,
  RowId,
  SortItem,
} from './types'

import { collator, compareValues, formatCellValue, getCellValue, isNil } from './values'

export { compareValues, formatCellValue, getCellValue }

/* ------------------------------------------------------------------ filter */

function matchesItem<R>(item: FilterItem, col: ColumnDef<R>, row: R): boolean {
  const raw = getCellValue(col, row)
  const { operator } = item
  const value = coerceFilterValue(col, item.value)
  if (operator === 'isEmpty') return isNil(raw)
  if (operator === 'isNotEmpty') return !isNil(raw)
  if (isNil(value)) return true // incomplete filter: ignore
  if (operator === 'gt' || operator === 'gte' || operator === 'lt' || operator === 'lte') {
    if (isNil(raw)) return false
    const cmp = compareValues(raw, value)
    return operator === 'gt' ? cmp > 0 : operator === 'gte' ? cmp >= 0 : operator === 'lt' ? cmp < 0 : cmp <= 0
  }
  if (operator === 'equals' && (typeof value === 'number' || value instanceof Date)) {
    return !isNil(raw) && compareValues(raw, value) === 0
  }
  const text = String(raw ?? '').toLowerCase()
  const needle = String(value).toLowerCase()
  switch (operator) {
    case 'contains':
      return text.includes(needle)
    case 'equals':
      return text === needle
    case 'startsWith':
      return text.startsWith(needle)
    case 'endsWith':
      return text.endsWith(needle)
  }
}

export function createRowFilter<R>(
  model: FilterModel,
  columns: ColumnDef<R>[],
): ((row: R) => boolean) | null {
  const byField = new Map(columns.map((c) => [c.field, c]))
  const items = model.items.filter((i) => byField.has(i.field))
  const quick = model.quickFilter?.trim().toLowerCase()
  if (items.length === 0 && !quick) return null
  const terms = quick ? quick.split(/\s+/) : []
  const searchable = columns.filter((c) => !c.hidden)
  return (row) => {
    if (items.length) {
      const test = (i: FilterItem) => matchesItem(i, byField.get(i.field)!, row)
      if (!(model.logic === 'or' ? items.some(test) : items.every(test))) return false
    }
    if (terms.length) {
      // build the searchable text once per row, then test every term against it
      let haystack = ''
      for (const c of searchable) haystack += formatCellValue(c, row).toLowerCase() + '\u0000'
      for (const t of terms) if (!haystack.includes(t)) return false
    }
    return true
  }
}

/* ------------------------------------------------------------------- model */

/**
 * A node of the row hierarchy. The hierarchy is a persistent, mutable structure: filtering and
 * sorting store their results on the nodes (`self`, `count`, `kids`), so a single inserted, edited
 * or removed row only touches the nodes on its path to the root.
 */
export interface TreeNode<R> {
  id: RowId
  type: 'leaf' | 'group'
  row?: R
  /** all children, in `seq` order */
  children: TreeNode<R>[]
  parent: TreeNode<R> | null
  groupField?: string
  groupValue?: unknown
  /** tree data: this node's own key within its parent's path */
  seg?: string
  /** tree data: serialised full path (built lazily, only needed for incremental updates) */
  pk?: string
  /** creation order; children arrays are always sorted by it, which makes ties deterministic */
  seq: number
  /** position of the row in the `rows` array it came from; used to detect reordering */
  pos: number
  /** 1 when this node's own row passes the filter */
  self: 0 | 1
  /** passing rows in this subtree, self included. A node is visible when this is > 0. */
  count: number
  /** visible children, sorted */
  kids?: TreeNode<R>[]
  /** raw sort keys, one per active sort item */
  k?: unknown[]
  /** scratch: rank-decorated keys, only alive during a full sort */
  r?: unknown[]
  /** aggregation totals for the rows below this node (not including its own row) */
  acc: AggAcc[] | undefined
  /** a min/max total lost its extreme value and must be recomputed before being read */
  accDirty: boolean
  /** cached results of custom aggregations, valid for one data version */
  cagg: { v: number; out: Record<string, unknown> } | undefined
  /** the RenderRow last produced for this node, reused while nothing about it changed */
  rr: RenderRow<R> | undefined
  /** scratch: diff stamp */
  mark: number
}

interface Model<R> {
  mode: 'flat' | 'group' | 'tree'
  groupFields: string[]
  roots: TreeNode<R>[]
  /** visible, sorted roots */
  kidsRoot: TreeNode<R>[]
  byId: Map<RowId, TreeNode<R>>
  pathMap: Map<string, TreeNode<R>> | null
  seq: number
  pos: number
  stamp: number
  dataCount: number
  /** rows passing the filter */
  total: number
  /** aggregation totals over every row passing the filter */
  rootAcc: AggAcc[] | null
  rootDirty: boolean
  rowsProp: unknown[]
  /** imperative patches were applied since `rowsProp` was accepted, so node rows may differ from it */
  patched: boolean
}

export interface RowChanges<R> {
  /**
   * Move rows in the data order: `id` goes right before `before` (or to the end when `before` is null).
   * Only for flat grids (no grouping or tree data); anything else is ignored. Applied after the other changes.
   */
  move?: { id: RowId; before: RowId | null }[]
  /** rows to add. A row whose id already exists is treated as an update. */
  insert?: R[]
  /** rows to replace by id. A row whose id doesn't exist yet is inserted. */
  update?: R[]
  remove?: RowId[]
}

export type UpdateKind = 'rebuild' | 'incremental' | 'none'

interface SortPlan<R> {
  fields: string[]
  dirs: number[]
  cmps: ((a: unknown, b: unknown) => number)[]
  /** true when the column uses the default comparator, so two numbers can be subtracted directly */
  fast: boolean[]
  cols: ColumnDef<R>[]
  allIdx: number[]
  byGroupField: Map<string, number[]>
}

const NO_ITEMS: number[] = []

function makePlan<R>(sortModel: SortItem[], byField: Map<string, ColumnDef<R>>): SortPlan<R> {
  const active = sortModel.filter((s) => byField.has(s.field))
  const plan: SortPlan<R> = {
    fields: active.map((s) => s.field),
    dirs: active.map((s) => (s.direction === 'asc' ? 1 : -1)),
    cols: active.map((s) => byField.get(s.field)!),
    cmps: active.map((s) => byField.get(s.field)!.sortComparator ?? compareValues),
    fast: active.map((s) => !byField.get(s.field)!.sortComparator),
    allIdx: active.map((_, i) => i),
    byGroupField: new Map(),
  }
  plan.fields.forEach((f, j) => {
    const list = plan.byGroupField.get(f)
    if (list) list.push(j)
    else plan.byGroupField.set(f, [j])
  })
  return plan
}

function same(a: readonly unknown[], b: readonly unknown[]) {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
}

const groupKey = (raw: unknown) => (raw instanceof Date ? raw.getTime() : (raw ?? null))

function mk<R>(id: RowId, type: 'leaf' | 'group', parent: TreeNode<R> | null, seq: number, pos = -1): TreeNode<R> {
  // every field is created here, in a fixed order, so all nodes share one hidden class
  return {
    id,
    type,
    row: undefined,
    children: [],
    parent,
    groupField: undefined,
    groupValue: undefined,
    seg: undefined,
    pk: undefined,
    seq,
    pos,
    self: 0,
    count: 0,
    kids: undefined,
    k: undefined,
    r: undefined,
    acc: undefined,
    accDirty: false,
    cagg: undefined,
    rr: undefined,
    mark: 0,
  }
}

/* ---------------------------------------------------------------- pipeline */

export interface PipelineResult<R> {
  rows: RenderRow<R>[]
  /** top-level nodes after filtering (what pagination counts) */
  rootCount: number
  /** data rows that survived filtering */
  filteredCount: number
  /** ids of visible data rows under a node (the id itself for a leaf) */
  getLeafIds(id: RowId): RowId[]
  /** ids of every expandable visible node, for "expand all" (computed on first access) */
  readonly expandableIds: RowId[]
  /** the data row behind an id (group rows have none) */
  getRow(id: RowId): R | undefined
  /** position of an id in `rows`, or -1 when it is not on the current page / is collapsed away */
  indexOf(id: RowId): number
  /** every row that passes the filter, in sorted tree order, ignoring pagination and expansion */
  getVisibleDataRows(): R[]
  /**
   * Every node that passes the filter, in display order, whatever is expanded or on the page: group rows with their
   * aggregates, tree parents, leaves. What an export writes. Pivot mode stops at the deepest group level.
   */
  getExportRows(): RenderRow<R>[]
  /** open detail panels that are in `rows`, top to bottom: the row id and its index in `rows` */
  detailRows: { id: RowId; index: number }[]
  /** position of a row in the data order (before any filtering, sorting or paging), or -1; flat grids only */
  dataIndexOf(id: RowId): number
  /** the row at a position of the data order, if any; flat grids only */
  dataIdAt(index: number): RowId | undefined
  /** number of rows in the data order; flat grids only (0 otherwise) */
  readonly dataCount: number
  /** aggregated value per field over every row passing the filter; undefined without an aggregation model */
  getTotals(): Record<string, unknown> | undefined
  /** pivot mode: the value columns that exist for the current data, in display order (empty otherwise) */
  pivotColumns: PivotColumn[]
}

/** separates the parts of a pivot column's field name */
export const PIVOT_SEP = '\u241f'

/** One value column of a pivot table: the aggregate of one value field for one combination of column values. */
export interface PivotColumn {
  /** the field under which group rows carry this aggregate (`aggregates[field]`) */
  field: string
  valueField: string
  aggFunc: string
  /** display labels of the column groups above it, outermost first (empty for the totals) */
  path: string[]
  /** a total over all column values */
  total: boolean
}

export interface PivotInput {
  columns: { field: string; sort?: 'asc' | 'desc' }[]
  values: { field: string; aggFunc: string }[]
  /** also give every value a total column over all column values */
  totals?: boolean
}

export interface PipelineInput<R> {
  rows: R[]
  columns: ColumnDef<R>[]
  /** Treated as pure: a new function identity does not invalidate anything. */
  getRowId: (row: R) => RowId
  /**
   * Tree data on/off is what matters: swapping one path function for another does not by itself
   * rebuild the hierarchy (change `rows` for that).
   */
  getTreeDataPath?: (row: R) => string[]
  sortModel: SortItem[]
  filterModel: FilterModel
  rowGroupingModel: string[]
  expandedIds: ReadonlySet<RowId>
  expandAllByDefault: boolean
  pagination?: PaginationModel
  /** rows kept out of the main list (pinned rows). Only top-level (flat) rows are supported. */
  hiddenIds?: ReadonlySet<RowId>
  /** rows whose detail panel is open; the result lists where they are */
  detailIds?: ReadonlySet<RowId>
  /** field → aggregation function name; shown on group rows and in the totals */
  aggregationModel?: Record<string, string>
  aggregationFunctions?: Record<string, CustomAggregation<R>>
  /**
   * Pivot mode: `rowGroupingModel` gives the row groups, only group rows are produced (no leaves), and
   * their aggregates are keyed by the fields of `result.pivotColumns`. `aggregationModel` is ignored.
   */
  pivot?: PivotInput
}

export interface Pipeline<R> {
  (input: PipelineInput<R>): PipelineResult<R>
  /**
   * Queue row changes. They are applied incrementally on the next run, touching only the nodes on
   * the changed rows' paths. A later change of the `rows` identity discards them (your data wins).
   */
  patch(changes: RowChanges<R>): void
  /** what the last run did: a full rebuild, an incremental update, or nothing */
  readonly lastUpdate: UpdateKind
}

/**
 * Stateful pipeline over a persistent row hierarchy.
 *
 * - Changing the sort or filter recomputes only that stage (the hierarchy is kept).
 * - Expanding, collapsing and paging only re-flatten.
 * - A new `rows` array is diffed against the current rows by id; when the change is small
 *   (updates anywhere, removals anywhere, new rows appended at the end) it is applied
 *   incrementally instead of rebuilding everything.
 *
 * Incremental updates keep rows in the order they were created: new rows and new groups go to
 * the end. With a sort model the order is fully determined, so results match a fresh build.
 */
export function createPipeline<R>(): Pipeline<R> {
  let model: Model<R> | null = null
  let structDeps: unknown[] = []
  let filterDeps: unknown[] = []
  let sortDeps: unknown[] = []
  let flatDeps: unknown[] = []
  let passes: ((row: R) => boolean) | null = null
  let byField = new Map<string, ColumnDef<R>>()
  let getters = new Map<string, (row: R) => unknown>()
  let lastColumns: ColumnDef<R>[] | null = null
  let plan: SortPlan<R> = makePlan([], byField)
  let derivedOk = false
  /** node.k holds current keys for the active sort plan (cleared by non-incremental patches) */
  let keysValid = false
  let version = 0
  let result: PipelineResult<R> | undefined
  let queue: RowChanges<R>[] = []
  /**
   * Imperative changes (edits, updateRows) made since `rows` last changed, kept per id so they can be
   * replayed if the hierarchy has to be rebuilt for another reason (e.g. new columns).
   */
  const overlay = {
    upsert: new Map<RowId, R>(),
    remove: new Set<RowId>(),
    /** rows were moved by hand: on a rebuild the data order is carried over from the old hierarchy */
    moved: false,
  }
  let input!: PipelineInput<R>
  let lastUpdate: UpdateKind = 'rebuild'
  let stampCounter = 0
  const rawCmps = new Map<number[], (a: TreeNode<R>, b: TreeNode<R>) => number>()

  /* -------- sort comparators -------- */

  const itemsFor = (node: TreeNode<R>): number[] =>
    node.groupField !== undefined ? (plan.byGroupField.get(node.groupField) ?? NO_ITEMS) : plan.allIdx

  const makeCmp = (items: number[], ranked: boolean) => (a: TreeNode<R>, b: TreeNode<R>) => {
    const ak = (ranked ? a.r : a.k)!
    const bk = (ranked ? b.r : b.k)!
    for (let n = 0; n < items.length; n++) {
      const j = items[n]!
      const av = ak[j]
      const bv = bk[j]
      let c: number
      if (plan.fast[j] && typeof av === 'number' && typeof bv === 'number') {
        c = (av - bv) * plan.dirs[j]! // plain numbers (and text ranks): no function call, never empty
      } else {
        c = plan.cmps[j]!(av, bv)
        if (c !== 0 && isNil(av) === isNil(bv)) c *= plan.dirs[j]! // empties stay last in both directions
      }
      if (c !== 0) return c
    }
    // sorted tree siblings with equal keys fall back to their name, so the order never depends on history
    if (items.length && a.seg !== undefined && b.seg !== undefined && a.seg !== b.seg) return a.seg < b.seg ? -1 : 1
    // groups whose values the collator treats as equal ("dev" / "Dev") are told apart by the raw value
    if (items.length && a.groupField !== undefined && b.groupField !== undefined) {
      const x = String(a.groupValue)
      const y = String(b.groupValue)
      if (x !== y) return x < y ? -1 : 1
    }
    return a.seq - b.seq
  }
  const rawCmp = (items: number[]) => {
    let f = rawCmps.get(items)
    if (!f) rawCmps.set(items, (f = makeCmp(items, false)))
    return f
  }

  const computeKeys = (node: TreeNode<R>, row = node.row): unknown[] | undefined => {
    const n = plan.fields.length
    if (!n) return undefined
    const k = new Array<unknown>(n)
    for (let j = 0; j < n; j++) {
      const field = plan.fields[j]!
      if (node.groupField === field) k[j] = node.groupValue
      else if (row !== undefined) k[j] = getCellValue(plan.cols[j]!, row)
    }
    return k
  }

  const keysEqual = (a: unknown[] | undefined, b: unknown[] | undefined) => {
    if (!a || !b) return a === b
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
    return true
  }

  /* -------- sorted visible lists (binary search; order is total thanks to `seq`) -------- */

  const listOf = (node: TreeNode<R>): TreeNode<R>[] | undefined => (node.parent ? node.parent.kids : model!.kidsRoot)

  const searchPos = (list: TreeNode<R>[], node: TreeNode<R>, cmp: (a: TreeNode<R>, b: TreeNode<R>) => number) => {
    let lo = 0
    let hi = list.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cmp(list[mid]!, node) < 0) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  const detach = (node: TreeNode<R>) => {
    const list = listOf(node)
    if (!list) return
    let i = searchPos(list, node, rawCmp(itemsFor(node)))
    if (list[i] !== node) i = list.indexOf(node)
    if (i >= 0) list.splice(i, 1)
  }

  const attach = (node: TreeNode<R>) => {
    let list = listOf(node)
    if (!list) list = node.parent!.kids = []
    list.splice(searchPos(list, node, rawCmp(itemsFor(node))), 0, node)
  }

  /** Add `delta` to the counts of `start` and every ancestor, attaching/detaching nodes whose visibility flips. */
  const propagate = (start: TreeNode<R> | null, delta: number) => {
    if (delta === 0) return
    for (let a = start; a; a = a.parent) {
      const before = a.count
      a.count = before + delta
      const was = before > 0
      const is = a.count > 0
      if (was !== is) {
        if (is) attach(a)
        else {
          detach(a)
          a.kids = undefined
        }
      }
    }
  }

  /* -------- full stages -------- */

  const collect = (): TreeNode<R>[] => {
    const all: TreeNode<R>[] = []
    const stack = [...model!.roots]
    while (stack.length) {
      const n = stack.pop()!
      all.push(n)
      for (let i = 0; i < n.children.length; i++) stack.push(n.children[i]!)
    }
    return all
  }

  /* -------- aggregation -------- */

  interface AggItem {
    field: string
    name: string
    kind: BuiltinAggregation | null
    custom: CustomAggregation<R> | null
    col: ColumnDef<R>
  }
  let aggItems: AggItem[] = []
  let aggDeps: unknown[] = []
  let pivot: PivotInput | undefined
  const pivotOn = () => pivot !== undefined
  const aggOn = () => aggItems.length > 0 || pivot !== undefined

  /* pivot: one item per (column-value combination, value). They are created the first time a row with that
     combination shows up, so accumulators of older nodes may be shorter than `aggItems` (see `fit`). */
  interface PivotKey {
    key: string
    raws: unknown[]
    labels: string[]
    /** indices into aggItems, one per pivot value */
    items: number[]
    /** the total items followed by this key's items: what a row with this key contributes to */
    all: number[]
  }
  let pivotKeys = new Map<string, PivotKey>()
  let pivotValues: { col: ColumnDef<R>; kind: BuiltinAggregation }[] = []
  let pivotKeyCols: ColumnDef<R>[] = []
  let totalIdx: number[] = []
  let pivotColsCache: PivotColumn[] = []
  /** items that currently have rows: only these are reported (columns whose last row left are dropped) */
  let pivotLive: number[] = []
  const labelOfValue = (col: ColumnDef<R>, row: R): string => {
    const text = formatCellValue(col, row)
    return text === '' ? '(No value)' : text
  }

  const resetPivot = () => {
    pivotKeys = new Map()
    aggItems.length = totalIdx.length // keep the total items, drop every column-value item
  }

  const keyEntry = (row: R): PivotKey => {
    let key = ''
    for (let i = 0; i < pivotKeyCols.length; i++) {
      const raw = getCellValue(pivotKeyCols[i]!, row)
      key += (i ? PIVOT_SEP : '') + (isNil(raw) ? '' : String(groupKey(raw)))
    }
    let e = pivotKeys.get(key)
    if (!e) {
      e = {
        key,
        raws: pivotKeyCols.map((c) => getCellValue(c, row)),
        labels: pivotKeyCols.map((c) => labelOfValue(c, row)),
        items: [],
        all: totalIdx.slice(),
      }
      for (let j = 0; j < pivotValues.length; j++) {
        const v = pivotValues[j]!
        e.items.push(aggItems.length)
        e.all.push(aggItems.length)
        // the position keeps two values of the same field apart
        aggItems.push({ field: `__pv${PIVOT_SEP}${key}${PIVOT_SEP}${j}${PIVOT_SEP}${v.col.field}`, name: v.kind, kind: v.kind, custom: null, col: v.col })
      }
      pivotKeys.set(key, e)
    }
    return e
  }

  const pivotColumnsNow = (): PivotColumn[] => {
    if (!pivot) return pivotColsCache.length ? (pivotColsCache = []) : pivotColsCache
    const root = fit(ensureRootAccs())
    const alive: PivotKey[] = []
    for (const e of pivotKeys.values()) if (e.items.length && root[e.items[0]!]!.rows > 0) alive.push(e)
    const dirs = pivot.columns.map((c) => (c.sort === 'desc' ? -1 : 1))
    alive.sort((a, b) => {
      for (let i = 0; i < dirs.length; i++) {
        const c = compareValues(a.raws[i], b.raws[i])
        if (c) return c * dirs[i]!
      }
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
    })
    const out: PivotColumn[] = []
    pivotLive = totalIdx.slice()
    for (const e of alive) {
      for (const idx of e.items) pivotLive.push(idx)
      e.items.forEach((idx, j) => out.push({ field: aggItems[idx]!.field, valueField: pivotValues[j]!.col.field, aggFunc: pivotValues[j]!.kind, path: e.labels, total: false }))
    }
    totalIdx.forEach((idx, j) => out.push({ field: aggItems[idx]!.field, valueField: pivotValues[j]!.col.field, aggFunc: pivotValues[j]!.kind, path: [], total: true }))
    // columns that lost their last row leave dead items behind: rebuild them away once they pile up
    if (aggItems.length - totalIdx.length > 2 * (pivotLive.length - totalIdx.length) + 64) {
      fullFilter()
      return pivotColumnsNow()
    }
    const same = out.length === pivotColsCache.length && out.every((c, i) => c.field === pivotColsCache[i]!.field && c.path.join(PIVOT_SEP) === pivotColsCache[i]!.path.join(PIVOT_SEP))
    return same ? pivotColsCache : (pivotColsCache = out)
  }

  const makeAggItems = (): AggItem[] => {
    const out: AggItem[] = []
    pivotKeys = new Map()
    pivotValues = []
    pivotKeyCols = []
    totalIdx = []
    if (pivot) {
      for (const v of pivot.values) {
        const col = byField.get(v.field)
        if (col && col.aggregable !== false && isBuiltinAggregation(v.aggFunc)) pivotValues.push({ col, kind: v.aggFunc })
      }
      for (const c of pivot.columns) {
        const col = byField.get(c.field)
        if (col) pivotKeyCols.push(col)
      }
      if (pivot.totals) {
        for (let j = 0; j < pivotValues.length; j++) {
          const v = pivotValues[j]!
          totalIdx.push(out.length)
          out.push({ field: `__pt${PIVOT_SEP}${j}${PIVOT_SEP}${v.col.field}`, name: v.kind, kind: v.kind, custom: null, col: v.col })
        }
      }
      return out
    }
    for (const [field, name] of Object.entries(input.aggregationModel ?? {})) {
      const col = byField.get(field)
      if (!col || col.aggregable === false) continue
      if (isBuiltinAggregation(name)) out.push({ field, name, kind: name, custom: null, col })
      else {
        const custom = input.aggregationFunctions?.[name]
        if (custom) out.push({ field, name, kind: null, custom, col })
      }
    }
    return out
  }

  const newAccs = (): AggAcc[] => aggItems.map(() => newAcc())

  /** accumulators created before an item existed are shorter than `aggItems`: the missing ones are empty */
  const fit = (accs: AggAcc[]): AggAcc[] => {
    for (let j = accs.length; j < aggItems.length; j++) accs.push(newAcc())
    return accs
  }

  /**
   * What one row contributes. Without a pivot `v[j]` belongs to item j; with one, only the items the row
   * lands in are listed (`idx[t]` is the item of `v[t]`), so a row costs one entry per value, not per column.
   */
  interface Vals {
    idx: number[] | null
    v: unknown[]
  }

  /** values of the built-in aggregated columns for one row (undefined for custom items) */
  const valuesOfRow = (row: R): Vals => {
    if (pivot) {
      const idx = keyEntry(row).all
      return { idx, v: idx.map((j) => getCellValue(aggItems[j]!.col, row)) }
    }
    return { idx: null, v: aggItems.map((it) => (it.kind ? getCellValue(it.col, row) : undefined)) }
  }

  /** add a child's own row and everything below it to `accs` */
  const addChildTo = (accs: AggAcc[], ch: TreeNode<R>) => {
    if (ch.self && ch.row !== undefined) {
      if (pivot) {
        const vals = valuesOfRow(ch.row)
        fit(accs)
        const idx = vals.idx!
        for (let t = 0; t < idx.length; t++) accAdd(accs[idx[t]!]!, aggItems[idx[t]!]!.kind!, vals.v[t])
      } else {
        for (let j = 0; j < aggItems.length; j++) {
          const it = aggItems[j]!
          if (it.kind) accAdd(accs[j]!, it.kind, getCellValue(it.col, ch.row))
        }
      }
    }
    if (ch.children.length) {
      const sub = ensureAccs(ch)
      fit(accs)
      for (let j = 0; j < aggItems.length; j++) {
        const it = aggItems[j]!
        if (it.kind && sub[j]!.rows > 0) accMerge(accs[j]!, sub[j]!, it.kind)
      }
    }
  }

  /** the node's totals; recomputed from its children first if a min/max lost its extreme */
  const ensureAccs = (node: TreeNode<R>): AggAcc[] => {
    if (node.acc && !node.accDirty) return fit(node.acc)
    const accs = newAccs()
    for (const ch of node.children) addChildTo(accs, ch)
    node.acc = accs
    node.accDirty = false
    return accs
  }

  const ensureRootAccs = (): AggAcc[] => {
    const m = model!
    if (m.rootAcc && !m.rootDirty) return fit(m.rootAcc)
    const accs = newAccs()
    for (const r of m.roots) addChildTo(accs, r)
    m.rootAcc = accs
    m.rootDirty = false
    return accs
  }

  /** a row entered (+1) or left (-1) the totals of every ancestor and of the grand total */
  const contribute = (start: TreeNode<R> | null, vals: Vals, sign: 1 | -1) => {
    const m = model!
    const idx = vals.idx
    const n = idx ? idx.length : aggItems.length
    const apply = (accs: AggAcc[]): boolean => {
      fit(accs)
      let stale = false
      for (let t = 0; t < n; t++) {
        const j = idx ? idx[t]! : t
        const kind = aggItems[j]!.kind
        if (!kind) continue
        if (sign > 0) accAdd(accs[j]!, kind, vals.v[t])
        else if (accSub(accs[j]!, kind, vals.v[t])) stale = true
      }
      return stale
    }
    for (let a = start; a; a = a.parent) {
      if (apply(a.acc ?? (a.acc = newAccs()))) a.accDirty = true
    }
    if (apply(m.rootAcc ?? (m.rootAcc = newAccs()))) m.rootDirty = true
  }

  const sameVals = (a: Vals | null, b: Vals | null) => {
    if (!a || !b) return a === b
    if (a.v.length !== b.v.length) return false
    if (a.idx || b.idx) {
      if (!a.idx || !b.idx) return false
      for (let i = 0; i < a.idx.length; i++) if (a.idx[i] !== b.idx[i]) return false
    }
    for (let i = 0; i < a.v.length; i++) if (!Object.is(a.v[i], b.v[i])) return false
    return true
  }

  /** custom aggregations read every value below a node; cached per data version */
  const customResults = (node: TreeNode<R> | null): Record<string, unknown> => {
    const cache = node ? node.cagg : customRoot
    if (cache && cache.v === version) return cache.out
    const out: Record<string, unknown> = {}
    for (const it of aggItems) {
      if (!it.custom) continue
      const values: unknown[] = []
      const rows: R[] = []
      const visit = (nodes: TreeNode<R>[]) => {
        for (const n of nodes) {
          if (n.self && n.row !== undefined) {
            values.push(getCellValue(it.col, n.row))
            rows.push(n.row)
          }
          if (n.kids) visit(n.kids)
        }
      }
      visit(node ? (node.kids ?? []) : model!.kidsRoot)
      out[it.field] = it.custom.apply({ values, rows })
    }
    if (node) node.cagg = { v: version, out }
    else customRoot = { v: version, out }
    return out
  }
  let customRoot: { v: number; out: Record<string, unknown> } | undefined
  let lastTotals: Record<string, unknown> | undefined

  const finishAccs = (accs: AggAcc[], node: TreeNode<R> | null): Record<string, unknown> => {
    const rec: Record<string, unknown> = {}
    if (pivot) {
      for (let t = 0; t < pivotLive.length; t++) {
        const j = pivotLive[t]!
        rec[aggItems[j]!.field] = accFinish(accs[j]!, aggItems[j]!.kind!)
      }
      return rec
    }
    const custom = aggItems.some((it) => it.custom) ? customResults(node) : undefined
    for (let j = 0; j < aggItems.length; j++) {
      const it = aggItems[j]!
      rec[it.field] = it.kind ? accFinish(accs[j]!, it.kind) : custom![it.field]
    }
    return rec
  }

  const shallowSame = (a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined) => {
    if (a === b) return true
    if (!a || !b) return false
    const ka = Object.keys(a)
    if (ka.length !== Object.keys(b).length) return false
    for (const k of ka) if (!Object.is(a[k], b[k])) return false
    return true
  }

  const fullFilter = () => {
    const m = model!
    let total = 0
    const agg = aggOn()
    if (pivot) resetPivot() // columns are rediscovered from the rows that pass the filter
    const visit = (n: TreeNode<R>): number => {
      let c = 0
      for (let i = 0; i < n.children.length; i++) c += visit(n.children[i]!)
      n.self = n.row !== undefined && (!passes || passes(n.row)) ? 1 : 0
      total += n.self
      n.count = c + n.self
      if (agg && n.children.length) {
        const accs = newAccs()
        for (let i = 0; i < n.children.length; i++) addChildTo(accs, n.children[i]!)
        n.acc = accs
        n.accDirty = false
      } else if (n.acc) {
        n.acc = undefined
        n.accDirty = false
      }
      return n.count
    }
    for (let i = 0; i < m.roots.length; i++) visit(m.roots[i]!)
    m.total = total
    if (agg) {
      const accs = newAccs()
      for (let i = 0; i < m.roots.length; i++) addChildTo(accs, m.roots[i]!)
      m.rootAcc = accs
    } else m.rootAcc = null
    m.rootDirty = false
  }

  const computeRanks = (all: TreeNode<R>[]) => {
    const n = plan.fields.length
    const ranked: (Map<string, number> | null)[] = new Array(n).fill(null)
    for (let j = 0; j < n; j++) {
      if (plan.cmps[j] !== compareValues) continue
      const distinct = new Set<string>()
      let ok = true
      for (let i = 0; i < all.length && ok; i++) {
        const key = all[i]!.k?.[j]
        if (typeof key === 'string' && key !== '') distinct.add(key)
        else if (!isNil(key)) ok = false
      }
      if (!ok) continue
      const sorted = [...distinct].sort(collator.compare)
      const rank = new Map<string, number>()
      let r = -1
      for (let i = 0; i < sorted.length; i++) {
        // strings the collator considers equal ("a" / "A") share a rank, like compareValues would
        if (i === 0 || collator.compare(sorted[i - 1]!, sorted[i]!) !== 0) r++
        rank.set(sorted[i]!, r)
      }
      ranked[j] = rank
    }
    const anyRanked = ranked.some(Boolean)
    for (const node of all) {
      const k = node.k
      if (!k || !anyRanked) {
        node.r = k
        continue
      }
      const r = new Array<unknown>(n)
      for (let j = 0; j < n; j++) {
        const rank = ranked[j]
        const key = k[j]
        r[j] = rank && typeof key === 'string' && key !== '' ? rank.get(key) : key
      }
      node.r = r
    }
  }

  const fullSort = () => {
    const m = model!
    const all = collect()
    if (!keysValid) {
      for (const node of all) node.k = computeKeys(node)
      keysValid = true
    }
    computeRanks(all)
    const ranked = new Map<number[], (a: TreeNode<R>, b: TreeNode<R>) => number>()
    const sortList = (list: TreeNode<R>[]): TreeNode<R>[] => {
      const vis = list.filter((c) => c.count > 0)
      if (vis.length > 1) {
        const items = itemsFor(vis[0]!)
        if (items.length) {
          let cmp = ranked.get(items)
          if (!cmp) ranked.set(items, (cmp = makeCmp(items, true)))
          vis.sort(cmp)
        }
      }
      return vis
    }
    for (const node of all) node.kids = node.children.length && node.count > 0 ? sortList(node.children) : undefined
    m.kidsRoot = sortList(m.roots)
    for (const node of all) node.r = undefined
  }

  /* -------- building the hierarchy from scratch -------- */

  const getValueOf = (field: string, row: R): unknown =>
    (getters.get(field) ?? ((r: R) => (r as Record<string, unknown>)[field]))(row)

  const buildModel = (): Model<R> => {
    const rows = input.rows
    const hasTree = !!input.getTreeDataPath
    const fields = input.rowGroupingModel
    const m: Model<R> = {
      mode: hasTree ? 'tree' : fields.length ? 'group' : 'flat',
      groupFields: fields,
      roots: [],
      kidsRoot: [],
      byId: new Map(),
      pathMap: null,
      seq: 0,
      pos: 0,
      stamp: 0,
      dataCount: 0,
      total: 0,
      rootAcc: null,
      rootDirty: false,
      rowsProp: rows,
      patched: false,
    }
    const leafOf = (row: R, parent: TreeNode<R> | null): TreeNode<R> => {
      const id = input.getRowId(row)
      const node = mk<R>(id, 'leaf', parent, m.seq++, m.pos++)
      node.row = row
      m.byId.set(id, node)
      m.dataCount++
      return node
    }

    if (m.mode === 'flat') {
      for (let i = 0; i < rows.length; i++) m.roots.push(leafOf(rows[i]!, null))
    } else if (m.mode === 'group') {
      // leaves get seq in row order first, then groups in first-appearance order
      const leaves = rows.map((row) => leafOf(row, null))
      const group = (items: TreeNode<R>[], depth: number, parent: TreeNode<R> | null, parentId: string): TreeNode<R>[] => {
        const field = fields[depth]
        if (field === undefined) {
          for (const leaf of items) leaf.parent = parent
          return items
        }
        const buckets = new Map<unknown, { raw: unknown; items: TreeNode<R>[] }>()
        const get = getters.get(field) ?? ((r: R) => (r as Record<string, unknown>)[field])
        for (const leaf of items) {
          const raw = get(leaf.row!)
          const key = groupKey(raw)
          const bucket = buckets.get(key)
          if (bucket) bucket.items.push(leaf)
          else buckets.set(key, { raw, items: [leaf] })
        }
        const out: TreeNode<R>[] = []
        for (const [key, { raw, items: members }] of buckets) {
          const id = `${parentId}/${field}:${String(key)}`
          const g = mk<R>(id, 'group', parent, m.seq++)
          g.groupField = field
          g.groupValue = raw
          g.children = group(members, depth + 1, g, id)
          m.byId.set(id, g)
          out.push(g)
        }
        return out
      }
      m.roots = group(leaves, 0, null, 'group')
    } else {
      type Level = Map<string, { node: TreeNode<R>; next: Level }>
      const top: Level = new Map()
      for (const row of rows) {
        const id = input.getRowId(row)
        const path = input.getTreeDataPath!(row)
        if (!path.length) continue
        let level = top
        let parent: TreeNode<R> | null = null
        for (let depth = 0; depth < path.length; depth++) {
          const key = path[depth]!
          let slot: { node: TreeNode<R>; next: Level } | undefined = level.get(key)
          if (!slot) {
            const sid = depth === path.length - 1 ? id : `tree:${JSON.stringify(path.slice(0, depth + 1))}`
            const node: TreeNode<R> = mk<R>(sid, 'group', parent, m.seq++)
            node.seg = key
            slot = { node, next: new Map() }
            level.set(key, slot)
            if (parent) parent.children.push(node)
            else m.roots.push(node)
            m.byId.set(sid, node)
          }
          if (depth === path.length - 1) {
            if (slot.node.row !== undefined) {
              throw new Error(
                `gridkit: rows "${String(slot.node.id)}" and "${String(id)}" share the tree path ${JSON.stringify(path)}`,
              )
            }
            if (slot.node.id !== id) {
              m.byId.delete(slot.node.id)
              slot.node.id = id
              m.byId.set(id, slot.node)
            }
            slot.node.row = row
            slot.node.pos = m.pos++
            m.dataCount++
          }
          parent = slot.node
          level = slot.next
        }
      }
    }
    return m
  }

  /* -------- incremental row operations -------- */

  const ensurePathMap = () => {
    const m = model!
    if (m.pathMap) return
    const map = new Map<string, TreeNode<R>>()
    const walk = (nodes: TreeNode<R>[], parentKey: string | null) => {
      for (const n of nodes) {
        const key = parentKey === null ? JSON.stringify(n.seg) : `${parentKey},${JSON.stringify(n.seg)}`
        n.pk = key
        map.set(key, n)
        walk(n.children, key)
      }
    }
    walk(m.roots, null)
    m.pathMap = map
  }

  const pathKeyOf = (path: string[]) => path.map((s) => JSON.stringify(s)).join(',')

  const syntheticIdOf = (node: TreeNode<R>) => {
    const path: string[] = []
    for (let n: TreeNode<R> | null = node; n; n = n.parent) path.push(n.seg!)
    return `tree:${JSON.stringify(path.reverse())}`
  }

  const insertBySeq = (list: TreeNode<R>[], node: TreeNode<R>) => {
    const last = list[list.length - 1]
    if (!last || last.seq < node.seq) return void list.push(node)
    let lo = 0
    let hi = list.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (list[mid]!.seq < node.seq) lo = mid + 1
      else hi = mid
    }
    list.splice(lo, 0, node)
  }

  const removeFromChildren = (node: TreeNode<R>) => {
    const list = node.parent ? node.parent.children : model!.roots
    let lo = 0
    let hi = list.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (list[mid]!.seq < node.seq) lo = mid + 1
      else hi = mid
    }
    const i = list[lo] === node ? lo : list.indexOf(node)
    if (i >= 0) list.splice(i, 1)
  }

  /** Structural placement of a row. Creates missing ancestors; returns the node that will hold the row. */
  const place = (
    row: R,
    id: RowId,
    keep: { seq: number; pos: number } | undefined,
    derived: boolean,
  ): { node: TreeNode<R>; existing: boolean } => {
    const m = model!
    const newAncestor = (n: TreeNode<R>) => {
      if (derived) n.k = computeKeys(n)
    }
    if (m.mode === 'flat') {
      const node = mk<R>(id, 'leaf', null, keep?.seq ?? m.seq++)
      insertBySeq(m.roots, node)
      m.byId.set(id, node)
      return { node, existing: false }
    }
    if (m.mode === 'group') {
      let parent: TreeNode<R> | null = null
      let parentId = 'group'
      for (const field of m.groupFields) {
        const raw = getValueOf(field, row)
        const gid = `${parentId}/${field}:${String(groupKey(raw))}`
        let g = m.byId.get(gid)
        if (!g) {
          g = mk<R>(gid, 'group', parent, m.seq++)
          g.groupField = field
          g.groupValue = raw
          ;(parent ? parent.children : m.roots).push(g)
          m.byId.set(gid, g)
          newAncestor(g)
        }
        parent = g
        parentId = gid
      }
      const node = mk<R>(id, 'leaf', parent, keep?.seq ?? m.seq++)
      insertBySeq(parent!.children, node)
      m.byId.set(id, node)
      return { node, existing: false }
    }
    ensurePathMap()
    const path = input.getTreeDataPath!(row)
    let parent: TreeNode<R> | null = null
    let key = ''
    let node: TreeNode<R> | undefined
    let existing = false
    for (let depth = 0; depth < path.length; depth++) {
      const seg = path[depth]!
      key = depth === 0 ? JSON.stringify(seg) : `${key},${JSON.stringify(seg)}`
      node = m.pathMap!.get(key)
      const last = depth === path.length - 1
      if (!node) {
        node = mk<R>('', 'group', parent, last && keep ? keep.seq : m.seq++)
        node.seg = seg
        node.pk = key
        node.id = last ? id : `tree:${JSON.stringify(path.slice(0, depth + 1))}`
        insertBySeq(parent ? parent.children : m.roots, node)
        m.byId.set(node.id, node)
        m.pathMap!.set(key, node)
        newAncestor(node)
      } else if (last) {
        if (node.row !== undefined) {
          throw new Error(
            `gridkit: rows "${String(node.id)}" and "${String(id)}" share the tree path ${JSON.stringify(path)}`,
          )
        }
        existing = true
      }
      parent = node
    }
    return { node: node!, existing }
  }

  const insertRow = (row: R, derived: boolean, keep?: { seq: number; pos: number }) => {
    const m = model!
    const id = input.getRowId(row)
    if (m.mode === 'tree' && !input.getTreeDataPath!(row).length) return // pathless rows are not shown
    const { node, existing } = place(row, id, keep, derived)
    const wasIn = derived && existing && node.count > 0
    if (wasIn) detach(node) // its keys change below
    if (node.id !== id) {
      m.byId.delete(node.id)
      node.id = id
      m.byId.set(id, node)
    }
    node.row = row
    node.pos = keep?.pos ?? m.pos++
    m.dataCount++
    if (!derived) return
    node.k = computeKeys(node)
    const self = !passes || passes(row) ? 1 : 0
    node.self = self as 0 | 1
    node.count += self
    m.total += self
    if (self && aggOn()) contribute(node.parent, valuesOfRow(row), 1)
    if (node.count > 0) attach(node)
    propagate(node.parent, self)
  }

  const removeRow = (id: RowId, derived: boolean) => {
    const m = model!
    const node = m.byId.get(id)
    if (!node || node.row === undefined) return
    if (m.mode === 'tree' && node.children.length) {
      // a tree row with descendants stays in the hierarchy as a plain group
      const wasIn = derived && node.count > 0
      if (wasIn) detach(node)
      const oldSelf = node.self
      if (derived && oldSelf && aggOn()) contribute(node.parent, valuesOfRow(node.row), -1)
      node.row = undefined
      m.byId.delete(id)
      node.id = syntheticIdOf(node)
      m.byId.set(node.id, node)
      m.dataCount--
      if (derived) {
        node.k = computeKeys(node)
        node.self = 0
        node.count -= oldSelf
        m.total -= oldSelf
        if (node.count > 0) attach(node)
        propagate(node.parent, -oldSelf)
      }
      return
    }
    if (derived) {
      const s = node.self
      if (s && aggOn()) contribute(node.parent, valuesOfRow(node.row), -1)
      if (node.count > 0) detach(node)
      node.count = 0
      node.self = 0
      m.total -= s
      propagate(node.parent, -s)
    }
    removeFromChildren(node)
    m.byId.delete(node.id)
    m.pathMap?.delete(node.pk ?? '')
    m.dataCount--
    // drop groups / synthetic ancestors that became empty
    for (let p = node.parent; p && p.row === undefined && p.children.length === 0; p = p.parent) {
      removeFromChildren(p)
      m.byId.delete(p.id)
      m.pathMap?.delete(p.pk ?? '')
    }
  }

  const sameStructure = (node: TreeNode<R>, row: R): boolean => {
    const m = model!
    if (m.mode === 'flat') return true
    if (m.mode === 'group') {
      let parentId = 'group'
      for (const field of m.groupFields) parentId = `${parentId}/${field}:${String(groupKey(getValueOf(field, row)))}`
      return node.parent?.id === parentId
    }
    return node.pk === pathKeyOf(input.getTreeDataPath!(row))
  }

  const updateRow = (node: TreeNode<R>, row: R, derived: boolean) => {
    const m = model!
    if (!sameStructure(node, row)) {
      const keep = { seq: node.seq, pos: node.pos }
      removeRow(node.id, derived)
      insertRow(row, derived, keep)
      return
    }
    if (!derived) {
      node.row = row
      return
    }
    const k = computeKeys(node, row)
    const self = (!passes || passes(row) ? 1 : 0) as 0 | 1
    if (aggOn()) {
      // aggregated values can change even when nothing else the views depend on did
      const before = node.self ? valuesOfRow(node.row!) : null
      const after = self ? valuesOfRow(row) : null
      if (!sameVals(before, after)) {
        if (before) contribute(node.parent, before, -1)
        if (after) contribute(node.parent, after, 1)
      }
    }
    if (self === node.self && keysEqual(node.k, k)) {
      node.row = row // nothing the views depend on changed: O(1)
      return
    }
    const wasIn = node.count > 0
    if (wasIn) detach(node)
    node.row = row
    node.k = k
    const delta = self - node.self
    node.self = self
    node.count += delta
    m.total += delta
    if (node.count > 0) attach(node)
    propagate(node.parent, delta)
  }

  /** Give every root a whole-number seq/pos again (after repeated moves between the same neighbours). */
  const renumberRoots = () => {
    const m = model!
    m.roots.forEach((n, i) => {
      n.seq = i
      n.pos = i
    })
    m.seq = m.roots.length
    m.pos = m.roots.length
  }

  /** Order the flat rows like `order` (rows not listed keep their relative order, after the listed ones). */
  const reorderRoots = (order: RowId[]) => {
    const m = model!
    if (m.mode !== 'flat') return
    const rank = new Map(order.map((id, i) => [id, i]))
    const listed = m.roots.filter((n) => rank.has(n.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
    const rest = m.roots.filter((n) => !rank.has(n.id))
    m.roots = [...listed, ...rest]
    renumberRoots()
  }

  /**
   * Put a row right before another (or last). Order among siblings is `seq`, so the row gets a seq between its
   * new neighbours (a fraction when needed), and `pos` follows so a later `rows` array in the new order is
   * recognised as "nothing changed".
   */
  const moveRow = (id: RowId, beforeId: RowId | null, derived: boolean) => {
    const m = model!
    if (m.mode !== 'flat') return
    const node = m.byId.get(id)
    if (!node || node.row === undefined) return
    const target = beforeId === null ? null : m.byId.get(beforeId)
    if (target === node || (beforeId !== null && (!target || target.row === undefined))) return

    for (let attempt = 0; attempt < 2; attempt++) {
      const others = m.roots // sorted by seq; `node` is in it, so skip it when looking at neighbours
      const at = target ? others.indexOf(target) : others.length
      let prev = at > 0 ? others[at - 1] : undefined
      if (prev === node) prev = at > 1 ? others[at - 2] : undefined
      if (!target && others[others.length - 1] === node) return // already last
      if (target && others[at - 1] === node) return // already right before the target
      const nextSeq = target ? target.seq : (prev ? prev.seq : 0) + 2
      const nextPos = target ? target.pos : (prev ? prev.pos : 0) + 2
      const seq = prev ? (prev.seq + nextSeq) / 2 : nextSeq - 1
      const pos = prev ? (prev.pos + nextPos) / 2 : nextPos - 1
      if (prev && (seq <= prev.seq || seq >= nextSeq || pos <= prev.pos || pos >= nextPos)) {
        renumberRoots() // no room left between these two: spread everything out and try again
        continue
      }
      const wasIn = derived && node.count > 0
      if (wasIn) detach(node) // by its old seq (the comparator breaks ties with it)
      removeFromChildren(node)
      node.seq = seq
      node.pos = pos
      // new rows take m.seq++ / m.pos++: keep the counters above every value in use, or a row added after
      // a move-to-end would land in the middle
      m.seq = Math.max(m.seq, Math.floor(seq) + 1)
      m.pos = Math.max(m.pos, Math.floor(pos) + 1)
      insertBySeq(m.roots, node)
      if (wasIn) attach(node)
      return
    }
  }

  const applyOps = (ops: RowChanges<R>, derived: boolean) => {
    const m = model!
    if (m.mode === 'tree') ensurePathMap()
    for (const id of ops.remove ?? []) removeRow(id, derived)
    const upsert = (row: R) => {
      const node = m.byId.get(input.getRowId(row))
      if (node && node.row !== undefined) updateRow(node, row, derived)
      else insertRow(row, derived)
    }
    for (const row of ops.update ?? []) upsert(row)
    for (const row of ops.insert ?? []) upsert(row)
    for (const mv of ops.move ?? []) moveRow(mv.id, mv.before, derived)
  }

  const opCount = (ops: RowChanges<R>) =>
    (ops.remove?.length ?? 0) + (ops.update?.length ?? 0) + (ops.insert?.length ?? 0) + (ops.move?.length ?? 0)
  const maxIncremental = () => Math.max(64, model!.dataCount >> 6)

  /**
   * Cheap diff for the common case: the new array is the old one with some objects replaced, a few
   * removed and/or new ones appended. It walks both arrays in step comparing object identity, so
   * unchanged rows cost one `===` (no id, no Map lookup). Returns null whenever the arrays don't
   * line up that way and the id-based diff (or a rebuild) should decide.
   */
  const alignedDiff = (next: R[]): RowChanges<R> | null => {
    const m = model!
    if (m.patched) return null // node rows may differ from the previous array: compare by id instead
    const prev = m.rowsProp as R[]
    const limit = maxIncremental()
    const update: R[] = []
    const remove: RowId[] = []
    let i = 0
    let j = 0
    while (i < prev.length && j < next.length) {
      const a = prev[i]!
      const b = next[j]!
      if (a === b) {
        i++
        j++
        continue
      }
      if (input.getRowId(a) === input.getRowId(b)) {
        update.push(b)
        i++
        j++
      } else {
        remove.push(input.getRowId(a)) // assume `a` was removed; verified below
        i++
      }
      if (update.length + remove.length > limit) return null
    }
    for (; i < prev.length; i++) remove.push(input.getRowId(prev[i]!))
    const insert: R[] = []
    const fresh = new Set<RowId>()
    const gone = new Set(remove)
    for (; j < next.length; j++) {
      const row = next[j]!
      const id = input.getRowId(row)
      // an "insert" whose id is still present means rows were reordered or inserted in the middle
      if (fresh.has(id) || (m.byId.get(id)?.row !== undefined && !gone.has(id))) return null
      fresh.add(id)
      insert.push(row)
      if (update.length + remove.length + insert.length > limit) return null
    }
    // a removed id that shows up again among the updates would mean a reorder
    if (remove.length && update.some((r) => gone.has(input.getRowId(r)))) return null
    return { remove, update, insert }
  }

  /** Compare a new `rows` array with the current rows; null when a rebuild is the better answer. */
  const diffRows = (next: R[]): RowChanges<R> | null => {
    const quick = alignedDiff(next)
    if (quick) return quick
    return idDiff(next)
  }

  const idDiff = (next: R[]): RowChanges<R> | null => {
    const m = model!
    const stamp = ++stampCounter
    const limit = maxIncremental()
    const update: R[] = []
    const insert: R[] = []
    let newIds: Set<RowId> | null = null
    let prevPos = -1
    let seen = 0
    for (let i = 0; i < next.length; i++) {
      const row = next[i]!
      const id = input.getRowId(row)
      const node = m.byId.get(id)
      if (node && node.row !== undefined) {
        // duplicate id, an insert before an existing row, or rows reordered: not worth patching
        if (node.mark === stamp || insert.length || node.pos < prevPos) return null
        prevPos = node.pos
        node.mark = stamp
        seen++
        if (node.row !== row) {
          update.push(row)
          if (update.length > limit) return null
        }
      } else {
        if (!newIds) newIds = new Set()
        if (newIds.has(id)) return null
        newIds.add(id)
        insert.push(row)
        if (insert.length > limit) return null
      }
    }
    const remove: RowId[] = []
    if (seen < m.dataCount) {
      for (const n of m.byId.values()) {
        if (n.row !== undefined && n.mark !== stamp) {
          remove.push(n.id)
          if (remove.length > limit) return null
        }
      }
    }
    if (update.length + insert.length + remove.length > limit) return null
    return { remove, update, insert }
  }

  /* -------- flatten -------- */

  const flatten = (): PipelineResult<R> => {
    const m = model!
    const hidden = input.hiddenIds
    let roots = m.kidsRoot
    let hiddenPassing = 0
    if (hidden && hidden.size) {
      roots = roots.filter((n) => !hidden.has(n.id))
      for (const id of hidden) if (m.byId.get(id)?.self) hiddenPassing++
    }
    let pageRoots = roots
    if (input.pagination) {
      const { page, pageSize } = input.pagination
      pageRoots = roots.slice(page * pageSize, page * pageSize + pageSize)
    }
    const expanded = input.expandedIds
    const all = input.expandAllByDefault
    const rows: RenderRow<R>[] = []
    const detailIds = input.detailIds
    const detailRows: { id: RowId; index: number }[] = []
    const pivotColumns = pivotColumnsNow() // before the walk: it decides which aggregates are reported
    // a pivot table shows the groups only: the deepest group level is where the rows end
    const lastLevel = m.groupFields.length - 1
    const walk = (nodes: TreeNode<R>[], depth: number) => {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]!
        const children = n.kids
        const hasKids = !!children && children.length > 0
        const expandable = hasKids && !(pivot && depth >= lastLevel)
        const open = expandable && (all ? !expanded.has(n.id) : expanded.has(n.id))
        const childCount = n.count - n.self
        let aggregates = hasKids && aggOn() ? finishAccs(ensureAccs(n), n) : undefined
        let rr = n.rr
        if (rr && shallowSame(rr.aggregates, aggregates)) aggregates = rr.aggregates // keep identity while values are unchanged
        // RenderRows are immutable: a new object only when something the UI shows has changed
        if (
          !rr ||
          rr.row !== n.row ||
          rr.depth !== depth ||
          rr.expanded !== open ||
          rr.expandable !== expandable ||
          rr.childCount !== childCount ||
          rr.aggregates !== aggregates
        ) {
          rr = n.rr = {
            id: n.id,
            type: n.type,
            depth,
            row: n.row,
            childCount,
            expandable,
            expanded: open,
            groupField: n.groupField,
            groupValue: n.groupValue,
            aggregates,
          }
        }
        if (detailIds && detailIds.size && n.row !== undefined && detailIds.has(n.id)) {
          detailRows.push({ id: n.id, index: rows.length })
        }
        rows.push(rr)
        if (open) walk(children!, depth + 1)
      }
    }
    walk(pivot && lastLevel < 0 ? [] : pageRoots, 0)

    let positions: Map<RowId, number> | null = null
    let expandableIds: RowId[] | null = null
    return {
      rows,
      rootCount: roots.length,
      filteredCount: m.total - hiddenPassing,
      get expandableIds() {
        if (!expandableIds) {
          expandableIds = []
          for (const n of m.byId.values()) if (n.kids?.length) expandableIds.push(n.id)
        }
        return expandableIds
      },
      getRow: (id) => m.byId.get(id)?.row,
      indexOf(id) {
        if (!positions) positions = new Map(rows.map((r, i) => [r.id, i]))
        return positions.get(id) ?? -1
      },
      getVisibleDataRows() {
        const out: R[] = []
        const visit = (nodes: TreeNode<R>[]) => {
          for (const n of nodes) {
            if (n.self && n.row !== undefined) out.push(n.row)
            if (n.kids) visit(n.kids)
          }
        }
        visit(m.kidsRoot)
        return out
      },
      getExportRows() {
        const out: RenderRow<R>[] = []
        const visit = (nodes: TreeNode<R>[], depth: number) => {
          for (const n of nodes) {
            const kids = n.kids
            const hasKids = !!kids && kids.length > 0
            const stop = !!pivot && depth >= lastLevel // the pivot's rows end at the deepest group level
            if (pivot && lastLevel < 0) return
            if (!pivot || hasKids) {
              out.push({
                id: n.id,
                type: n.type,
                depth,
                row: n.row,
                childCount: n.count - n.self,
                expandable: hasKids && !stop,
                expanded: true,
                groupField: n.groupField,
                groupValue: n.groupValue,
                aggregates: hasKids && aggOn() ? finishAccs(ensureAccs(n), n) : undefined,
              })
            }
            if (hasKids && !stop) visit(kids!, depth + 1)
          }
        }
        visit(m.kidsRoot, 0)
        return out
      },
      detailRows,
      dataIdAt: (index) => (m.mode === 'flat' ? m.roots[index]?.id : undefined),
      dataCount: m.mode === 'flat' ? m.roots.length : 0,
      dataIndexOf(id) {
        const node = m.byId.get(id)
        if (!node || m.mode !== 'flat') return -1
        let lo = 0
        let hi = m.roots.length
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if (m.roots[mid]!.seq < node.seq) lo = mid + 1
          else hi = mid
        }
        return m.roots[lo] === node ? lo : m.roots.indexOf(node)
      },
      pivotColumns,
      getTotals() {
        if (!aggOn()) return undefined
        const next = finishAccs(ensureRootAccs(), null)
        // same values: hand back the same object, so memoised rows showing the totals don't re-render
        if (lastTotals && shallowSame(lastTotals, next)) return lastTotals
        return (lastTotals = next)
      },
      getLeafIds(id) {
        const start = m.byId.get(id)
        if (!start) return []
        const out: RowId[] = []
        const stack = [start]
        while (stack.length) {
          const n = stack.pop()!
          if (n.self) out.push(n.id)
          if (n.kids) for (const k of n.kids) stack.push(k)
        }
        return out
      },
    }
  }

  /* -------- run -------- */

  const run = ((inp: PipelineInput<R>): PipelineResult<R> => {
    input = inp
    const cols = inp.columns
    if (cols !== lastColumns) {
      lastColumns = cols
      byField = new Map(cols.map((c) => [c.field, c]))
      getters = new Map(cols.map((c) => [c.field, (row: R) => getCellValue(c, row)]))
    }

    let changed = false
    let kind: UpdateKind = 'none'
    // models are compared by content, so passing a fresh literal on every render costs nothing
    const nextStruct = [!!inp.getTreeDataPath, inp.rowGroupingModel.join('\u0000'), cols]
    let rebuild = !model || !same(structDeps, nextStruct)

    // new `rows` from the owner wins over anything done imperatively
    const propsChanged = model !== null && inp.rows !== model.rowsProp
    if (propsChanged) {
      overlay.upsert.clear()
      overlay.remove.clear()
      overlay.moved = false
      queue = []
    }

    // queued patches are recorded first, so they survive even a rebuild in this same run. They are applied
    // one after the other, in the order they arrived: "move X to the end" then "insert Y" must stay that way.
    let queued: RowChanges<R>[] = []
    if (queue.length) {
      queued = queue
      for (const q of queue) {
        if (q.move?.length) overlay.moved = true
        for (const id of q.remove ?? []) {
          overlay.remove.add(id)
          overlay.upsert.delete(id)
        }
        for (const row of [...(q.update ?? []), ...(q.insert ?? [])]) {
          const id = inp.getRowId(row)
          // a removal stays recorded even if the row is added back: replayed in order, the row then
          // lands at the end instead of in its old place, like it did the first time
          overlay.upsert.set(id, row)
        }
      }
      queue = []
    }

    let opsList: RowChanges<R>[] = []
    let carryOrder: RowId[] | null = null
    if (!rebuild) {
      if (propsChanged) {
        const diff = diffRows(inp.rows)
        if (!diff) rebuild = true
        else {
          opsList = [diff]
          model!.rowsProp = inp.rows
          model!.patched = false
        }
      } else if (queued.length) {
        opsList = queued
        model!.patched = true
      }
    }

    if (rebuild) {
      structDeps = nextStruct
      queue = []
      // rows moved by hand: remember their order before the old hierarchy is thrown away
      if (overlay.moved && !propsChanged && model && model.mode === 'flat') carryOrder = model.roots.map((n) => n.id)
      model = buildModel()
      derivedOk = false
      keysValid = false
      changed = true
      kind = 'rebuild'
      opsList = []
      if (overlay.upsert.size || overlay.remove.size) {
        // rebuilt for a structural reason while edits exist: put them back on the fresh hierarchy
        opsList = [{ remove: [...overlay.remove], update: [...overlay.upsert.values()], insert: [] }]
        model.patched = true
      }
    }

    // the aggregation plan must be current before rows are patched, so deltas use the right columns
    const nextAggDeps = [JSON.stringify(inp.pivot ?? inp.aggregationModel ?? {}), inp.pivot !== undefined, inp.aggregationFunctions, cols]
    const aggDirty = !same(aggDeps, nextAggDeps)
    if (aggDirty) {
      pivot = inp.pivot
      aggItems = makeAggItems()
      aggDeps = nextAggDeps
    }

    const nextFilterDeps = [JSON.stringify(inp.filterModel), cols]
    const filterDirty = !derivedOk || !same(filterDeps, nextFilterDeps)
    const nextSortDeps = [inp.sortModel.map((x) => `${x.field}:${x.direction}`).join('|'), cols]
    const sortDirty = filterDirty || !same(sortDeps, nextSortDeps)

    const totalOps = opsList.reduce((n, o) => n + opCount(o), 0)
    if (totalOps > 0 || carryOrder) {
      const derived = !filterDirty && !sortDirty && !aggDirty && totalOps <= maxIncremental()
      try {
        for (const o of opsList) applyOps(o, derived)
        if (carryOrder) reorderRoots(carryOrder)
      } catch (e) {
        model = null // a partial update is not trustworthy: rebuild on the next run
        structDeps = []
        overlay.upsert.clear() // and don't replay the change that failed
        overlay.remove.clear()
        overlay.moved = false
        throw e
      }
      if (!derived) {
        derivedOk = false
        keysValid = false
      }
      changed = true
      if (kind === 'none') kind = 'incremental'
    }

    if (!derivedOk || filterDirty) {
      filterDeps = nextFilterDeps
      passes = createRowFilter(inp.filterModel, cols)
      if (!same(sortDeps, nextSortDeps)) keysValid = false
      plan = makePlan(inp.sortModel, byField)
      rawCmps.clear()
      fullFilter()
      fullSort()
      sortDeps = nextSortDeps
      derivedOk = true
      changed = true
    } else if (sortDirty) {
      keysValid = false
      plan = makePlan(inp.sortModel, byField)
      rawCmps.clear()
      fullSort()
      sortDeps = nextSortDeps
      changed = true
    } else if (aggDirty) {
      fullFilter() // counts and kids are unchanged; this only rebuilds the totals
      changed = true
    }

    if (changed) version++
    const nextFlat = [version, inp.expandedIds, inp.expandAllByDefault, inp.pagination?.page, inp.pagination?.pageSize, inp.hiddenIds, inp.detailIds]
    if (!result || !same(flatDeps, nextFlat)) {
      flatDeps = nextFlat
      result = flatten()
    }
    lastUpdate = kind
    return result
  }) as Pipeline<R>

  run.patch = (changes) => {
    queue.push(changes)
  }
  Object.defineProperty(run, 'lastUpdate', { get: () => lastUpdate })
  return run
}
