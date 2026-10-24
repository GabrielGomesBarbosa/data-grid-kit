import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGrid } from './useGrid'
import type { ColumnDef, GridOptions, PivotModel } from './types'

interface Sale {
  id: number
  region: string
  year: number
  amount: number
}
const rows: Sale[] = [
  { id: 1, region: 'N', year: 2024, amount: 100 },
  { id: 2, region: 'N', year: 2024, amount: 50 },
  { id: 3, region: 'S', year: 2023, amount: 300 },
  { id: 4, region: 'S', year: 2024, amount: 20 },
  { id: 5, region: 'W', year: 2024, amount: 90 },
]
const columns: ColumnDef<Sale>[] = [
  { field: 'region' },
  { field: 'year', type: 'number' },
  { field: 'amount', type: 'number' },
]
const model: PivotModel = { rows: ['region'], columns: [{ field: 'year' }], values: [{ field: 'amount', aggFunc: 'sum' }] }
const opts = (over: Partial<GridOptions<Sale>> = {}): GridOptions<Sale> => ({
  rows,
  columns,
  getRowId: (r) => r.id,
  pivoting: true,
  pivotTotals: true,
  pagination: false,
  initialState: { pivotMode: true, pivotModel: model, expandAllByDefault: true },
  ...over,
})
const order = (g: ReturnType<typeof useGrid<Sale>>) => g.result.rows.map((r) => r.groupValue)
const colOf = (g: ReturnType<typeof useGrid<Sale>>, pick: (c: ColumnDef<Sale>) => boolean) => g.layout.all.find(pick)!.field
const total = (c: ColumnDef<Sale>) => !!c.pivot?.total
const year = (y: string) => (c: ColumnDef<Sale>) => !c.pivot?.total && c.group?.[0] === y

describe('pivot: order the groups by a value column', () => {
  it('without a sort the groups follow the row labels', () => {
    const { result } = renderHook(() => useGrid<Sale>(opts()))
    expect(order(result.current)).toEqual(['N', 'S', 'W'])
  })

  it('the total column: descending puts the biggest group first, ascending the smallest', () => {
    const { result } = renderHook(() => useGrid<Sale>(opts()))
    const f = colOf(result.current, total)
    act(() => result.current.api.setSortModel([{ field: f, direction: 'desc' }]))
    expect(order(result.current)).toEqual(['S', 'N', 'W']) // 320, 150, 90
    act(() => result.current.api.setSortModel([{ field: f, direction: 'asc' }]))
    expect(order(result.current)).toEqual(['W', 'N', 'S'])
  })

  it('a column of one year orders by that year; groups without a value come last in both directions', () => {
    const { result } = renderHook(() => useGrid<Sale>(opts()))
    const f = colOf(result.current, year('2023')) // only S has 2023
    act(() => result.current.api.setSortModel([{ field: f, direction: 'asc' }]))
    expect(order(result.current)).toEqual(['S', 'N', 'W'])
    act(() => result.current.api.setSortModel([{ field: f, direction: 'desc' }]))
    expect(order(result.current)).toEqual(['S', 'N', 'W'])
  })

  it('paging applies after the order', () => {
    const { result } = renderHook(() =>
      useGrid<Sale>(opts({ pagination: true, initialState: { pivotMode: true, pivotModel: model, expandAllByDefault: true, paginationModel: { page: 0, pageSize: 1 } } })),
    )
    const f = colOf(result.current, total)
    act(() => result.current.api.setSortModel([{ field: f, direction: 'desc' }]))
    expect(order(result.current)).toEqual(['S'])
    act(() => result.current.api.setPage(2))
    expect(order(result.current)).toEqual(['W'])
  })

  it('the export follows the same order', () => {
    const { result } = renderHook(() => useGrid<Sale>(opts()))
    const f = colOf(result.current, total)
    act(() => result.current.api.setSortModel([{ field: f, direction: 'desc' }]))
    expect(result.current.result.getExportRows().map((r) => r.groupValue)).toEqual(['S', 'N', 'W'])
  })

  it('the value columns are sortable, and clearing the sort goes back to the labels', () => {
    const { result } = renderHook(() => useGrid<Sale>(opts()))
    const col = result.current.layout.all.find(total)!
    expect(col.sortable).toBe(true)
    act(() => result.current.api.toggleSort(col.field))
    expect(order(result.current)).toEqual(['W', 'N', 'S'])
    act(() => result.current.api.setSortModel([]))
    expect(order(result.current)).toEqual(['N', 'S', 'W'])
  })

  it('every level of a two-level pivot is ordered, not only the top', () => {
    const rows2: Sale[] = [
      { id: 1, region: 'N', year: 2024, amount: 10 },
      { id: 2, region: 'N', year: 2023, amount: 70 },
      { id: 3, region: 'N', year: 2022, amount: 40 },
    ]
    const two: PivotModel = { rows: ['region', 'year'], columns: [], values: [{ field: 'amount', aggFunc: 'sum' }] }
    const { result } = renderHook(() =>
      useGrid<Sale>(opts({ rows: rows2, initialState: { pivotMode: true, pivotModel: two, expandAllByDefault: true } })),
    )
    const f = colOf(result.current, total)
    act(() => result.current.api.setSortModel([{ field: f, direction: 'desc' }]))
    expect(result.current.result.rows.filter((r) => r.depth === 1).map((r) => r.groupValue)).toEqual([2023, 2022, 2024])
  })
})
