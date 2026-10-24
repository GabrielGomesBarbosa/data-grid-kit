import type { GridLocaleText } from './localeText'
export type RowId = string | number

/** why an edit ended: Enter, Tab, Escape (cancels), focus or a click leaving the cell / row, or a call to the API */
export type EditStopReason = 'enter' | 'tab' | 'escape' | 'blur' | 'api'

export type SortDirection = 'asc' | 'desc'
export interface SortItem {
  field: string
  direction: SortDirection
}

export type FilterOperator =
  | 'contains'
  | 'equals'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'doesNotContain'
  | 'notEquals'
  /** the value is a list (an array, or text with commas) and the cell matches any of them */
  | 'isAnyOf'

export interface FilterItem {
  field: string
  /** one of the built-in operators, or the `value` of one of the column's own `filterOperators` */
  operator: FilterOperator | (string & Record<never, never>)
  value?: unknown
}

/** An operator a column brings of its own (`ColumnDef.filterOperators`). Without `getApplyFilterFn` the built-in logic of `value` is used. */
export interface FilterOperatorDef<R = any> {
  value: string
  label: string
  /** false for operators with no operand (like "is empty"): the value input is hidden. Default true. */
  needsValue?: boolean
  /** The test for a filter item: `null` when the item is not complete yet (no filtering). Gets the cell's value and the row. */
  getApplyFilterFn?: (item: FilterItem, col: ColumnDef<R>) => ((value: unknown, row: R) => boolean) | null
}

export interface FilterModel {
  items: FilterItem[]
  /** how multiple items combine; default 'and' */
  logic?: 'and' | 'or'
  /** case-insensitive search across every column */
  quickFilter?: string
}

export interface PaginationModel {
  page: number
  pageSize: number
}

export type PinSide = 'left' | 'right'
export interface PinnedColumns {
  left: string[]
  right: string[]
}

import type { CellRange } from './range'
import type { DataSource, DataSourceCache, DataSourceError } from './dataSource'

/**
 * `dateTime`: a `Date` with its time (shown with date and time, edited with a date-time input).
 * `actions`: no data, a column of buttons (see `getActions` on `UIColumnDef`): not sorted, filtered, edited, grouped, aggregated or exported.
 */
export type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'dateTime' | 'singleSelect' | 'actions'

export interface CellRef {
  rowId: RowId
  field: string
  /** text that started the edit (typing over a cell replaces its value) */
  seed?: string
}

/** A user-defined aggregation. It receives every value in the group (recomputed when data changes). */
export interface CustomAggregation<R = any> {
  label?: string
  /** column types it can be applied to (default: all) */
  columnTypes?: ColumnType[]
  apply(params: { values: unknown[]; rows: R[] }): unknown
}

export interface ColumnDef<R = any> {
  field: string
  /** header groups above this column, outermost first. Adjacent columns sharing a prefix share the group cell. */
  group?: string[]
  /** set on the columns pivot mode generates: this column shows one aggregate of `valueField` */
  pivot?: { valueField: string; aggFunc: string; total: boolean }
  /** can be aggregated (default true; the available functions depend on the column type) */
  aggregable?: boolean
  /** restrict the aggregation functions offered for this column */
  availableAggregationFunctions?: string[]
  /** drives default alignment, filter operators, editor and CSV formatting */
  type?: ColumnType
  editable?: boolean
  /**
   * Checked while the cell is edited and again when it is saved: return a message to refuse the value (it is shown on the editor and the edit
   * stays open), or nothing / `null` when it is fine. May return a promise (a check on the server). Gets the value being typed and the row.
   */
  validate?: (params: { value: unknown; row: R; field: string }) => string | null | undefined | void | Promise<string | null | undefined | void>
  /**
   * How this column takes part in the quick filter: `false` leaves it out; a function decides for a term (already lower-cased, and
   * without accents with `ignoreDiacritics`) whether the cell matches it. Default: the column's text contains the term.
   */
  quickFilter?: boolean | ((params: { term: string; value: unknown; row: R }) => boolean)
  /** replaces the operators the filter panel offers for this column (spread `getFilterOperators(col)` to extend them) */
  filterOperators?: FilterOperatorDef<R>[]
  /** options for `singleSelect` columns */
  valueOptions?: (string | number | { value: string | number; label: string })[]
  /** turn pasted text into a value (default: by column type) */
  valueParser?: (text: string, row: R) => unknown
  /** write an edited value back into a row. Required to edit columns that use `valueGetter`. */
  valueSetter?: (value: unknown, row: R) => R
  headerName?: string
  width?: number
  minWidth?: number
  /** the widest the column can be (also when resized) */
  maxWidth?: number
  /**
   * Share the width the other columns leave free, in proportion to this number (`flex: 2` gets twice the share of `flex: 1`),
   * within `minWidth` and `maxWidth`. Overrides `width`; a column the user resizes becomes fixed. With no room it keeps `minWidth`
   * (default 100) and the grid scrolls.
   */
  flex?: number
  sortable?: boolean
  filterable?: boolean
  resizable?: boolean
  pinnable?: boolean
  /** can be dragged to a new position (default true) */
  reorderable?: boolean
  groupable?: boolean
  hidden?: boolean
  align?: 'left' | 'right' | 'center'
  /** alignment of the header's content (default: the same as `align`) */
  /** the order a click on this header goes through (see `GridOptions.sortingOrder`) */
  sortingOrder?: ('asc' | 'desc' | null)[]
  headerAlign?: 'left' | 'right' | 'center'
  /** a tooltip on the header: what the column holds, when its name does not say enough */
  description?: string
  /** class names for this column's header cell */
  headerClassName?: string
  /** class names for this column's cells: a string, or a function of the cell's value and row (data rows only) */
  cellClassName?: string | ((params: { value: unknown; row: R }) => string | undefined)
  /** read the raw value for sorting, filtering and grouping */
  valueGetter?: (row: R) => unknown
  /** text shown in the cell */
  valueFormatter?: (value: unknown, row: R) => string
  sortComparator?: (a: unknown, b: unknown) => number
}

export interface RowHeightParams<R> {
  id: RowId
  /** the row's data (`undefined` for a row that is not loaded yet, or a group that has none) */
  row: R | undefined
  depth: number
}

/** What a pivot table is built from: rows are grouped, columns are spread out, values are aggregated. */
export interface PivotModel {
  /** fields that become the row groups, outermost first */
  rows: string[]
  /** fields whose distinct values become columns (nested in this order) */
  columns: { field: string; sort?: 'asc' | 'desc'; /** kept in the model but left out of the table */ hidden?: boolean }[]
  /**
   * what is aggregated in each cell. A field can appear more than once with different functions (sum and avg of the
   * same field); each entry is a column per column value.
   */
  values: { field: string; aggFunc: string; /** kept in the model but left out of the table */ hidden?: boolean }[]
  /** fields of `rows` that are kept in the model but not used to group the table */
  hiddenRows?: string[]
}

export const EMPTY_PIVOT: PivotModel = { rows: [], columns: [], values: [] }

/** how tight the rows are: row and header heights are scaled (compact 0.75, comfortable 1.3) */
export type Density = 'compact' | 'standard' | 'comfortable'

export interface GridState {
  density: Density
  sortModel: SortItem[]
  filterModel: FilterModel
  paginationModel: PaginationModel
  selection: RowId[]
  /** column order (fields). Pinned columns are lifted out at render time. */
  columnOrder: string[]
  columnWidths: Record<string, number>
  columnVisibility: Record<string, boolean>
  pinnedColumns: PinnedColumns
  /** fields used by row grouping, outermost first */
  rowGroupingModel: string[]
  /** ids of expanded group / tree nodes */
  expandedIds: RowId[]
  /** when true, nodes start expanded and `expandedIds` holds the collapsed ones */
  expandAllByDefault: boolean
  /** rows kept visible above / below the scrolling rows, in pin order. Flat (ungrouped) grids only. */
  pinnedRows: { top: RowId[]; bottom: RowId[] }
  /** field → aggregation function name ('sum' | 'avg' | 'min' | 'max' | 'count' | 'size' | a custom name) */
  aggregationModel: Record<string, string>
  /** pivot mode on / off (needs the `pivoting` option) */
  pivotMode: boolean
  pivotModel: PivotModel
  /** rows whose detail panel is open */
  detailPanelExpanded: RowId[]
  /** measured heights of detail panels with height 'auto' */
  detailHeights: Record<RowId, number>
  /** selected cell ranges (the last one is the active range) */
  cellSelection: CellRange[]
  focusedCell: CellRef | null
  editingCell: CellRef | null
  /** `editMode: 'row'`: the row whose cells are all being edited */
  editingRow: RowId | null
  /** `editMode: 'row'`: what was typed so far, by field (cells not touched are not in it) */
  editDraft: Record<string, unknown>
  /** the message `validate` gave for each field being edited that has a problem */
  editErrors: Record<string, string>
  scroll: { top: number; left: number }
  viewport: { width: number; height: number }
}

/** A row of the flattened, ready-to-render list. */
export interface RenderRow<R = any> {
  id: RowId
  /** 'footer' is the total row shown when aggregation is on */
  type: 'leaf' | 'group' | 'footer'
  depth: number
  row?: R
  /** group/tree nodes: number of descendant leaves */
  childCount: number
  expandable: boolean
  expanded: boolean
  /** group rows only */
  groupField?: string
  groupValue?: unknown
  /** group / footer rows: aggregated value per field (only for fields in the aggregation model) */
  aggregates?: Record<string, unknown>
}

export interface GridOptions<R = any> {
  /**
   * The texts the grid shows, by key (see `GridLocaleText`). What you leave out stays in English. Keep the object (and its
   * functions) the same between renders (define it outside the component, or `useMemo` it): a new one re-renders the grid.
   */
  /** turns what is typed in the quick filter into the terms to look for (default: split on spaces; use it to allow terms with spaces). Keep it the same between renders. */
  quickFilterParser?: (input: string) => string[]
  /** `'or'`: a row needs only one of the terms (default `'and'`) */
  quickFilterLogicOperator?: 'and' | 'or'
  /** also search the columns that start hidden (default false) */
  quickFilterIncludeHidden?: boolean
  /** what a click on a header does, in turn (default `['asc', 'desc', null]`: ascending, descending, unsorted). A column's own `sortingOrder` wins. */
  sortingOrder?: ('asc' | 'desc' | null)[]
  /** `'always'`: a click on a header adds to the sort instead of replacing it, without a modifier key (default: Shift, Ctrl or Cmd+click adds) */
  multipleColumnsSortingMode?: 'withModifier' | 'always'
  /** match letters with and without accents ("cafe" finds "café") in the filters and the quick filter */
  ignoreDiacritics?: boolean
  /** rows this returns false for cannot be selected: their checkbox is disabled, and select-all and ranges skip them. Default: all. */
  isRowSelectable?: (params: { id: RowId; row: R }) => boolean
  /** `false`: selecting a row replaces the selection instead of adding to it (default true) */
  multipleRowSelection?: boolean
  localeText?: Partial<GridLocaleText>
  /** The locale (`'pt-BR'`) numbers and dates are written in. Default: the browser's. Sorting and searching keep using the browser's. */
  locale?: string
  /** the data (client-side). Ignored when `dataSource` is set. */
  rows?: R[]
  /**
   * Rows live on a server: sorting, filtering and paging are done there, and the grid asks for what it shows.
   * With `pagination` (the default) it loads one page at a time; with `pagination={false}` every row is a
   * position and blocks load as you scroll (see `rowCount` in the response; omit it for infinite scrolling).
   */
  dataSource?: DataSource<R>
  /** a cache for responses (default: an LRU of 500 blocks, 5 minutes). `null` for none. */
  dataSourceCache?: DataSourceCache<R> | null
  /** rows per block: the unit of fetching and caching (default: the page size, or 100 when scrolling) */
  dataSourceChunkSize?: number
  /** requests in flight at once (default 4) */
  dataSourceMaxConcurrent?: number
  /** blocks fetched ahead of the view, each side (default: 0 for pages, 1 when scrolling) */
  dataSourcePrefetchChunks?: number
  /** re-read the visible rows this often, quietly (ms; off by default) */
  dataSourceRevalidateMs?: number
  /** keep the old rows on screen while a new sort / filter loads, instead of skeletons */
  dataSourceKeepPreviousData?: boolean
  /** a request failed. The block is retried when it comes into view again after a few seconds. */
  onDataSourceError?: (error: DataSourceError) => void
  columns: ColumnDef<R>[]
  getRowId?: (row: R) => RowId
  /** enables tree data: path of keys from root to this row */
  getTreeDataPath?: (row: R) => string[]
  rowHeight?: number
  /**
   * Height of one row. A number (px) sets it; `null` or `undefined` gives `rowHeight`; `'auto'` sizes the row to its
   * content (measured once it is on screen, see `getEstimatedRowHeight`). It runs for every row of the current list
   * when `rows` or the function changes, so keep its identity stable (`useCallback`). Pinned rows use `rowHeight`.
   */
  getRowHeight?: (params: RowHeightParams<R>) => number | null | undefined | 'auto'
  /** the height assumed for a `'auto'` row until it has been measured (default: `rowHeight`) */
  getEstimatedRowHeight?: number
  /**
   * With `'auto'` rows every column is rendered (a row is as tall as its tallest cell, which must exist to be measured).
   * Set this to virtualize columns anyway: heights then can change while scrolling sideways. Default false.
   */
  virtualizeColumnsWithAutoRowHeight?: boolean
  headerHeight?: number
  /** px rendered outside the viewport */
  rowBufferPx?: number
  /**
   * Turns on detail panels (expandable content under a row). A number (px), 'auto' (measured from the content),
   * or a function choosing per row.
   */
  detailPanelHeight?: number | 'auto' | ((row: R) => number | 'auto')
  /** rows for which the detail panel exists (default: all). Cheap to call: it runs for visible rows only. */
  isDetailPanelAvailable?: (row: R) => boolean
  /** allow dragging rows to a new place in the data order (flat grids, no sorting, nothing being edited) */
  rowReordering?: boolean
  /** a row was moved; apply the same move to your own `rows` (see `moveItem`) */
  onRowOrderChange?: (params: { rowId: RowId; row: R; oldIndex: number; targetIndex: number }) => void
  /**
   * Make pivot mode available (`api.setPivotMode`, the pivot panel in the toolbar). Client-side data only.
   * Rows are grouped by `pivotModel.rows`, the distinct values of `pivotModel.columns` become columns, and each
   * cell aggregates one of `pivotModel.values`.
   */
  pivoting?: boolean
  /** add a total column per value (default false) */
  pivotTotals?: boolean
  /**
   * Extra columns the pivot panel offers, made from a column. The default turns every date column into a year and
   * a quarter column. `false` for none.
   */
  pivotDerivedColumns?: false | ((column: ColumnDef<R>) => ColumnDef<R>[] | undefined)
  /** adjust a generated value column (width, formatting, …): called with its value field and the column values above it */
  pivotColumnDef?: (valueField: string, path: string[]) => Partial<ColumnDef<R>> | undefined
  /** show the total row when aggregation is on (default true) */
  aggregationFooter?: boolean
  /** extra aggregation functions, selectable by name in the aggregation model */
  aggregationFunctions?: Record<string, CustomAggregation<R>>
  /** called with the edited row. Return (or resolve) the row to keep; throw/reject to reject the edit. */
  processRowUpdate?: (newRow: R, oldRow: R) => R | Promise<R>
  onProcessRowUpdateError?: (error: unknown) => void
  /** extra per-cell gate on top of `ColumnDef.editable` */
  isCellEditable?: (row: R, field: string) => boolean
  /** `'cell'` (default): one cell is edited at a time. `'row'`: every editable cell of a row at once, saved together (Enter, or a click outside). */
  editMode?: 'cell' | 'row'
  /** a cell is about to be edited: return `false` to stop it */
  onCellEditStart?: (params: { id: RowId; field: string; row: R }) => boolean | void
  /** a cell edit is about to end: `cancelled` for Escape; return `false` to keep editing */
  onCellEditStop?: (params: { id: RowId; field: string; row: R; reason: EditStopReason; cancelled: boolean }) => boolean | void
  /** a row is about to be edited (`editMode: 'row'`): return `false` to stop it */
  onRowEditStart?: (params: { id: RowId; row: R }) => boolean | void
  /** a row edit is about to end (`editMode: 'row'`): return `false` to keep editing */
  onRowEditStop?: (params: { id: RowId; row: R; reason: EditStopReason; cancelled: boolean }) => boolean | void
  columnBufferPx?: number
  pagination?: boolean
  initialState?: Partial<GridState>
  /** controlled slices: when set, the grid reads this instead of its own state */
  state?: Partial<GridState>
  onStateChange?: (next: GridState, prev: GridState) => void
}
