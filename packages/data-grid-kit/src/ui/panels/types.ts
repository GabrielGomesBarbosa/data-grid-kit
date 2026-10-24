import type { GridInstance } from '../../core'

/** What a toolbar panel (filters, columns, pivot) receives. */
export interface PanelProps<R> {
  grid: GridInstance<R>
  /** closes the popover the panel is in (the filter panel calls it when its last filter is removed) */
  onClose?: () => void
  /** added to the panel's class names (`slotProps.filterPanel`, ...) */
  className?: string
}
