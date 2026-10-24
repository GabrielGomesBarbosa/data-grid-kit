/**
 * Every fixed text the grid shows, in one flat dictionary. A key holds a string, or a function when the text has a name or a
 * number in it (the word order of a sentence is the translator's to decide, so the pieces are not glued together here).
 * English is the default; give `localeText` the keys you want to change, or a whole pack from `data-grid-kit/locales`.
 */
export interface GridLocaleText {
  /* ---- the body ---- */
  loadingRows: string
  errorLoadingRows: (message: string) => string
  errorRetry: string
  noRows: string
  /** the filters leave no row */
  noResults: string
  noColumns: string
  noColumnsHint: string
  /** pivot mode with no row field yet */
  pivotNeedsRows: string
  /** pivot mode with rows but no value field yet */
  pivotNeedsValues: string

  /* ---- toolbar ---- */
  toolbar: string
  toolbarColumns: string
  toolbarFilters: string
  /** added to the filters button's name while filters are on */
  toolbarFiltersActive: (count: number) => string
  toolbarPivot: string
  toolbarExport: string
  toolbarSearch: string
  toolbarDensity: string
  densityCompact: string
  densityStandard: string
  densityComfortable: string
  quickFilterPlaceholder: string
  quickFilterLabel: string
  quickFilterClear: string

  /* ---- footer ---- */
  /** `formatted` is the count written in the grid's `locale` ("1,234") */
  footerRows: (count: number, hasMore: boolean, formatted: string) => string
  footerLoading: string
  footerSelected: (count: number) => string
  footerCellsSelected: (count: number, formatted: string) => string
  paginationRowsPerPage: string
  /** the choice that shows every row (`-1` in `pageSizeOptions`) */
  paginationAll: string
  paginationPrevious: string
  paginationNext: string

  /* ---- cells and rows ---- */
  rowDragHandle: string
  fillHandle: string
  rowSelect: string
  /** the ⋮ button of an actions column, when some actions are in its menu */
  actionsMore: string
  detailExpand: string
  detailCollapse: string
  treeExpand: string
  treeCollapse: string
  rowUnpin: string
  rowUnpinTitle: string
  rowPinTop: string
  rowPinTopTitle: string
  rowPinBottom: string
  rowPinBottomTitle: string
  groupTotal: string
  groupEmpty: string
  /** the tooltip of an aggregate: "sum of Price" */
  aggregationOf: (aggregation: string, column: string) => string
  editCell: string
  rowMoved: (position: number, total: number) => string
  pinnedRowsTop: string
  pinnedRowsBottom: string
  pinnedRowsAndTotals: string
  /** the tooltip of the pin mark in a header */
  columnPinned: (side: 'left' | 'right') => string
  columnMenuOf: (column: string) => string

  /* ---- aggregation functions ---- */
  aggregationSum: string
  aggregationAvg: string
  aggregationMin: string
  aggregationMax: string
  aggregationCount: string
  aggregationSize: string

  /* ---- column menu ---- */
  columnMenu: string
  menuSortAsc: string
  menuSortDesc: string
  menuUnsort: string
  menuFilter: string
  menuPinLeft: string
  menuPinRight: string
  menuUnpin: string
  menuMoveLeft: string
  menuMoveRight: string
  menuAggregate: string
  menuAggregateNone: string
  menuHide: string

  /* ---- export menu ---- */
  exportCsv: string
  exportCsvSelected: string
  exportXlsx: string

  /* ---- columns panel ---- */
  columnsSearch: string
  columnsSearchLabel: string
  columnsNoMatch: string
  columnsToggleAll: string
  columnsReset: string

  /* ---- filter panel ---- */
  filterWhere: string
  filterAnd: string
  filterOr: string
  filterLogic: string
  filterColumn: string
  filterOperator: string
  filterValue: string
  filterRemove: string
  filterAdd: string
  filterRemoveAll: string
  filterTrue: string
  filterFalse: string
  filterContains: string
  filterDoesNotContain: string
  filterDoesNotEqual: string
  /** "is not": for a pick-one column */
  filterIsNot: string
  filterIsAnyOf: string
  /** hint in the "is any of" value box */
  filterListHint: string
  filterEquals: string
  filterStartsWith: string
  filterEndsWith: string
  filterIsEmpty: string
  filterIsNotEmpty: string
  /** the only operator of a yes/no or a pick-one column */
  filterIs: string

  /* ---- pivot panel ---- */
  pivotPanel: string
  pivotMode: string
  pivotTitle: string
  pivotClose: string
  pivotCloseTitle: string
  pivotSearch: string
  pivotAvailableFields: string
  pivotNoFieldMatch: string
  pivotAllFieldsUsed: string
  pivotRows: string
  pivotColumns: string
  pivotValues: string
  pivotRowsList: string
  pivotColumnsList: string
  pivotValuesList: string
  pivotDropRows: string
  pivotDropColumns: string
  pivotDropValues: string
  pivotAddRow: string
  pivotAddColumn: string
  pivotAddValue: string
  pivotAddToRows: (field: string) => string
  pivotAddToColumns: (field: string) => string
  pivotAddToValues: (field: string) => string
  pivotSortColumns: (field: string) => string
  pivotSortAsc: string
  pivotSortDesc: string
  pivotFunctionFor: (field: string) => string
  pivotAddFunction: (field: string) => string
  pivotAddFunctionTitle: string
  pivotMoveUp: (field: string) => string
  pivotMoveDown: (field: string) => string
  pivotRemove: (field: string) => string
  pivotDrag: (field: string) => string
  pivotShow: (field: string) => string
  pivotShown: string
  pivotHidden: string
  pivotHint: string
  /** the header of the column that carries the row labels, when no row field is named */
  pivotRowsHeader: string
  pivotTotalGroup: string
  /** the generated year / quarter columns of a date column */
  pivotYear: (column: string) => string
  pivotQuarter: (column: string) => string
  pivotQuarterValue: (quarter: number) => string
}

export const defaultLocaleText: GridLocaleText = {
  loadingRows: 'Loading rows',
  errorLoadingRows: (message) => `Could not load rows: ${message}`,
  errorRetry: 'Try again',
  noRows: 'No rows',
  noResults: 'No results found.',
  noColumns: 'No columns are visible.',
  noColumnsHint: 'Check the column visibility settings.',
  pivotNeedsRows: 'Add a field as a row in the Pivot panel to fill the table.',
  pivotNeedsValues: 'Add a field as a value in the Pivot panel to fill the table.',

  toolbar: 'Grid toolbar',
  toolbarColumns: 'Columns',
  toolbarFilters: 'Filters',
  toolbarFiltersActive: (count) => `${count} active`,
  toolbarPivot: 'Pivot',
  toolbarExport: 'Export',
  toolbarSearch: 'Search',
  toolbarDensity: 'Density',
  densityCompact: 'Compact',
  densityStandard: 'Standard',
  densityComfortable: 'Comfortable',
  quickFilterPlaceholder: 'Search…',
  quickFilterLabel: 'Quick filter',
  quickFilterClear: 'Clear search',

  footerRows: (_count, hasMore, formatted) => `${formatted}${hasMore ? '+' : ''} rows`,
  footerLoading: 'loading…',
  footerSelected: (count) => `${count} selected`,
  footerCellsSelected: (_count, formatted) => `${formatted} cells selected`,
  paginationRowsPerPage: 'Rows per page',
  paginationAll: 'All',
  paginationPrevious: 'Previous page',
  paginationNext: 'Next page',

  rowDragHandle: 'Drag to move this row (or Alt+Shift+↑ / ↓)',
  fillHandle: 'Drag to fill',
  rowSelect: 'Select row',
  actionsMore: 'More actions',
  detailExpand: 'Expand details',
  detailCollapse: 'Collapse details',
  treeExpand: 'Expand',
  treeCollapse: 'Collapse',
  rowUnpin: 'Unpin row',
  rowUnpinTitle: 'Unpin row',
  rowPinTop: 'Pin row to top',
  rowPinTopTitle: 'Pin to top',
  rowPinBottom: 'Pin row to bottom',
  rowPinBottomTitle: 'Pin to bottom',
  groupTotal: 'Total',
  groupEmpty: '(empty)',
  aggregationOf: (aggregation, column) => `${aggregation} of ${column}`,
  editCell: 'Edit cell',
  rowMoved: (position, total) => `Row moved to position ${position} of ${total}`,
  pinnedRowsTop: 'Pinned rows (top)',
  pinnedRowsBottom: 'Pinned rows (bottom)',
  pinnedRowsAndTotals: 'Pinned rows and totals',
  columnPinned: (side) => `Pinned ${side}`,
  columnMenuOf: (column) => `${column} column menu`,

  aggregationSum: 'sum',
  aggregationAvg: 'avg',
  aggregationMin: 'min',
  aggregationMax: 'max',
  aggregationCount: 'count',
  aggregationSize: 'size',

  columnMenu: 'Column menu',
  menuSortAsc: 'Sort ascending',
  menuSortDesc: 'Sort descending',
  menuUnsort: 'Unsort',
  menuFilter: 'Filter…',
  menuPinLeft: 'Pin to left',
  menuPinRight: 'Pin to right',
  menuUnpin: 'Unpin',
  menuMoveLeft: 'Move left',
  menuMoveRight: 'Move right',
  menuAggregate: 'Aggregate',
  menuAggregateNone: 'None',
  menuHide: 'Hide column',

  exportCsv: 'Download CSV',
  exportCsvSelected: 'Download CSV (selected rows)',
  exportXlsx: 'Download Excel (.xlsx)',

  columnsSearch: 'Search',
  columnsSearchLabel: 'Search columns',
  columnsNoMatch: 'No column matches',
  columnsToggleAll: 'Show/Hide All',
  columnsReset: 'Reset',

  filterWhere: 'Where',
  filterAnd: 'And',
  filterOr: 'Or',
  filterLogic: 'Logic',
  filterColumn: 'Column',
  filterOperator: 'Operator',
  filterValue: 'Value',
  filterRemove: 'Remove filter',
  filterAdd: 'Add filter',
  filterRemoveAll: 'Remove all',
  filterTrue: 'true',
  filterFalse: 'false',
  filterContains: 'contains',
  filterDoesNotContain: 'does not contain',
  filterDoesNotEqual: 'does not equal',
  filterIsNot: 'is not',
  filterIsAnyOf: 'is any of',
  filterListHint: 'a, b, c',
  filterEquals: 'equals',
  filterStartsWith: 'starts with',
  filterEndsWith: 'ends with',
  filterIsEmpty: 'is empty',
  filterIsNotEmpty: 'is not empty',
  filterIs: 'is',

  pivotPanel: 'Pivot panel',
  pivotMode: 'Pivot mode',
  pivotTitle: 'Pivot',
  pivotClose: 'Close pivot panel',
  pivotCloseTitle: 'Close',
  pivotSearch: 'Search fields',
  pivotAvailableFields: 'Available fields',
  pivotNoFieldMatch: 'No field matches',
  pivotAllFieldsUsed: 'Every field is in use',
  pivotRows: 'Rows',
  pivotColumns: 'Columns',
  pivotValues: 'Values',
  pivotRowsList: 'Pivot rows',
  pivotColumnsList: 'Pivot columns',
  pivotValuesList: 'Pivot values',
  pivotDropRows: 'Drag a field here to group the rows by it',
  pivotDropColumns: 'Drag a field here to spread it into columns',
  pivotDropValues: 'Drag a field here to aggregate it',
  pivotAddRow: 'Row',
  pivotAddColumn: 'Column',
  pivotAddValue: 'Value',
  pivotAddToRows: (field) => `Add ${field} to rows`,
  pivotAddToColumns: (field) => `Add ${field} to columns`,
  pivotAddToValues: (field) => `Add ${field} to values`,
  pivotSortColumns: (field) => `Sort ${field} columns`,
  pivotSortAsc: 'A → Z',
  pivotSortDesc: 'Z → A',
  pivotFunctionFor: (field) => `Function for ${field}`,
  pivotAddFunction: (field) => `Add another function for ${field}`,
  pivotAddFunctionTitle: 'Use this field again with another function',
  pivotMoveUp: (field) => `Move ${field} up`,
  pivotMoveDown: (field) => `Move ${field} down`,
  pivotRemove: (field) => `Remove ${field}`,
  pivotDrag: (field) => `Drag ${field} to another list`,
  pivotShow: (field) => `Show ${field}`,
  pivotShown: 'Shown in the table',
  pivotHidden: 'Hidden from the table',
  pivotHint: "Drag a field's grip to a list, or back onto the field list to remove it. Esc cancels.",
  pivotRowsHeader: 'Rows',
  pivotTotalGroup: 'Total',
  pivotYear: (column) => `${column} (year)`,
  pivotQuarter: (column) => `${column} (quarter)`,
  pivotQuarterValue: (quarter) => `Q${quarter}`,
}

/** The dictionary with `overrides` on top: what you leave out stays in English. Returns the same object when there is nothing to add. */
export function resolveLocaleText(overrides?: Partial<GridLocaleText>): GridLocaleText {
  if (!overrides) return defaultLocaleText
  const out = { ...defaultLocaleText }
  for (const key of Object.keys(overrides) as (keyof GridLocaleText)[]) {
    // `undefined` (an unset key of a spread pack) keeps the English text
    if (overrides[key] !== undefined) (out as Record<string, unknown>)[key] = overrides[key]
  }
  return out
}

/** A pack of text and the locale its numbers and dates are written in: `<Grid {...ptBR} />`. */
export interface GridLocalization {
  locale: string
  localeText: GridLocaleText
}

/* ------------------------------------------------------------ numbers, dates */

const numberFormats = new Map<string, Intl.NumberFormat>()
const dateFormats = new Map<string | undefined, Intl.DateTimeFormat>()

/** `n.toLocaleString(locale, options)` through formatters that are made once (making one per call is the slow part). */
export function formatNumber(n: number, locale?: string, options?: Intl.NumberFormatOptions): string {
  const key = `${locale ?? ''}|${options?.maximumFractionDigits ?? ''}`
  let f = numberFormats.get(key)
  if (!f) numberFormats.set(key, (f = new Intl.NumberFormat(locale, options)))
  return f.format(n)
}

const dateTimeFormats = new Map<string | undefined, Intl.DateTimeFormat>()
/** A date with its time (`short` date and time styles of the locale), through a formatter that is made once per locale. */
export function formatDateTime(date: Date, locale?: string): string {
  if (Number.isNaN(date.getTime())) return 'Invalid Date'
  let f = dateTimeFormats.get(locale)
  if (!f) dateTimeFormats.set(locale, (f = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })))
  return f.format(date)
}

/** `date.toLocaleDateString(locale)`, through a formatter that is made once per locale. */
export function formatDate(date: Date, locale?: string): string {
  if (Number.isNaN(date.getTime())) return 'Invalid Date' // what toLocaleDateString says; Intl would throw
  let f = dateFormats.get(locale)
  if (!f) dateFormats.set(locale, (f = new Intl.DateTimeFormat(locale)))
  return f.format(date)
}
