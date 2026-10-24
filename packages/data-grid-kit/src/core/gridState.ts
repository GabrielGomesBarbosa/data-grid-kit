import { EMPTY_PIVOT, type GridOptions, type GridState } from './types'

export function defaultState<R>(options: GridOptions<R>): GridState {
  const init = options.initialState ?? {}
  return {
    sortModel: [],
    filterModel: { items: [] },
    paginationModel: { page: 0, pageSize: 100 },
    selection: [],
    columnOrder: options.columns.map((c) => c.field),
    columnWidths: {},
    columnVisibility: {},
    pinnedColumns: { left: [], right: [] },
    rowGroupingModel: [],
    expandedIds: [],
    expandAllByDefault: false,
    pinnedRows: { top: [], bottom: [] },
    aggregationModel: {},
    pivotMode: false,
    pivotModel: EMPTY_PIVOT,
    detailPanelExpanded: [],
    detailHeights: {},
    cellSelection: [],
    focusedCell: null,
    editingCell: null,
    scroll: { top: 0, left: 0 },
    viewport: { width: 800, height: 400 },
    ...init,
  }
}
