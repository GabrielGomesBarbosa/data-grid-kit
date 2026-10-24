import type { GridInstance } from '../../core'

/** What a toolbar panel (filters, columns, pivot) receives. */
export interface PanelProps<R> {
  grid: GridInstance<R>
  /** added to the panel's class names (`slotProps.filterPanel`, ...) */
  className?: string
}
