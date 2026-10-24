import { type ReactNode } from 'react'
import { type AutosizeOptions, type ColumnDef, type FilterItem, type FilterOperatorDef, type GridApi, type GridOptions, type RenderRow, type RowId } from '../core'
import { type EditCellParams } from './Editors'
import type { GridSlotProps, GridSlots } from './slotTypes'
import type { CellEventParams, GridEventProps } from './useGridEvents'
import type { GridAction } from './ActionsCell'

/** A filter operator of a column, with the input it uses for its value (the default is a text box fitted to the column's type). */
export interface UIFilterOperator<R = any> extends FilterOperatorDef<R> {
  /** `onChange` takes the value to store in the filter item (any type); put `focusProps` on the control that should get the focus */
  renderInput?: (params: { item: FilterItem; onChange: (value: unknown) => void; focusProps: Record<string, unknown> }) => ReactNode
}

export interface UIColumnDef<R = any> extends Omit<ColumnDef<R>, 'filterOperators'> {
  /** operators the filter panel offers for this column instead of the built-in ones (see `getFilterOperators` to extend them) */
  filterOperators?: UIFilterOperator<R>[]
  renderCell?: (params: { value: unknown; row: R }) => ReactNode
  renderEditCell?: (params: EditCellParams<R>) => ReactNode
  /** for `type: 'actions'`: the buttons of the row's cell (those with `showInMenu` go in a ⋮ menu). Called for data rows only. */
  getActions?: (params: { id: RowId; row: R; field: string }) => GridAction[]
  /** what the header shows instead of `headerName` (the name is still the accessible name of the sort button's group and the menu) */
  renderHeader?: (params: { field: string; colDef: UIColumnDef<R> }) => ReactNode
}

export interface GridProps<R = any> extends Omit<GridOptions<R>, 'columns'>, GridEventProps<R> {
  columns: UIColumnDef<R>[]
  height?: number | string
  checkboxSelection?: boolean
  /**
   * Select rows by clicking them: a click selects only that row (a click on the only selected row unselects it), Ctrl/Cmd+click adds or
   * removes one, Shift+click selects the range from the last click. Ignored with `cellSelection`, which uses those clicks. Default false.
   */
  rowSelectionOnClick?: boolean
  /** fit the columns to their content once, right after the grid first shows its rows (see `autosizeOptions`, `api.autosizeColumns`) */
  autosizeOnMount?: boolean
  /** what `autosizeOnMount` and a double click on a column's divider do: see `AutosizeOptions` */
  autosizeOptions?: AutosizeOptions
  /** show the density button (compact / standard / comfortable) in the default toolbar */
  densitySelector?: boolean
  /** a "Rows per page" select in the footer with these page sizes (`-1`: every row). Without it the footer has no select. */
  pageSizeOptions?: number[]
  /** fit the page size to the grid's height, again whenever the grid is resized or the density changes (use it without `pageSizeOptions`) */
  autoPageSize?: boolean
  /** toolbar with columns panel, filter panel, export and quick filter */
  toolbar?: boolean
  /**
   * Where the pivot panel opens: `'docked'` (default) at the right inside the grid's frame, which narrows to make room and keeps
   * the panel open while you work; `'popover'` floating under its button.
   */
  pivotPanelMode?: 'docked' | 'popover'
  /** show the column menu button in headers (default true) */
  columnControls?: boolean
  /** drag headers to reorder columns (default true; per column: reorderable: false) */
  columnReorder?: boolean
  /** show pin-to-top / pin-to-bottom buttons on rows (flat grids only) */
  rowPinning?: boolean
  /** content of a row's detail panel; setting it turns on detail panels (see also `detailPanelHeight`) */
  renderDetailPanel?: (params: { row: R }) => ReactNode
  /** show the ›/⌄ button on rows that have a panel (default true; Alt+↓ / Alt+↑ always work) */
  detailPanelToggle?: boolean
  /** show the Aggregate choices in the column menu (default true) */
  aggregationMenu?: boolean
  /** select blocks of cells: drag, Shift+click / Shift+arrows, Ctrl/Cmd+click for more, Ctrl/Cmd+A, Delete clears */
  cellSelection?: boolean
  /** copy, cut and paste (tab-separated, works with spreadsheets). Default true. */
  clipboard?: boolean
  /** drag the corner of the selection to repeat its cells (needs cellSelection). Default true. */
  fillHandle?: boolean
  className?: string
  /** class names for a row, from its data (stripes, highlights). Keep the function the same between renders (`useCallback`). */
  getRowClassName?: (params: { id: RowId; row: R | undefined; renderRow: RenderRow<R>; index: number }) => string | undefined
  /** class names for any cell, from its value and row; adds to the column's `cellClassName`. Keep the function the same between renders. */
  getCellClassName?: (params: CellEventParams<R>) => string | undefined
  /** replace parts of the grid with your own components (see `GridSlots`) */
  slots?: Partial<GridSlots<R>>
  /** extra props for the slots, merged over the ones the grid passes: mostly `className` and `style` */
  slotProps?: GridSlotProps<R>
  csvFileName?: string
  /** file name of the Excel download (default export.xlsx) */
  xlsxFileName?: string
  onReady?: (api: GridApi<R>) => void
}
