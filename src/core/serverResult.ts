import type { DataSourceController } from './dataSource'
import type { PipelineResult } from './pipeline'
import type { RenderRow, RowId } from './types'

export interface ServerResultInput {
  /** 'pages': one page at a time, like a paginated grid. 'lazy': every row is a position; the gaps load as you scroll. */
  mode: 'pages' | 'lazy'
  page: number
  pageSize: number
  detailIds?: ReadonlySet<RowId>
}

const renderRows = new WeakMap<object, RenderRow<any>>()
const NO_IDS: RowId[] = []

/**
 * Presents the controller's sparse blocks the way the grid expects rows: an array with one slot per row of the
 * page (or of the whole data set), where a slot is `undefined` until its block has arrived. The grid draws those
 * gaps as skeleton rows, so nothing is allocated for rows that haven't loaded.
 */
export function buildServerResult<R>(ctrl: DataSourceController<R>, getRowId: (row: R) => RowId, input: ServerResultInput): PipelineResult<R> {
  const snap = ctrl.snapshot()
  const known = snap.rowCount >= 0
  const { mode, page, pageSize } = input

  let start = 0
  let length: number
  let total: number // what the pager counts
  if (mode === 'pages') {
    start = page * pageSize
    if (known) length = Math.max(0, Math.min(pageSize, snap.rowCount - start))
    else if (snap.loadedEnd > start) length = Math.min(pageSize, snap.loadedEnd - start)
    else length = snap.hasNextPage ? pageSize : 0 // nothing here yet: skeletons, unless we already know the data ended
    // an unknown count: one more row than we have loaded tells the pager there is another page
    total = known ? snap.rowCount : snap.loadedEnd + (snap.hasNextPage ? 1 : 0)
  } else {
    length = known ? snap.rowCount : snap.loadedEnd + (snap.hasNextPage ? snap.chunkSize : 0)
    total = length
  }

  const rows: RenderRow<R>[] = new Array(length)
  ctrl.forEachLoaded((pos, row) => {
    const i = pos - start
    if (i < 0 || i >= length) return
    let rr = renderRows.get(row as object) as RenderRow<R> | undefined
    if (!rr) {
      rr = { id: getRowId(row), type: 'leaf', depth: 0, row, childCount: 0, expandable: false, expanded: false }
      renderRows.set(row as object, rr)
    }
    rows[i] = rr
  })

  const indexOf = (id: RowId) => {
    const pos = ctrl.indexOfId(id)
    const i = pos - start
    return pos >= 0 && i >= 0 && i < length ? i : -1
  }

  const detailRows: { id: RowId; index: number }[] = []
  if (input.detailIds?.size) {
    for (const id of input.detailIds) {
      const index = indexOf(id)
      if (index >= 0 && rows[index]) detailRows.push({ id, index })
    }
    detailRows.sort((a, b) => a.index - b.index)
  }

  return {
    rows,
    rootCount: total,
    filteredCount: known ? snap.rowCount : snap.loadedEnd,
    expandableIds: NO_IDS,
    detailRows,
    getRow(id) {
      const pos = ctrl.indexOfId(id)
      return pos >= 0 ? ctrl.rowAt(pos) : undefined
    },
    indexOf,
    getLeafIds: (id) => (indexOf(id) >= 0 ? [id] : NO_IDS),
    getVisibleDataRows() {
      const out: { pos: number; row: R }[] = []
      ctrl.forEachLoaded((pos, row) => out.push({ pos, row }))
      return out.sort((a, b) => a.pos - b.pos).map((x) => x.row)
    },
    // only what has been loaded can be exported
    getExportRows() {
      const out: { pos: number; row: R }[] = []
      ctrl.forEachLoaded((pos, row) => out.push({ pos, row }))
      return out.sort((a, b) => a.pos - b.pos).map(({ row }) => ({ id: getRowId(row), type: 'leaf' as const, depth: 0, row, childCount: 0, expandable: false, expanded: false }))
    },
    // the server owns the order: there is no client-side data order to move rows in
    dataIndexOf: () => -1,
    dataIdAt: () => undefined,
    dataCount: 0,
    getTotals: () => undefined,
    pivotColumns: [],
  }
}
