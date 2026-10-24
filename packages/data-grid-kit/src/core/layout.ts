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

/** below this a `flex` column does not shrink when the others leave it no room (a scrollbar appears instead) */
const FLEX_FLOOR = 100

/**
 * The widths of the `flex` columns: what the fixed columns leave of the viewport, shared in proportion to `flex`, each within
 * its `minWidth` / `maxWidth` (a column that hits a limit takes it and the rest share what is left). A column the user resized
 * counts as fixed. With no room at all every flex column keeps its floor.
 */
function flexWidthsOf<R>(
  cols: ColumnDef<R>[],
  resized: Record<string, number>,
  viewportWidth: number,
  clamp: (col: ColumnDef<R> | undefined, w: number) => number,
): Map<string, number> {
  const out = new Map<string, number>()
  let flexing = cols.filter((c) => (c.flex ?? 0) > 0 && resized[c.field] === undefined)
  if (flexing.length === 0) return out
  const isFlexing = new Set(flexing.map((c) => c.field))
  let free = viewportWidth
  for (const c of cols) if (!isFlexing.has(c.field)) free -= clamp(c, resized[c.field] ?? c.width ?? DEFAULT_COLUMN_WIDTH)
  const floorOf = (c: ColumnDef<R>) => c.minWidth ?? FLEX_FLOOR
  while (flexing.length > 0) {
    const total = flexing.reduce((s, c) => s + c.flex!, 0)
    const share = (c: ColumnDef<R>) => (free * c.flex!) / total
    const low = flexing.find((c) => share(c) < floorOf(c))
    const high = low ? undefined : flexing.find((c) => c.maxWidth !== undefined && share(c) > c.maxWidth)
    const stuck = low ?? high
    if (!stuck) {
      for (const c of flexing) out.set(c.field, Math.floor(share(c)))
      break
    }
    const w = low ? floorOf(stuck) : stuck.maxWidth!
    out.set(stuck.field, w)
    free -= w
    flexing = flexing.filter((c) => c !== stuck)
  }
  return out
}

/**
 * Resolve visibility, order and pinning into three column groups.
 * Pinned columns keep the order they were pinned in; the rest follow `columnOrder`.
 */
export function computeColumnLayout<R>(
  columns: ColumnDef<R>[],
  state: Pick<GridState, 'columnOrder' | 'columnWidths' | 'columnVisibility' | 'pinnedColumns'>,
  /** the width the columns have to share: only needed (and only used) when a column has `flex` */
  viewportWidth = 0,
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

  const clamp = (col: ColumnDef<R> | undefined, w: number) => Math.min(col?.maxWidth ?? Infinity, Math.max(col?.minWidth ?? DEFAULT_MIN_WIDTH, w))
  const flexWidths = flexWidthsOf([...left, ...center, ...right], state.columnWidths, viewportWidth, clamp)
  const width = (field: string) => {
    const col = byField.get(field)
    return clamp(col, state.columnWidths[field] ?? flexWidths.get(field) ?? col?.width ?? DEFAULT_COLUMN_WIDTH)
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
