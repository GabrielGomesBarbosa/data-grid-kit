import { type ReactNode } from 'react'
import { type ColumnDef, type GridApi, type GridOptions } from '../core'
import { type EditCellParams } from './Editors'

export interface UIColumnDef<R = any> extends ColumnDef<R> {
  renderCell?: (params: { value: unknown; row: R }) => ReactNode
  renderEditCell?: (params: EditCellParams<R>) => ReactNode
}

export interface GridProps<R = any> extends Omit<GridOptions<R>, 'columns'> {
  columns: UIColumnDef<R>[]
  height?: number | string
  checkboxSelection?: boolean
  /** toolbar with columns panel, filter panel, export and quick filter */
  toolbar?: boolean
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
  csvFileName?: string
  /** file name of the Excel download (default export.xlsx) */
  xlsxFileName?: string
  onReady?: (api: GridApi<R>) => void
}
