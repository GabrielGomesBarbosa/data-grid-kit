import type { PipelineResult } from './pipeline'
import type { ServerTree } from './serverTree'
import type { RenderRow, RowId } from './types'

export interface TreeResultInput {
  getRowId: (row: any) => RowId
  isExpanded: (id: RowId) => boolean
  /** the grouping model: the level `depth` of rows is grouped by `groupFields[depth]` (empty for tree data) */
  groupFields: string[]
  /** fields shown on rows that have children, with the function the server uses */
  aggregationModel?: Record<string, string>
}

const NO_IDS: RowId[] = []
const known = new WeakMap<object, RenderRow<any>>()
const sameAggregates = (a?: Record<string, unknown>, b?: Record<string, unknown>) => {
  if (a === b) return true
  if (!a || !b) return false
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => Object.is(a[k], b[k]))
}

/**
 * The server tree as the grid expects rows: one slot per row of the whole list (a level that is open, with its rows between its
 * parent and the parent's next sibling), `undefined` where a block has not arrived (drawn as a skeleton row). A row with
 * children is a real row that can be expanded, like tree data; the server's `getAggregatedValue` fills its aggregates.
 */
export function buildTreeResult<R>(tree: ServerTree<R>, input: TreeResultInput): PipelineResult<R> {
  const { segments, total } = tree.segments()
  const source = tree.source()
  const rows: RenderRow<R>[] = new Array(total)
  const expandable: RowId[] = []
  const model = input.aggregationModel && Object.keys(input.aggregationModel).length ? input.aggregationModel : undefined

  const renderRow = (row: R, depth: number): RenderRow<R> => {
    const id = input.getRowId(row)
    const count = source?.getChildrenCount?.(row) ?? 0
    const canOpen = count !== 0
    const open = canOpen && input.isExpanded(id)
    let aggregates: Record<string, unknown> | undefined
    if (canOpen && model && source?.getAggregatedValue) {
      aggregates = {}
      for (const field of Object.keys(model)) aggregates[field] = source.getAggregatedValue(row, field)
    }
    const groupField = canOpen ? input.groupFields[depth] : undefined
    const before = known.get(row as object)
    if (before && before.depth === depth && before.expanded === open && before.expandable === canOpen && before.childCount === Math.max(count, 0) && before.groupField === groupField && sameAggregates(before.aggregates, aggregates)) {
      return before
    }
    const rr: RenderRow<R> = { id, type: 'leaf', depth, row, childCount: Math.max(count, 0), expandable: canOpen, expanded: open, groupField, aggregates }
    known.set(row as object, rr)
    return rr
  }

  for (const s of segments) {
    s.node.ctrl.forEachLoaded((pos, row) => {
      if (pos < s.from || pos >= s.to) return
      const rr = renderRow(row, s.node.depth)
      rows[s.start + pos - s.from] = rr
      if (rr.expandable) expandable.push(rr.id)
    })
  }

  const ordered = () => {
    const out: RenderRow<R>[] = []
    for (const r of rows) if (r) out.push(r)
    return out
  }
  const snap = tree.snapshot()
  return {
    rows,
    rootCount: total,
    filteredCount: snap.rowCount >= 0 ? snap.rowCount : snap.loadedEnd,
    expandableIds: expandable,
    detailRows: [],
    getRow(id) {
      const at = tree.indexOfId(id)
      return at >= 0 ? rows[at]?.row : undefined
    },
    indexOf: (id) => tree.indexOfId(id),
    getLeafIds: (id) => (tree.indexOfId(id) >= 0 ? [id] : NO_IDS),
    getVisibleDataRows: () => ordered().flatMap((r) => (r.row === undefined ? [] : [r.row])),
    getExportRows: ordered, // only what has been loaded can be exported
    dataIndexOf: () => -1,
    dataIdAt: () => undefined,
    dataCount: 0,
    getTotals: () => undefined,
    pivotColumns: [],
  }
}
