import type { ColumnLayout } from './layout'
import { DEFAULT_HEADER_HEIGHT, DEFAULT_ROW_HEIGHT } from './layout'

export interface NavInput {
  key: string
  ctrl?: boolean
  shift?: boolean
  row: number
  col: number
  rowCount: number
  colCount: number
  /** rows that fit in the viewport, used by PageUp/PageDown */
  pageRows: number
}

export interface NavResult {
  row: number
  col: number
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

/** Pure cell-navigation rules (WAI-ARIA grid). Returns null when the key doesn't navigate. */
export function navigate(i: NavInput): NavResult | null {
  if (i.rowCount === 0 || i.colCount === 0) return null
  const lastRow = i.rowCount - 1
  const lastCol = i.colCount - 1
  let { row, col } = i
  switch (i.key) {
    case 'ArrowDown':
      row += 1
      break
    case 'ArrowUp':
      row -= 1
      break
    case 'ArrowRight':
      col += 1
      break
    case 'ArrowLeft':
      col -= 1
      break
    case 'PageDown':
      row += Math.max(1, i.pageRows)
      break
    case 'PageUp':
      row -= Math.max(1, i.pageRows)
      break
    case 'Home':
      col = 0
      if (i.ctrl) row = 0
      break
    case 'End':
      col = lastCol
      if (i.ctrl) row = lastRow
      break
    case 'Tab':
      // Tab walks the row, wraps to the next/previous row, and leaves the grid at the ends
      if (i.shift) {
        if (col === 0) {
          if (row === 0) return null
          row -= 1
          col = lastCol
        } else col -= 1
      } else if (col === lastCol) {
        if (row === lastRow) return null
        row += 1
        col = 0
      } else col += 1
      return { row, col }
    default:
      return null
  }
  return { row: clamp(row, 0, lastRow), col: clamp(col, 0, lastCol) }
}

export interface ScrollTarget {
  top: number
  left: number
}

/**
 * Smallest scroll change that brings a cell fully into view, accounting for the sticky header
 * and for pinned columns that cover part of the viewport.
 */
export function scrollToCell(
  layout: Pick<ColumnLayout, 'left' | 'center' | 'right' | 'centerOffsets' | 'leftWidth' | 'rightWidth' | 'pinnedSide'>,
  field: string,
  rowIndex: number,
  scroll: ScrollTarget,
  viewport: { width: number; height: number },
  rowHeight = DEFAULT_ROW_HEIGHT,
  headerHeight = DEFAULT_HEADER_HEIGHT,
  /** total height of pinned rows (top + bottom): they cover part of the viewport */
  pinnedRowsHeight = 0,
  /** where the row really starts (rows are not all `rowHeight` apart when detail panels are open) */
  rowTop?: number,
): ScrollTarget {
  const top = rowTop ?? rowIndex * rowHeight
  const bodyHeight = viewport.height - headerHeight - pinnedRowsHeight
  let nextTop = scroll.top
  if (top < scroll.top) nextTop = top
  else if (top + rowHeight > scroll.top + bodyHeight) nextTop = top + rowHeight - bodyHeight

  let nextLeft = scroll.left
  if (!layout.pinnedSide.has(field)) {
    const i = layout.center.findIndex((c) => c.field === field)
    if (i >= 0) {
      const start = layout.centerOffsets[i]!
      const end = layout.centerOffsets[i + 1]!
      const visibleStart = scroll.left
      const visibleEnd = scroll.left + viewport.width - layout.leftWidth - layout.rightWidth
      if (start < visibleStart) nextLeft = start
      else if (end > visibleEnd) nextLeft = end - (viewport.width - layout.leftWidth - layout.rightWidth)
    }
  }
  return { top: Math.max(0, nextTop), left: Math.max(0, nextLeft) }
}

/** Does a keypress start typing into a cell? (printable, no Ctrl/Meta/Alt) */
export function isPrintableKey(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): boolean {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
}
