/**
 * Where rows sit vertically.
 *
 * Rows have one fixed height, except that a row can own a detail panel: a block of extra height
 * directly below it. With no panels everything is plain arithmetic (O(1)); with k panels open, positions
 * are found by binary search over a prefix sum of the panel heights (O(log k), plus O(log n) to find a row).
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
  readonly rowHeight: number
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

export function createRowGeometry(rowHeight: number, count: number, slots: readonly DetailSlot[] = []): RowGeometry {
  const k = slots.length
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
  const topOf = (i: number) => (k === 0 ? i * rowHeight : i * rowHeight + cum[slotsBefore(i)]!)
  const slotTop = (j: number) => slots[j]!.index * rowHeight + cum[j]! + rowHeight
  const totalHeight = count * rowHeight + cum[k]!

  const indexAt = (y: number): number => {
    if (count === 0) return 0
    if (k === 0) return Math.max(0, Math.min(count - 1, Math.floor(y / rowHeight)))
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

  return { rowHeight, count, slots, topOf, slotTop, totalHeight, slotsBefore, indexAt, window }
}

export const windowsEqual = (a: GeometryWindow, b: GeometryWindow) =>
  a.start === b.start && a.end === b.end && a.slotStart === b.slotStart && a.slotEnd === b.slotEnd
