import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createPipeline, type PipelineInput } from './pipeline'
import { scrollToCell } from './keyboard'
import { computeColumnLayout } from './layout'
import { useGrid } from './useGrid'
import type { ColumnDef, RowId } from './types'

interface Item {
  id: number
  name: string
  qty: number
}
const items: Item[] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `n${i + 1}`, qty: (i * 7) % 10 }))
const columns: ColumnDef<Item>[] = [{ field: 'name' }, { field: 'qty', type: 'number' }]

const input = (over: Partial<PipelineInput<Item>> = {}): PipelineInput<Item> => ({
  rows: items,
  columns,
  getRowId: (r) => r.id,
  sortModel: [],
  filterModel: { items: [] },
  rowGroupingModel: [],
  expandedIds: new Set(),
  expandAllByDefault: false,
  ...over,
})

describe('hidden (pinned) rows in the pipeline', () => {
  it('leave the main list, the root count and pagination', () => {
    const run = createPipeline<Item>()
    const hidden = new Set<RowId>([2, 9])
    const out = run(input({ hiddenIds: hidden, pagination: { page: 0, pageSize: 4 } }))
    expect(out.rows.map((r) => r.id)).toEqual([1, 3, 4, 5])
    expect(out.rootCount).toBe(8)
    expect(out.filteredCount).toBe(8)
    expect(out.getRow(2)!.name).toBe('n2') // still reachable by id
  })

  it('do not affect sorting of the rest, and come back when unhidden', () => {
    const run = createPipeline<Item>()
    const sort = { sortModel: [{ field: 'qty', direction: 'desc' as const }, { field: 'id', direction: 'asc' as const }] }
    const all = run(input(sort)).rows.map((r) => r.id)
    const withHidden = run(input({ ...sort, hiddenIds: new Set<RowId>([all[0]!]) })).rows.map((r) => r.id)
    expect(withHidden).toEqual(all.slice(1))
    expect(run(input({ ...sort })).rows.map((r) => r.id)).toEqual(all)
  })
})

describe('pinRow in the grid', () => {
  const opts = { rows: items, columns, getRowId: (r: Item) => r.id, pagination: false as const }

  it('moves rows out of the scrolling list, keeps pin order, and unpins', () => {
    const { result } = renderHook(() => useGrid(opts))
    act(() => {
      result.current.api.pinRow(5, 'top')
      result.current.api.pinRow(2, 'top')
      result.current.api.pinRow(8, 'bottom')
    })
    expect(result.current.pinnedTop.map((r) => r.id)).toEqual([5, 2])
    expect(result.current.pinnedBottom.map((r) => r.id)).toEqual([8])
    expect(result.current.rows.map((r) => r.id)).toEqual([1, 3, 4, 6, 7, 9, 10])
    act(() => result.current.api.pinRow(5, 'bottom')) // moving between sides
    expect(result.current.pinnedTop.map((r) => r.id)).toEqual([2])
    expect(result.current.pinnedBottom.map((r) => r.id)).toEqual([8, 5])
    act(() => result.current.api.pinRow(2, null))
    expect(result.current.rows.map((r) => r.id)).toContain(2)
  })

  it('pinned rows ignore sorting and filtering', () => {
    const { result } = renderHook(() => useGrid(opts))
    act(() => result.current.api.pinRow(3, 'top'))
    act(() => result.current.api.setFilterModel({ items: [{ field: 'name', operator: 'equals', value: 'n7' }] }))
    expect(result.current.rows.map((r) => r.id)).toEqual([7])
    expect(result.current.pinnedTop.map((r) => r.id)).toEqual([3]) // does not match, still shown
  })

  it('ignores pins while grouping, and shows them again afterwards', () => {
    const { result } = renderHook(() => useGrid(opts))
    act(() => result.current.api.pinRow(3, 'top'))
    act(() => result.current.api.setRowGroupingModel(['name']))
    expect(result.current.pinnedTop).toEqual([])
    expect(result.current.rows).toHaveLength(10) // all ten groups, nothing hidden
    act(() => result.current.api.setRowGroupingModel([]))
    expect(result.current.pinnedTop.map((r) => r.id)).toEqual([3])
  })

  it('a pinned row that gets removed simply disappears', () => {
    const { result } = renderHook(() => useGrid(opts))
    act(() => result.current.api.pinRow(4, 'top'))
    act(() => result.current.api.updateRows({ remove: [4] }))
    expect(result.current.pinnedTop).toEqual([])
    expect(result.current.rows.map((r) => r.id)).not.toContain(4)
  })

  it('CSV lists pinned-top, scrolling, then pinned-bottom rows', () => {
    const { result } = renderHook(() => useGrid(opts))
    act(() => {
      result.current.api.pinRow(6, 'top')
      result.current.api.pinRow(1, 'bottom')
    })
    const ids = result.current.api.getCsv({ bom: false }).split('\r\n').slice(1).map((l) => l.split(',')[0])
    expect(ids).toEqual(['n6', 'n2', 'n3', 'n4', 'n5', 'n7', 'n8', 'n9', 'n10', 'n1'])
  })

  it('edits to a pinned row apply to it', async () => {
    const { result } = renderHook(() => useGrid({ ...opts, columns: [{ field: 'name', editable: true }, columns[1]!] }))
    act(() => result.current.api.pinRow(6, 'top'))
    act(() => void result.current.api.startEdit(6, 'name'))
    await act(async () => void (await result.current.api.commitEdit('renamed')))
    expect(result.current.pinnedTop[0]!.row!.name).toBe('renamed')
  })
})

describe('scrolling accounts for pinned rows', () => {
  it('uses the shorter visible body when rows are pinned', () => {
    const cols: ColumnDef<Item>[] = [{ field: 'a', width: 100 }]
    const layout = computeColumnLayout(cols, { columnOrder: [], columnWidths: {}, columnVisibility: {}, pinnedColumns: { left: [], right: [] } })
    const viewport = { width: 400, height: 240 }
    // header 40, rows 36: without pins the body shows 200px, with 2 pinned rows (72px) only 128px
    const without = scrollToCell(layout, 'a', 5, { top: 0, left: 0 }, viewport, 36, 40, 0).top
    const withPins = scrollToCell(layout, 'a', 5, { top: 0, left: 0 }, viewport, 36, 40, 72).top
    expect(without).toBe(5 * 36 + 36 - 200)
    expect(withPins).toBe(5 * 36 + 36 - 128)
  })
})
