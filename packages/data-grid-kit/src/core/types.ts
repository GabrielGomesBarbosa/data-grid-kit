import type { GridLocaleText } from './localeText'
export type RowId = string | number

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

export interface FilterItem {
  field: string
  operator: FilterOperator
  value?: unknown
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

export type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'singleSelect'

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
  /** options for `singleSelect` columns */
  valueOptions?: (string | number | { value: string | number; label: string })[]
  /** turn pasted text into a value (default: by column type) */
  valueParser?: (text: string, row: R) => unknown
  /** write an edited value back into a row. Required to edit columns that use `valueGetter`. */
  valueSetter?: (value: unknown, row: R) => R
  headerName?: string
  width?: number
  minWidth?: number
  sortable?: boolean
  filterable?: boolean
  resizable?: boolean
  pinnable?: boolean
  /** can be dragged to a new position (default true) */
  reorderable?: boolean
  groupable?: boolean
  hidden?: boolean
  align?: 'left' | 'right' | 'center'
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

export interface GridState {
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
  columnBufferPx?: number
  pagination?: boolean
  initialState?: Partial<GridState>
  /** controlled slices: when set, the grid reads this instead of its own state */
  state?: Partial<GridState>
  onStateChange?: (next: GridState, prev: GridState) => void
}
