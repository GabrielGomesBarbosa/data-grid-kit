import type { RowId } from './types'

/** One end of a range. Ranges are anchored to a row id and a field, so they survive sorting and filtering. */
export interface CellPoint {
  rowId: RowId
  field: string
}

export interface CellRange {
  anchor: CellPoint
  focus: CellPoint
}

/** A range resolved against the current rows and columns: inclusive indices into `rows` and `layout.all`. */
export interface RangeRect {
  r0: number
  r1: number
  c0: number
  c1: number
}

export function resolveRange(
  range: CellRange,
  rowIndex: (id: RowId) => number,
  colIndex: (field: string) => number,
): RangeRect | null {
  const ra = rowIndex(range.anchor.rowId)
  const rf = rowIndex(range.focus.rowId)
  const ca = colIndex(range.anchor.field)
  const cf = colIndex(range.focus.field)
  if (ra < 0 || rf < 0 || ca < 0 || cf < 0) return null // an end is filtered out, collapsed away or hidden
  return { r0: Math.min(ra, rf), r1: Math.max(ra, rf), c0: Math.min(ca, cf), c1: Math.max(ca, cf) }
}

export const rectContains = (r: RangeRect, row: number, col: number) =>
  row >= r.r0 && row <= r.r1 && col >= r.c0 && col <= r.c1

export const rectCells = (r: RangeRect) => (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1)

export const rectsEqual = (a: RangeRect, b: RangeRect) =>
  a.r0 === b.r0 && a.r1 === b.r1 && a.c0 === b.c0 && a.c1 === b.c1

/** Total distinct cells covered by several (possibly overlapping) rectangles. */
export function countCells(rects: RangeRect[]): number {
  if (rects.length === 1) return rectCells(rects[0]!)
  // overlap is rare and ranges are few: inclusion by row sweep instead of allocating one entry per cell
  const rows = new Set<number>()
  for (const r of rects) for (let i = r.r0; i <= r.r1; i++) rows.add(i)
  let total = 0
  for (const row of rows) {
    const spans = rects.filter((r) => row >= r.r0 && row <= r.r1).map((r) => [r.c0, r.c1] as const).sort((a, b) => a[0] - b[0])
    let end = -1
    for (const [a, b] of spans) {
      if (b <= end) continue
      total += b - Math.max(a, end + 1) + 1
      end = b
    }
  }
  return total
}

/** How a dragged fill extends a source rectangle: one axis only, whichever the pointer went further along. */
export function fillTarget(source: RangeRect, row: number, col: number): RangeRect | null {
  const down = Math.max(0, row - source.r1)
  const up = Math.max(0, source.r0 - row)
  const right = Math.max(0, col - source.c1)
  const left = Math.max(0, source.c0 - col)
  const vertical = Math.max(down, up)
  const horizontal = Math.max(right, left)
  if (vertical === 0 && horizontal === 0) return null
  if (vertical >= horizontal) {
    return down >= up
      ? { r0: source.r1 + 1, r1: row, c0: source.c0, c1: source.c1 }
      : { r0: row, r1: source.r0 - 1, c0: source.c0, c1: source.c1 }
  }
  return right >= left
    ? { r0: source.r0, r1: source.r1, c0: source.c1 + 1, c1: col }
    : { r0: source.r0, r1: source.r1, c0: col, c1: source.c0 - 1 }
}

/**
 * The value of a numeric series that a fill continues: `values` (the source cells along the fill direction, in order) are numbers a
 * constant step apart, and `offset` says how far the cell is from the end of the source (positive: after the last, negative: before the
 * first, counted from -1). `undefined` when it is not a series (fewer than two numbers, or no constant step): the fill then repeats.
 */
export function seriesValue(values: unknown[], offset: number): number | undefined {
  if (values.length < 2 || !values.every((v) => typeof v === 'number' && Number.isFinite(v))) return undefined
  const nums = values as number[]
  const step = nums[1]! - nums[0]!
  for (let i = 2; i < nums.length; i++) if (Math.abs(nums[i]! - nums[i - 1]! - step) > 1e-9) return undefined
  const value = offset > 0 ? nums[nums.length - 1]! + step * offset : nums[0]! + step * offset
  return Math.round(value * 1e9) / 1e9 // 0.1 + 0.2 is not a number to show
}

/** Which source cell supplies each cell of a fill: the source pattern repeats, in both directions. */
export function fillSourceOf(source: RangeRect, row: number, col: number): { row: number; col: number } {
  const h = source.r1 - source.r0 + 1
  const w = source.c1 - source.c0 + 1
  const mod = (n: number, m: number) => ((n % m) + m) % m
  return { row: source.r0 + mod(row - source.r0, h), col: source.c0 + mod(col - source.c0, w) }
}
