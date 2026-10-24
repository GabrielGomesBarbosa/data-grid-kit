import { type AggAcc } from '../aggregation'
import { type ColumnDef, type RenderRow, type RowId, type SortItem } from '../types'
import { compareValues } from '../values'

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

export interface Model<R> {
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

export interface SortPlan<R> {
  fields: string[]
  dirs: number[]
  cmps: ((a: unknown, b: unknown) => number)[]
  /** true when the column uses the default comparator, so two numbers can be subtracted directly */
  fast: boolean[]
  cols: ColumnDef<R>[]
  allIdx: number[]
  byGroupField: Map<string, number[]>
}

export const NO_ITEMS: number[] = []

export function makePlan<R>(sortModel: SortItem[], byField: Map<string, ColumnDef<R>>): SortPlan<R> {
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

export function same(a: readonly unknown[], b: readonly unknown[]) {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
}

export const groupKey = (raw: unknown) => (raw instanceof Date ? raw.getTime() : (raw ?? null))

export function mk<R>(id: RowId, type: 'leaf' | 'group', parent: TreeNode<R> | null, seq: number, pos = -1): TreeNode<R> {
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
