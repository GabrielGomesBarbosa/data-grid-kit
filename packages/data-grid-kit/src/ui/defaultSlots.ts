import { Cell } from './Cell'
import { DetailPanel } from './DetailPanel'
import { Footer } from './Footer'
import { HeaderCell } from './HeaderCell'
import { EmptyState, ErrorBanner, LoadingBar } from './Overlays'
import { ColumnMenu, ColumnsPanel, FilterPanel, PivotPanel } from './panels'
import { Popover } from './Popover'
import { Row } from './Row'
import { SkeletonRow } from './SkeletonRow'
import { BaseButton, BaseCheckbox, BaseInput, BaseSelect } from './base'
import { defaultIcons } from './icons'
import type { GridSlots } from './slotTypes'
import { Toolbar } from './Toolbar'

/** The built-in component of every slot. Also exported, so a slot can wrap the one it replaces. */
export const defaultSlots: GridSlots = {
  toolbar: Toolbar,
  footer: Footer,
  loadingOverlay: LoadingBar,
  errorOverlay: ErrorBanner,
  noRowsOverlay: EmptyState,
  headerCell: HeaderCell,
  row: Row,
  cell: Cell,
  skeletonRow: SkeletonRow,
  detailPanel: DetailPanel,
  columnMenu: ColumnMenu,
  filterPanel: FilterPanel,
  columnsPanel: ColumnsPanel,
  pivotPanel: PivotPanel,
  popover: Popover,
  baseButton: BaseButton,
  baseCheckbox: BaseCheckbox,
  baseSelect: BaseSelect,
  baseInput: BaseInput,
  icons: defaultIcons,
}
