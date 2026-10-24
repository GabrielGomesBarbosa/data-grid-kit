import type { ColumnDef, GridState } from './types'

export const DEFAULT_ROW_HEIGHT = 36
export const DEFAULT_HEADER_HEIGHT = 40
export const DEFAULT_COLUMN_WIDTH = 150
export const DEFAULT_MIN_WIDTH = 50

export interface ColumnLayout<R = any> {
  left: ColumnDef<R>[]
  center: ColumnDef<R>[]
  right: ColumnDef<R>[]
  /** visual left-to-right order: pinned left, scrolling, pinned right */
  all: ColumnDef<R>[]
  width(field: string): number
  leftWidth: number
  rightWidth: number
  centerWidth: number
  /** prefix sums of the center columns: offsets[i] is the left edge of center[i] */
  centerOffsets: Float64Array
  /** field → pinned side, for O(1) lookups */
  pinnedSide: Map<string, 'left' | 'right'>
}

/**
 * Resolve visibility, order and pinning into three column groups.
 * Pinned columns keep the order they were pinned in; the rest follow `columnOrder`.
 */
export function computeColumnLayout<R>(
  columns: ColumnDef<R>[],
  state: Pick<GridState, 'columnOrder' | 'columnWidths' | 'columnVisibility' | 'pinnedColumns'>,
): ColumnLayout<R> {
  const byField = new Map(columns.map((c) => [c.field, c]))
  const isVisible = (c: ColumnDef<R>) => state.columnVisibility[c.field] ?? !c.hidden

  const pinnedSide = new Map<string, 'left' | 'right'>()
  const pick = (fields: string[], side: 'left' | 'right') => {
    const out: ColumnDef<R>[] = []
    for (const f of fields) {
      const col = byField.get(f)
      if (!col || !isVisible(col) || pinnedSide.has(f) || col.pinnable === false) continue
      pinnedSide.set(f, side)
      out.push(col)
    }
    return out
  }
  const left = pick(state.pinnedColumns.left, 'left')
  const right = pick(state.pinnedColumns.right, 'right')

  const seen = new Set<string>()
  const center: ColumnDef<R>[] = []
  const place = (f: string) => {
    const col = byField.get(f)
    if (!col || seen.has(f)) return
    seen.add(f)
    if (isVisible(col) && !pinnedSide.has(f)) center.push(col)
  }
  state.columnOrder.forEach(place)
  columns.forEach((c) => place(c.field)) // columns missing from the saved order

  const width = (field: string) => {
    const col = byField.get(field)
    const w = state.columnWidths[field] ?? col?.width ?? DEFAULT_COLUMN_WIDTH
    return Math.max(col?.minWidth ?? DEFAULT_MIN_WIDTH, w)
  }

  const centerOffsets = new Float64Array(center.length + 1)
  for (let i = 0; i < center.length; i++) centerOffsets[i + 1] = centerOffsets[i]! + width(center[i]!.field)
  const sum = (list: ColumnDef<R>[]) => list.reduce((s, c) => s + width(c.field), 0)

  return {
    left,
    center,
    right,
    all: [...left, ...center, ...right],
    width,
    leftWidth: sum(left),
    rightWidth: sum(right),
    centerWidth: centerOffsets[center.length]!,
    centerOffsets,
    pinnedSide,
  }
}

/* ------------------------------------------------------------ virtualization */

export interface Range {
  start: number
  /** exclusive */
  end: number
}

export const rangeEqual = (a: Range, b: Range) => a.start === b.start && a.end === b.end

/** Rows are fixed height, so the window is plain arithmetic: O(1). */
export function computeRowRange(
  rowCount: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  bufferPx: number,
): Range {
  if (rowCount === 0) return { start: 0, end: 0 }
  const start = Math.min(rowCount, Math.max(0, Math.floor((scrollTop - bufferPx) / rowHeight)))
  const end = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight + bufferPx) / rowHeight))
  return { start, end: Math.max(end, start) }
}

/** Largest i with offsets[i] <= x, via binary search: O(log n) on prefix sums. */
export function findColumnIndex(offsets: Float64Array, x: number): number {
  let lo = 0
  let hi = offsets.length - 2
  if (hi < 0) return 0
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (offsets[mid]! <= x) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Window over the scrolling (center) columns; pinned columns are always rendered. */
export function computeColumnRange(
  layout: Pick<ColumnLayout, 'centerOffsets' | 'center' | 'leftWidth' | 'rightWidth'>,
  scrollLeft: number,
  viewportWidth: number,
  bufferPx: number,
): Range {
  const count = layout.center.length
  if (count === 0) return { start: 0, end: 0 }
  const visibleWidth = Math.max(0, viewportWidth - layout.leftWidth - layout.rightWidth)
  const from = Math.max(0, scrollLeft - bufferPx)
  const to = scrollLeft + visibleWidth + bufferPx
  const start = findColumnIndex(layout.centerOffsets, from)
  const last = findColumnIndex(layout.centerOffsets, to)
  // a column that starts exactly on the right edge has no visible pixels
  let end = layout.centerOffsets[last]! >= to ? last : last + 1
  end = Math.min(count, Math.max(end, start + 1))
  return { start, end }
}
