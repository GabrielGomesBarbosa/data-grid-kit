import type { ComponentType } from 'react'
import type { CellProps } from './Cell'
import type { DetailPanelProps } from './DetailPanel'
import type { FooterProps } from './Footer'
import type { HeaderCellProps } from './HeaderCell'
import type { ErrorOverlayProps, NoRowsOverlayProps, OverlayProps } from './Overlays'
import type { ColumnMenuProps } from './panels/ColumnMenu'
import type { PanelProps } from './panels/types'
import type { PopoverProps } from './Popover'
import type { RowProps } from './Row'
import type { SkeletonRowProps } from './SkeletonRow'
import type { ToolbarProps } from './Toolbar'
import type { BaseSlots } from './base'
import type { GridIcons } from './icons'

/**
 * Parts of the grid you can replace. Each slot is a React component that receives the props the built-in one
 * receives (see the props types), and may render the built-in component itself to wrap or decorate it.
 * Replacing `row` or `cell` is a hot path: memoise your component (rows are already memoised).
 */
export interface GridSlots<R = any> extends BaseSlots {
  /** the symbols the grid draws (each can be replaced on its own) */
  icons: GridIcons
  toolbar: ComponentType<ToolbarProps<R>>
  footer: ComponentType<FooterProps<R>>
  loadingOverlay: ComponentType<OverlayProps>
  errorOverlay: ComponentType<ErrorOverlayProps>
  noRowsOverlay: ComponentType<NoRowsOverlayProps<R>>
  headerCell: ComponentType<HeaderCellProps<R>>
  row: ComponentType<RowProps<R>>
  cell: ComponentType<CellProps<R>>
  skeletonRow: ComponentType<SkeletonRowProps>
  detailPanel: ComponentType<DetailPanelProps>
  columnMenu: ComponentType<ColumnMenuProps<R>>
  filterPanel: ComponentType<PanelProps<R>>
  columnsPanel: ComponentType<PanelProps<R>>
  pivotPanel: ComponentType<PanelProps<R>>
  /** the floating surface that holds the column menu and the panels */
  popover: ComponentType<PopoverProps>
}

/**
 * Props merged over the ones the grid passes to a slot, so they win. Mostly `className` and `style`; for the
 * column-positioned parts (`cell`, `headerCell`) a `style` is merged with the positioning style, not instead of it.
 */
export type GridSlotProps<R = any> = {
  [K in Exclude<keyof GridSlots<R>, 'icons'>]?: GridSlots<R>[K] extends ComponentType<infer P> ? Partial<P> : never
}
