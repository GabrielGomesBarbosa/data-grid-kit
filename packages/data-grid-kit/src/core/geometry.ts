import type { GridOptions, RenderRow, RowId } from './types'

/**
 * Where rows sit vertically.
 *
 * Rows have one fixed height, except that a row can own a detail panel: a block of extra height
 * directly below it. With no panels everything is plain arithmetic (O(1)); with k panels open, positions
 * are found by binary search over a prefix sum of the panel heights (O(log k), plus O(log n) to find a row).
 *
 * Rows can also have their own heights (`heights`, one per row): positions then come from a prefix sum over the
 * rows (built once, O(n)), and a position is found by binary search (O(log n)).
 */

export interface DetailSlot {
  /** index of the row the panel belongs to (panels are sorted by it) */
  index: number
  height: number
}

export interface GeometryWindow {
  /** rows to render: [start, end) */
  start: number
  end: number
  /** panels to render: indices into `slots`, [slotStart, slotEnd) */
  slotStart: number
  slotEnd: number
}

export interface RowGeometry {
  /** the height of a row with no height of its own */
  readonly rowHeight: number
  /** the height of row `i` itself (not counting its panel) */
  heightOf(i: number): number
  readonly count: number
  readonly slots: readonly DetailSlot[]
  /** y of the top of row `i`, counting the panels of the rows above it */
  topOf(i: number): number
  /** y of the top of panel `k` (right under its row) */
  slotTop(k: number): number
  /** total height of the body: every row plus every panel */
  readonly totalHeight: number
  /** panels that belong to rows before `i`: the offset to add to aria-rowindex */
  slotsBefore(i: number): number
  /** the row whose band (its own height plus its panel) contains `y`; clamped to the valid rows */
  indexAt(y: number): number
  /** what to render for the vertical span [y0, y1] */
  window(y0: number, y1: number): GeometryWindow
}

export function createRowGeometry(rowHeight: number, count: number, slots: readonly DetailSlot[] = [], heights?: ArrayLike<number>): RowGeometry {
  const k = slots.length
  // offsets[i] = y of the top of row i counting rows only (no panels); only when rows have heights of their own
  let offsets: Float64Array | undefined
  if (heights) {
    offsets = new Float64Array(count + 1)
    for (let i = 0; i < count; i++) offsets[i + 1] = offsets[i]! + heights[i]!
  }
  const heightOf = (i: number) => (heights ? (heights[i] ?? rowHeight) : rowHeight)
  // cum[j] = total height of the first j panels
  const cum = new Float64Array(k + 1)
  for (let j = 0; j < k; j++) cum[j + 1] = cum[j]! + slots[j]!.height

  const slotsBefore = (i: number): number => {
    // number of panels whose row index is < i
    let lo = 0
    let hi = k
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (slots[mid]!.index < i) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  const above = (i: number) => (offsets ? offsets[i]! : i * rowHeight) // rows above row i, panels not counted
  const topOf = (i: number) => (k === 0 ? above(i) : above(i) + cum[slotsBefore(i)]!)
  const slotTop = (j: number) => above(slots[j]!.index + 1) + cum[j]!
  const totalHeight = above(count) + cum[k]!

  const indexAt = (y: number): number => {
    if (count === 0) return 0
    if (k === 0 && !offsets) return Math.max(0, Math.min(count - 1, Math.floor(y / rowHeight)))
    let lo = 0
    let hi = count - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (topOf(mid) <= y) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  const window = (y0: number, y1: number): GeometryWindow => {
    if (count === 0) return { start: 0, end: 0, slotStart: 0, slotEnd: 0 }
    const start = indexAt(Math.max(0, y0))
    const end = Math.min(count, indexAt(Math.max(0, y1)) + 1)
    // panels are ordered top to bottom: find the first one that ends below y0, take those starting above y1
    let lo = 0
    let hi = k
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (slotTop(mid) + slots[mid]!.height > y0) hi = mid
      else lo = mid + 1
    }
    let slotEnd = lo
    while (slotEnd < k && slotTop(slotEnd) < y1) slotEnd++
    return { start, end: Math.max(end, start), slotStart: lo, slotEnd }
  }

  return { rowHeight, heightOf, count, slots, topOf, slotTop, totalHeight, slotsBefore, indexAt, window }
}

/** the height of every row of `rows`, from `getRowHeight` (`'auto'` rows get `estimate` until they are measured) */
export function rowHeightsOf<R>(
  rows: readonly (RenderRow<R> | undefined)[],
  rowHeight: number,
  getRowHeight: NonNullable<GridOptions<R>['getRowHeight']>,
  estimate = rowHeight,
  /** what was measured for `'auto'` rows, by id */
  measured?: ReadonlyMap<RowId, number>,
): { heights: Float64Array; hasAuto: boolean } {
  const out = new Float64Array(rows.length)
  let hasAuto = false
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const h = r ? getRowHeight({ id: r.id, row: r.row, depth: r.depth }) : undefined
    if (h === 'auto') hasAuto = true
    out[i] = h === 'auto' ? (measured?.get(r!.id) ?? estimate) : typeof h === 'number' && h > 0 && Number.isFinite(h) ? h : rowHeight
  }
  return { heights: out, hasAuto }
}

export const windowsEqual = (a: GeometryWindow, b: GeometryWindow) =>
  a.start === b.start && a.end === b.end && a.slotStart === b.slotStart && a.slotEnd === b.slotEnd
