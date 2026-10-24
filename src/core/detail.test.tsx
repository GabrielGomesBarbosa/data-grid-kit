import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGrid, DETAIL_ESTIMATE } from './useGrid'
import type { ColumnDef, GridOptions } from './types'

interface Item {
  id: number
  name: string
  big: boolean
}
const items: Item[] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `r${i + 1}`, big: i % 2 === 0 }))
const columns: ColumnDef<Item>[] = [{ field: 'name', editable: true }]
const opts = (over: Partial<GridOptions<Item>> = {}): GridOptions<Item> => ({
  rows: items,
  columns,
  pagination: false,
  rowHeight: 10,
  headerHeight: 10,
  ...over,
})

describe('detail panels in the grid', () => {
  it('are off unless detailPanelHeight is set', () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.toggleDetailPanel(3))
    expect(result.current.detailSlots).toEqual([])
    expect(result.current.geometry.totalHeight).toBe(100)
  })

  it('open and close, and push the rows below down', () => {
    const { result } = renderHook(() => useGrid(opts({ detailPanelHeight: 50 })))
    act(() => result.current.api.toggleDetailPanel(3))
    expect(result.current.detailSlots).toEqual([{ id: 3, index: 2, height: 50, auto: false }])
    expect(result.current.geometry.topOf(2)).toBe(20)
    expect(result.current.geometry.topOf(3)).toBe(80) // 30 + the 50px panel
    expect(result.current.geometry.totalHeight).toBe(150)
    act(() => result.current.api.toggleDetailPanel(3))
    expect(result.current.detailSlots).toEqual([])
    act(() => result.current.api.toggleDetailPanel(3, true))
    act(() => result.current.api.toggleDetailPanel(3, true)) // already open: stays open
    expect(result.current.state.detailPanelExpanded).toEqual([3])
  })

  it('keeps panels in row order whatever order they were opened in', () => {
    const { result } = renderHook(() => useGrid(opts({ detailPanelHeight: 20 })))
    act(() => {
      result.current.api.toggleDetailPanel(7)
      result.current.api.toggleDetailPanel(2)
    })
    expect(result.current.detailSlots.map((s) => s.index)).toEqual([1, 6])
  })

  it('height can depend on the row, and a row can opt out', () => {
    const { result } = renderHook(() =>
      useGrid(opts({ detailPanelHeight: (r) => (r.big ? 100 : 30), isDetailPanelAvailable: (r) => r.id !== 4 })),
    )
    act(() => result.current.api.setDetailPanelExpanded([1, 2, 4]))
    expect(result.current.detailSlots.map((s) => [s.id, s.height])).toEqual([[1, 100], [2, 30]]) // 4 has no panel
  })

  it("'auto' uses an estimate until the content is measured, then the measurement", () => {
    const { result } = renderHook(() => useGrid(opts({ detailPanelHeight: 'auto' })))
    act(() => result.current.api.toggleDetailPanel(5))
    expect(result.current.detailSlots[0]).toMatchObject({ height: DETAIL_ESTIMATE, auto: true })
    act(() => result.current.api.setDetailPanelHeight(5, 73))
    expect(result.current.detailSlots[0]!.height).toBe(73)
    act(() => result.current.api.setDetailPanelHeight(5, 73.4)) // sub-pixel change: ignored, no re-render storm
    expect(result.current.state.detailHeights[5]).toBe(73)
  })

  it('open panels follow their row when the rows are sorted, and ignore rows that are filtered out', () => {
    const { result } = renderHook(() => useGrid(opts({ detailPanelHeight: 20 })))
    act(() => result.current.api.toggleDetailPanel(1))
    act(() => result.current.api.setSortModel([{ field: 'name', direction: 'desc' }]))
    const idx = result.current.rows.findIndex((r) => r.id === 1)
    expect(result.current.detailSlots[0]!.index).toBe(idx)
    act(() => result.current.api.setFilterModel({ items: [{ field: 'name', operator: 'equals', value: 'r2' }] }))
    expect(result.current.detailSlots).toEqual([]) // row 1 is not shown, so neither is its panel
    act(() => result.current.api.setFilterModel({ items: [] }))
    expect(result.current.detailSlots).toHaveLength(1) // still open when it comes back
  })

  it('renders only the panels near the viewport', () => {
    const { result } = renderHook(() => useGrid(opts({ detailPanelHeight: 400, rowBufferPx: 0 })))
    act(() => {
      result.current.api.setViewport(300, 60) // 10px header + 50px of rows
      result.current.api.setDetailPanelExpanded([1, 8])
    })
    // row 1's panel spans 10..410; row 8 (index 7) sits at 70 + 400 = 470 and its panel spans 480..880
    expect(result.current.detailRange).toEqual({ start: 0, end: 1 })
    act(() => result.current.api.setScroll(420, 0)) // window 420..470: between the two panels
    expect(result.current.detailRange.end - result.current.detailRange.start).toBe(0)
    act(() => result.current.api.setScroll(500, 0)) // window 500..550: inside row 8's panel, whose row is above the window
    expect(result.current.detailRange).toEqual({ start: 1, end: 2 })
  })
})

describe('moving rows through the grid', () => {
  const rowsOpts = (over: Partial<GridOptions<Item>> = {}) => opts({ rowReordering: true, ...over })

  it('moveRow reorders and reports old and target index of the data order', () => {
    const onRowOrderChange = vi.fn()
    const { result } = renderHook(() => useGrid(rowsOpts({ onRowOrderChange })))
    let moved = false
    act(() => void (moved = result.current.api.moveRow(2, { before: 6 })))
    expect(moved).toBe(true)
    expect(result.current.rows.map((r) => r.id)).toEqual([1, 3, 4, 5, 2, 6, 7, 8, 9, 10])
    expect(onRowOrderChange).toHaveBeenCalledWith({ rowId: 2, row: items[1], oldIndex: 1, targetIndex: 4 })
    act(() => void result.current.api.moveRow(9, { after: 1 }))
    expect(result.current.rows.map((r) => r.id).slice(0, 3)).toEqual([1, 9, 3])
    expect(onRowOrderChange).toHaveBeenLastCalledWith({ rowId: 9, row: items[8], oldIndex: 8, targetIndex: 1 })
  })

  it('moving to the end, and "after the last row"', () => {
    const { result } = renderHook(() => useGrid(rowsOpts()))
    act(() => void result.current.api.moveRow(1, { before: null }))
    expect(result.current.rows.map((r) => r.id).at(-1)).toBe(1)
    act(() => void result.current.api.moveRow(5, { after: 1 }))
    expect(result.current.rows.map((r) => r.id).slice(-2)).toEqual([1, 5])
  })

  it('does nothing (and says so) for no-ops and unknown rows', () => {
    const onRowOrderChange = vi.fn()
    const { result } = renderHook(() => useGrid(rowsOpts({ onRowOrderChange })))
    let r: boolean[] = []
    act(() => {
      r = [
        result.current.api.moveRow(3, { before: 4 }), // already right there
        result.current.api.moveRow(3, { after: 2 }), // same place from the other side
        result.current.api.moveRow(3, { before: 3 }),
        result.current.api.moveRow(99, { before: 1 }),
        result.current.api.moveRow(1, { before: 99 }),
      ]
    })
    expect(r).toEqual([false, false, false, false, false])
    expect(onRowOrderChange).not.toHaveBeenCalled()
  })

  it('indices are in the data order even when a filter hides rows', () => {
    const onRowOrderChange = vi.fn()
    const { result } = renderHook(() => useGrid(rowsOpts({ onRowOrderChange })))
    act(() => result.current.api.setFilterModel({ items: [{ field: 'name', operator: 'contains', value: 'r' }, { field: 'name', operator: 'equals', value: 'r3' }], logic: 'or' }))
    act(() => void result.current.api.moveRow(9, { before: 3 }))
    expect(onRowOrderChange).toHaveBeenCalledWith(expect.objectContaining({ oldIndex: 8, targetIndex: 2 }))
  })

  it('is refused for grouped and tree grids', () => {
    const { result } = renderHook(() => useGrid(rowsOpts({ initialState: { rowGroupingModel: ['name'] } })))
    let moved = true
    act(() => void (moved = result.current.api.moveRow(2, { before: 1 })))
    expect(moved).toBe(false)
  })

  it('reorderAllowed needs the option, a flat grid, no sorting, and nothing being edited', async () => {
    const { result } = renderHook(() => useGrid(rowsOpts()))
    expect(result.current.reorderAllowed).toBe(true)
    act(() => result.current.api.setSortModel([{ field: 'name', direction: 'asc' }]))
    expect(result.current.reorderAllowed).toBe(false)
    act(() => result.current.api.setSortModel([]))
    expect(result.current.reorderAllowed).toBe(true)
    act(() => void result.current.api.startEdit(1, 'name'))
    expect(result.current.reorderAllowed).toBe(false)
    act(() => result.current.api.cancelEdit())
    act(() => result.current.api.setRowGroupingModel(['name']))
    expect(result.current.reorderAllowed).toBe(false)
    expect(renderHook(() => useGrid(opts())).result.current.reorderAllowed).toBe(false) // option off
  })

  it('a move is kept while the owner has not updated rows, and accepted when it has', () => {
    const { result, rerender } = renderHook((p: { rows: Item[] }) => useGrid(rowsOpts({ rows: p.rows })), { initialProps: { rows: items } })
    act(() => void result.current.api.moveRow(4, { before: 1 }))
    expect(result.current.rows[0]!.id).toBe(4)
    const next = [items[3]!, items[0]!, items[1]!, items[2]!, ...items.slice(4)]
    rerender({ rows: next }) // the owner applied the same move
    expect(result.current.rows.map((r) => r.id)).toEqual(next.map((r) => r.id))
  })
})
