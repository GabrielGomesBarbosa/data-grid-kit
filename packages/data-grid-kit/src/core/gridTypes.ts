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
import type { CellRef, ColumnDef, Density, EditStopReason, FilterModel, GridOptions, GridState, PinSide, PivotModel, RenderRow, RowId, SortItem } from './types'

/** What a bulk cell change (paste, fill, delete) did. */
export interface ApplyResult {
  /** cells written */
  applied: number
  /** cells left alone: not editable, nothing to change, or text that doesn't fit the column */
  skipped: number
  /** cells whose row was refused by processRowUpdate */
  rejected: number
}

/** Where a row or column ends up when it is scrolled to: the nearest edge only if it is not in view, or the start, middle or end of the viewport. */
export type ScrollAlign = 'nearest' | 'start' | 'center' | 'end'
/** Scrolls the element of the renderer to a row and / or a column, by position (the built-in `Grid` registers one). */
export type ScrollHandler = (target: { rowIndex?: number; colIndex?: number; align: ScrollAlign }) => void

/** What `autosizeColumns` measures and how. */
export interface AutosizeOptions {
  /** the fields to fit (default: every visible column) */
  columns?: string[]
  /** count the header title (default true) */
  includeHeaders?: boolean
  /** let unusually wide values count too (default false: the widest ordinary value wins) */
  includeOutliers?: boolean
  /** how far past the middle half of the widths a value must be to be an outlier (default 1.5) */
  outliersFactor?: number
  /** after fitting, share a spare edge of the grid among the fitted columns (default false) */
  expand?: boolean
}
/** Measures the natural width of columns in whatever markup draws them: the built-in `Grid` registers one. */
export type ColumnMeasurer = (fields: string[], options: { includeHeaders: boolean; includeOutliers: boolean; outliersFactor: number }) => Record<string, number>

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
  /**
   * Fit columns to what they show (the header and the cells that are rendered: rows scrolled out of view are not measured), within each
   * column's `minWidth` / `maxWidth`. Returns the widths it set. Does nothing without a renderer that measures (the `Grid` does).
   */
  autosizeColumns(options?: AutosizeOptions): Record<string, number>
  /** register how columns are measured (the built-in `Grid` does it for you; `null` removes it) */
  setColumnMeasurer(measure: ColumnMeasurer | null): void
  /** the arrangement of the grid (sorting, filters, page, columns, grouping, aggregation, pivot, density, expansion, pinning) as plain data, to save */
  exportState(): Partial<GridState>
  /** bring back what `exportState` gave (or part of it); other keys are ignored. The same shape works as `initialState`. */
  restoreState(state: Partial<GridState>): void
  /** how tight the rows are (scales `rowHeight` and `headerHeight`; rows sized by `getRowHeight` keep their own height) */
  setDensity(density: Density): void
  /**
   * Scroll to a row and / or a column by position: `rowIndex` is among the rows of the current page, `colIndex` among the visible
   * columns. Takes the header, pinned columns and rows, per-row heights and open detail panels into account. Returns false when
   * there is nothing to scroll to (or no renderer).
   */
  scrollToIndexes(target: { rowIndex?: number; colIndex?: number; align?: ScrollAlign }): boolean
  scrollToRow(id: RowId, align?: ScrollAlign): boolean
  scrollToColumn(field: string, align?: ScrollAlign): boolean
  scrollToCell(id: RowId, field: string, align?: ScrollAlign): boolean
  /** register how the grid scrolls (the built-in `Grid` does it for you; `null` removes it) */
  setScrollHandler(handler: ScrollHandler | null): void
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
  /** select or unselect a row (a group: its rows); rows `isRowSelectable` refuses are skipped; with `multipleRowSelection: false` selecting replaces */
  toggleSelection(id: RowId, selected?: boolean): void
  /** replace the selection (rows that cannot be selected are dropped; with `multipleRowSelection: false` only the first stays) */
  setSelection(ids: RowId[]): void
  /** select every row that passes the filters, across pages (not with `multipleRowSelection: false`) */
  selectAll(): void
  /** whether `isRowSelectable` allows this row (a group, or a row that is not loaded, counts as selectable) */
  isRowSelectable(id: RowId): boolean
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
  /** extend `source` to `to` (the fill handle): the cells repeat; with the `fillSeries` option, numbers a constant step apart continue as a series (unless `repeat` is set) */
  fillCells(source: RangeRect, to: { row: number; col: number }, options?: { repeat?: boolean }): Promise<ApplyResult>
  /** fill the selected cells from their first row (`'down'`) or first column (`'right'`), like Ctrl+D / Ctrl+R in a spreadsheet; one cell takes the one above / to the left */
  fillSelection(direction: 'down' | 'right'): Promise<ApplyResult>
  /** true when the cell can be edited (column editable, data row, `isCellEditable` agrees) */
  isCellEditable(rowId: RowId, field: string): boolean
  /** enter edit mode; `seed` replaces the value with typed text. Returns false if not editable. */
  startEdit(rowId: RowId, field: string, seed?: string): boolean
  /** stop editing without saving (`reason` is told to `onCellEditStop` / `onRowEditStop`) */
  cancelEdit(reason?: EditStopReason): void
  /** apply the edited value through `valueSetter` / `processRowUpdate`. Resolves false if rejected. */
  commitEdit(value: unknown, reason?: EditStopReason): Promise<boolean>
  /** in `editMode: 'row'`: edit every editable cell of a row; `field` is the one to focus. false when nothing in the row can be edited. */
  startRowEdit(rowId: RowId, field?: string): boolean
  /** record what is typed in a cell being edited (checks it with the column's `validate`; in row mode it is kept until the row is saved) */
  setEditValue(field: string, value: unknown): void
  /** save the row being edited with what was typed; false (and the row stays open) when `validate` refuses a value or saving fails */
  commitRowEdit(reason?: EditStopReason): Promise<boolean>
  cancelRowEdit(reason?: EditStopReason): void
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
