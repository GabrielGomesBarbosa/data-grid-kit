import type { CsvOptions } from './csv'
import type { DropPlacement } from './reorder'
import type { RowGeometry } from './geometry'
import type { ColumnLayout, Range } from './layout'
import type { PipelineResult, PivotColumn, RowChanges } from './pipeline'
import type { CellPoint, CellRange, RangeRect } from './range'
import type { XlsxExportOptions } from './xlsxExport'
import type { DataSourceError, DataSourceSnapshot } from './dataSource'
import type { GridLocaleText } from './localeText'
import type { Store } from './store'
import type { CellRef, ColumnDef, FilterModel, GridOptions, GridState, PinSide, PivotModel, RenderRow, RowId, SortItem } from './types'

/** What a bulk cell change (paste, fill, delete) did. */
export interface ApplyResult {
  /** cells written */
  applied: number
  /** cells left alone: not editable, nothing to change, or text that doesn't fit the column */
  skipped: number
  /** cells whose row was refused by processRowUpdate */
  rejected: number
}

export interface GridApi<R = any> {
  store: Store<GridState>
  setSortModel(model: SortItem[]): void
  /** click-style toggle: none → asc → desc → none. `multi` keeps other sorted columns. */
  toggleSort(field: string, multi?: boolean): void
  setFilterModel(model: FilterModel): void
  setQuickFilter(text: string): void
  setPage(page: number): void
  setPageSize(size: number): void
  pinColumn(field: string, side: PinSide | null): void
  setColumnWidth(field: string, width: number): void
  setColumnVisibility(field: string, visible: boolean): void
  /** replace the visibility of every column at once (`{}` goes back to each column's own `hidden`); every column may be hidden */
  setColumnVisibilityModel(model: Record<string, boolean>): void
  moveColumn(field: string, toIndex: number): void
  /** move a column next to another one in the same group (pinned left / scrolling / pinned right) */
  reorderColumn(field: string, target: string, placement: DropPlacement): boolean
  /** keep a row visible above or below the scrolling rows (null unpins). Ignored with grouping / tree data. */
  pinRow(id: RowId, side: 'top' | 'bottom' | null): void
  /** open, close or toggle the detail panel under a row (needs `detailPanelHeight`) */
  toggleDetailPanel(id: RowId, open?: boolean): void
  setDetailPanelExpanded(ids: RowId[]): void
  /** the measured height of an 'auto' panel; the grid calls this itself */
  setDetailPanelHeight(id: RowId, height: number): void
  /**
   * Move a row in the data order: before another row (null = to the end) or after one. Flat grids only.
   * Returns false when nothing moved. Calls `onRowOrderChange`.
   */
  moveRow(id: RowId, to: { before: RowId | null } | { after: RowId }): boolean
  /** would `moveRow` do something? (no side effects) */
  canMoveRow(id: RowId, to: { before: RowId | null } | { after: RowId }): boolean
  /** choose how a column is aggregated ('sum', 'avg', …, or a custom name); null removes it */
  setAggregation(field: string, name: string | null): void
  setAggregationModel(model: Record<string, string>): void
  /** turn pivot mode on or off (needs the `pivoting` option) */
  setPivotMode(on: boolean): void
  /** what the pivot table is made of; a function gets the current model */
  setPivotModel(model: PivotModel | ((current: PivotModel) => PivotModel)): void
  /** shift a column one place left or right inside its group; false at the edge */
  moveColumnBy(field: string, delta: -1 | 1): boolean
  setRowGroupingModel(fields: string[]): void
  toggleExpanded(id: RowId): void
  expandAll(): void
  collapseAll(): void
  toggleSelection(id: RowId, selected?: boolean): void
  clearSelection(): void
  setScroll(top: number, left: number): void
  setViewport(width: number, height: number): void
  focusCell(cell: CellRef | null): void
  /** select a block of cells; `add` keeps the existing ranges (Ctrl/Cmd+click) */
  selectCells(range: CellRange, options?: { add?: boolean }): void
  /** move the free end of the active range (starting one at the focused cell if there is none) */
  extendCellSelection(focus: CellPoint): void
  clearCellSelection(): void
  /** the selected ranges as index rectangles over the current rows and columns */
  getCellRects(): RangeRect[]
  /** tab-separated text of the active range (or the selected rows, or the focused cell) */
  copySelection(): string
  /** paste tab-separated text at the active range / focused cell */
  pasteText(text: string): Promise<ApplyResult>
  /** clear the editable cells of the selection (what Delete and cut do) */
  clearSelectedCells(): Promise<ApplyResult>
  /** write values to cells, going through valueSetter and processRowUpdate once per row */
  applyCellValues(changes: { rowId: RowId; field: string; value: unknown }[]): Promise<ApplyResult>
  /** repeat the source block's pattern over the cells between it and (row, col) */
  fillCells(source: RangeRect, to: { row: number; col: number }): Promise<ApplyResult>
  /** true when the cell can be edited (column editable, data row, `isCellEditable` agrees) */
  isCellEditable(rowId: RowId, field: string): boolean
  /** enter edit mode; `seed` replaces the value with typed text. Returns false if not editable. */
  startEdit(rowId: RowId, field: string, seed?: string): boolean
  cancelEdit(): void
  /** apply the edited value through `valueSetter` / `processRowUpdate`. Resolves false if rejected. */
  commitEdit(value: unknown): Promise<boolean>
  /**
   * Insert, update or remove rows without rebuilding the grid: only the sort/filter/group nodes on the
   * changed rows' paths are touched. Upsert semantics: `insert` and `update` both replace a row whose id
   * exists and add one that doesn't. Kept until the `rows` prop gets a new identity.
   */
  updateRows(changes: RowChanges<R>): void
  /** Server data: forget everything and fetch again (the rows on screen stay until the new ones arrive). */
  refreshData(): void
  /** Server data: what the data source is doing right now, or null without a `dataSource` */
  getDataSourceState(): DataSourceSnapshot | null
  /** CSV of every row passing the filter, in current order, using visible columns */
  getCsv(options?: CsvOptions & { selectedOnly?: boolean }): string
  /** the grid as an .xlsx file (bytes): visible columns, rows as filtered and sorted, group rows with aggregates */
  getXlsx(options?: XlsxExportOptions): Promise<Uint8Array>
  /** download the grid as an .xlsx file */
  exportXlsx(options?: XlsxExportOptions): Promise<void>
}

export interface ServerInfo {
  /** rows form a tree loaded level by level (the source has `getChildrenCount`) */
  tree: boolean
  /** 'pages' (paginated) or 'lazy' (positions that load as you scroll) */
  mode: 'pages' | 'lazy'
  /** rows in the data set; -1 until the server says */
  rowCount: number
  /** with an unknown row count: is there more beyond what has loaded? */
  hasNextPage: boolean
  /** rows in view are being fetched */
  loading: boolean
  error: DataSourceError | null
  /** rows loaded so far */
  loadedEnd: number
}

/** pivot mode, while it is on */
export interface PivotInfo {
  /** the value columns that exist for the current data */
  columns: PivotColumn[]
  /** pivot column field → aggregation function */
  aggNames: Record<string, string>
  /** the columns the pivot panel offers: the real ones plus the derived ones */
  sourceColumns: ColumnDef<any>[]
}

export interface GridInstance<R = any> {
  api: GridApi<R>
  options: GridOptions<R>
  /** the texts the grid shows: the defaults with `options.localeText` on top */
  text: GridLocaleText
  /** `options.locale` */
  locale: string | undefined
  rowHeight: number
  /** for renderers that size rows by their content: tell the grid what `'auto'` rows measured (row positions follow) */
  reportRowHeights: (heights: ReadonlyMap<RowId, number>) => void
  /** the whole header: `headerRowHeight` for the titles plus one row per level of column groups */
  headerHeight: number
  headerRowHeight: number
  /** rows of column groups above the titles (0 without pivot columns) */
  headerDepth: number
  /** set while pivot mode is on */
  pivot: PivotInfo | null
  layout: ColumnLayout<R>
  result: PipelineResult<R>
  /** rows of the current page after filter/sort/grouping/expansion */
  rows: RenderRow<R>[]
  rowRange: Range
  colRange: Range
  /** where each row sits vertically, with the open detail panels between rows */
  geometry: RowGeometry
  /** open detail panels, top to bottom */
  detailSlots: { id: RowId; index: number; height: number; auto: boolean }[]
  /** which of `detailSlots` are near the viewport: [start, end) */
  detailRange: Range
  /** dragging rows is possible right now: enabled, flat, not sorted, nothing being edited */
  reorderAllowed: boolean
  /** server-side data only: the state of the data source */
  server: ServerInfo | null
  /** the total row (aggregates over every row passing the filter), or null */
  footer: RenderRow<R> | null
  /** pinned rows that currently exist, in pin order (empty when grouping or tree data is on) */
  pinnedTop: RenderRow<R>[]
  pinnedBottom: RenderRow<R>[]
  state: GridState
  isSelected(row: RenderRow<R>): boolean | 'indeterminate'
}
