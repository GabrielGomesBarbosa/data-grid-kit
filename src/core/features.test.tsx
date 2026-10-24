import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createPipeline, type PipelineInput } from './pipeline'
import { computeColumnLayout } from './layout'
import { navigate, scrollToCell, isPrintableKey } from './keyboard'
import { toCsv } from './csv'
import { coerceFilterValue, getFilterOperators, parseDateInput, formatDateInput } from './columns'
import { useGrid } from './useGrid'
import type { ColumnDef, GridOptions } from './types'

interface Item {
  id: number
  name: string
  qty: number
  due: Date
  done: boolean
}

const items: Item[] = [
  { id: 1, name: 'Alpha', qty: 5, due: new Date(2024, 0, 10), done: false },
  { id: 2, name: '=SUM(A1)', qty: 12, due: new Date(2024, 5, 1), done: true },
  { id: 3, name: 'Gamma, "quoted"', qty: -3, due: new Date(2023, 11, 25), done: false },
]

const columns: ColumnDef<Item>[] = [
  { field: 'name', editable: true },
  { field: 'qty', type: 'number', editable: true },
  { field: 'due', type: 'date' },
  { field: 'done', type: 'boolean' },
]

const pipelineInput = (over: Partial<PipelineInput<Item>> = {}): PipelineInput<Item> => ({
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

describe('typed filters', () => {
  it('compares numbers numerically, not as text', () => {
    const run = createPipeline<Item>()
    const out = run(pipelineInput({ filterModel: { items: [{ field: 'qty', operator: 'gt', value: '4' }] } }))
    expect(out.rows.map((r) => r.id)).toEqual([1, 2])
    const eq = run(pipelineInput({ filterModel: { items: [{ field: 'qty', operator: 'equals', value: '5' }] } }))
    expect(eq.rows.map((r) => r.id)).toEqual([1])
  })

  it('parses date inputs as local dates and compares by day', () => {
    const run = createPipeline<Item>()
    const out = run(pipelineInput({ filterModel: { items: [{ field: 'due', operator: 'gte', value: '2024-01-10' }] } }))
    expect(out.rows.map((r) => r.id)).toEqual([1, 2])
    const eq = run(pipelineInput({ filterModel: { items: [{ field: 'due', operator: 'equals', value: '2024-06-01' }] } }))
    expect(eq.rows.map((r) => r.id)).toEqual([2])
  })

  it('ignores a value that does not parse instead of hiding every row', () => {
    const run = createPipeline<Item>()
    const out = run(pipelineInput({ filterModel: { items: [{ field: 'qty', operator: 'gt', value: 'abc' }] } }))
    expect(out.rows).toHaveLength(3)
  })

  it('exposes operators per column type', () => {
    expect(getFilterOperators({ type: 'string' }).map((o) => o.value)).toContain('contains')
    expect(getFilterOperators({ type: 'number' }).map((o) => o.value)).toContain('gte')
    expect(getFilterOperators({ type: 'boolean' }).map((o) => o.value)).toEqual(['equals'])
    expect(coerceFilterValue({ type: 'number' }, '7')).toBe(7)
    expect(formatDateInput(parseDateInput('2024-02-29')!)).toBe('2024-02-29')
    expect(parseDateInput('nope')).toBeNull()
  })
})

describe('keyboard navigation', () => {
  const base = { rowCount: 10, colCount: 4, pageRows: 5 }
  it('moves with arrows and clamps at the edges', () => {
    expect(navigate({ ...base, key: 'ArrowDown', row: 0, col: 0 })).toEqual({ row: 1, col: 0 })
    expect(navigate({ ...base, key: 'ArrowUp', row: 0, col: 0 })).toEqual({ row: 0, col: 0 })
    expect(navigate({ ...base, key: 'ArrowRight', row: 0, col: 3 })).toEqual({ row: 0, col: 3 })
  })
  it('handles Home/End and Ctrl variants', () => {
    expect(navigate({ ...base, key: 'End', row: 3, col: 0 })).toEqual({ row: 3, col: 3 })
    expect(navigate({ ...base, key: 'Home', row: 3, col: 2, ctrl: true })).toEqual({ row: 0, col: 0 })
    expect(navigate({ ...base, key: 'End', row: 3, col: 0, ctrl: true })).toEqual({ row: 9, col: 3 })
  })
  it('pages by the visible row count', () => {
    expect(navigate({ ...base, key: 'PageDown', row: 2, col: 1 })).toEqual({ row: 7, col: 1 })
    expect(navigate({ ...base, key: 'PageUp', row: 2, col: 1 })).toEqual({ row: 0, col: 1 })
  })
  it('Tab wraps rows and releases focus at both ends', () => {
    expect(navigate({ ...base, key: 'Tab', row: 0, col: 3 })).toEqual({ row: 1, col: 0 })
    expect(navigate({ ...base, key: 'Tab', shift: true, row: 1, col: 0 })).toEqual({ row: 0, col: 3 })
    expect(navigate({ ...base, key: 'Tab', row: 9, col: 3 })).toBeNull()
    expect(navigate({ ...base, key: 'Tab', shift: true, row: 0, col: 0 })).toBeNull()
  })
  it('ignores other keys and empty grids', () => {
    expect(navigate({ ...base, key: 'a', row: 0, col: 0 })).toBeNull()
    expect(navigate({ ...base, key: 'ArrowDown', row: 0, col: 0, rowCount: 0 })).toBeNull()
    expect(isPrintableKey({ key: 'a' })).toBe(true)
    expect(isPrintableKey({ key: 'a', ctrlKey: true })).toBe(false)
    expect(isPrintableKey({ key: 'Enter' })).toBe(false)
  })

  it('scrolls the minimum distance, respecting pinned columns and the header', () => {
    const cols: ColumnDef<Item>[] = Array.from({ length: 20 }, (_, i) => ({ field: `c${i}`, width: 100 }))
    const layout = computeColumnLayout(cols, {
      columnOrder: [],
      columnWidths: {},
      columnVisibility: {},
      pinnedColumns: { left: ['c0'], right: [] },
    })
    const viewport = { width: 500, height: 240 } // 200px body with a 40px header
    // visible center width = 500 - 100 = 400; c10 is at 900..1000 (center index 9)
    expect(scrollToCell(layout, 'c10', 0, { top: 0, left: 0 }, viewport, 36, 40)).toEqual({ top: 0, left: 600 })
    // already visible: unchanged
    expect(scrollToCell(layout, 'c2', 3, { top: 0, left: 0 }, viewport, 36, 40)).toEqual({ top: 0, left: 0 })
    // row below the fold
    expect(scrollToCell(layout, 'c2', 10, { top: 0, left: 0 }, viewport, 36, 40).top).toBe(10 * 36 + 36 - 200)
    // pinned columns never need horizontal scroll
    expect(scrollToCell(layout, 'c0', 0, { top: 0, left: 300 }, viewport, 36, 40).left).toBe(300)
  })
})

describe('csv export', () => {
  it('quotes delimiters, quotes and newlines; BOM and CRLF', () => {
    const csv = toCsv(columns.slice(0, 2), [items[2]!], { escapeFormulas: false })
    expect(csv).toBe('﻿name,qty\r\n"Gamma, ""quoted""",-3')
  })
  it('neutralises spreadsheet formulas in text but never in numbers', () => {
    const csv = toCsv(columns.slice(0, 2), [items[1]!, items[2]!], { bom: false, escapeFormulas: true })
    const lines = csv.split('\r\n')
    expect(lines[1]).toBe("'=SUM(A1),12")
    expect(lines[2]).toBe('"Gamma, ""quoted""",-3') // -3 is a number: untouched
  })
  it('formats dates and booleans, honours delimiter and header toggle', () => {
    const csv = toCsv(columns.slice(2), [items[0]!], { bom: false, delimiter: ';', includeHeaders: false })
    expect(csv).toBe('2024-01-10;false')
  })
})

/* ---------------------------------------------------------------- editing */

const opts = (over: Partial<GridOptions<Item>> = {}): GridOptions<Item> => ({
  rows: items,
  columns,
  getRowId: (r) => r.id,
  pagination: false,
  ...over,
})

describe('cell editing', () => {
  it('only editable columns on data rows can enter edit mode', () => {
    const { result } = renderHook(() => useGrid(opts()))
    expect(result.current.api.isCellEditable(1, 'name')).toBe(true)
    expect(result.current.api.isCellEditable(1, 'due')).toBe(false)
    expect(result.current.api.isCellEditable(999, 'name')).toBe(false)
    act(() => void result.current.api.startEdit(1, 'due'))
    expect(result.current.state.editingCell).toBeNull()
  })

  it('isCellEditable can veto individual cells', () => {
    const { result } = renderHook(() => useGrid(opts({ isCellEditable: (row) => row.id !== 2 })))
    expect(result.current.api.isCellEditable(1, 'name')).toBe(true)
    expect(result.current.api.isCellEditable(2, 'name')).toBe(false)
  })

  it('commits through processRowUpdate and shows the returned row', async () => {
    const processRowUpdate = vi.fn(async (n: Item) => ({ ...n, name: n.name.toUpperCase() }))
    const { result } = renderHook(() => useGrid(opts({ processRowUpdate })))
    act(() => void result.current.api.startEdit(1, 'name', 'x'))
    expect(result.current.state.editingCell).toEqual({ rowId: 1, field: 'name', seed: 'x' })
    await act(async () => void (await result.current.api.commitEdit('beta')))
    expect(processRowUpdate).toHaveBeenCalledWith({ ...items[0], name: 'beta' }, items[0])
    expect(result.current.rows.find((r) => r.id === 1)!.row!.name).toBe('BETA')
    expect(result.current.state.editingCell).toBeNull()
  })

  it('keeps editing and reports when processRowUpdate rejects', async () => {
    const onError = vi.fn()
    const { result } = renderHook(() =>
      useGrid(opts({ processRowUpdate: () => Promise.reject(new Error('nope')), onProcessRowUpdateError: onError })),
    )
    act(() => void result.current.api.startEdit(1, 'name'))
    let ok = true
    await act(async () => void (ok = await result.current.api.commitEdit('beta')))
    expect(ok).toBe(false)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(result.current.state.editingCell).not.toBeNull()
    expect(result.current.rows.find((r) => r.id === 1)!.row!.name).toBe('Alpha')
  })

  it('does not call processRowUpdate when nothing changed, and Escape discards', async () => {
    const processRowUpdate = vi.fn(async (n: Item) => n)
    const { result } = renderHook(() => useGrid(opts({ processRowUpdate })))
    act(() => void result.current.api.startEdit(1, 'name'))
    await act(async () => void (await result.current.api.commitEdit('Alpha')))
    expect(processRowUpdate).not.toHaveBeenCalled()
    act(() => void result.current.api.startEdit(1, 'name'))
    act(() => result.current.api.cancelEdit())
    expect(result.current.state.editingCell).toBeNull()
  })

  it('edited rows re-enter sorting and filtering', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.setSortModel([{ field: 'qty', direction: 'asc' }]))
    expect(result.current.rows.map((r) => r.id)).toEqual([3, 1, 2])
    act(() => void result.current.api.startEdit(3, 'qty'))
    await act(async () => void (await result.current.api.commitEdit(100)))
    expect(result.current.rows.map((r) => r.id)).toEqual([1, 2, 3])
  })

  it('discards edits when the rows prop is replaced', async () => {
    const { result, rerender } = renderHook((p: { rows: Item[] }) => useGrid(opts({ rows: p.rows })), {
      initialProps: { rows: items },
    })
    act(() => void result.current.api.startEdit(1, 'name'))
    await act(async () => void (await result.current.api.commitEdit('edited')))
    expect(result.current.rows.find((r) => r.id === 1)!.row!.name).toBe('edited')
    rerender({ rows: [...items] })
    expect(result.current.rows.find((r) => r.id === 1)!.row!.name).toBe('Alpha')
  })

  it('columns with valueGetter need a valueSetter to be editable', () => {
    const cols: ColumnDef<Item>[] = [
      { field: 'total', editable: true, valueGetter: (r) => r.qty * 2 },
      { field: 'half', editable: true, valueGetter: (r) => r.qty / 2, valueSetter: (v, r) => ({ ...r, qty: Number(v) * 2 }) },
    ]
    const { result } = renderHook(() => useGrid(opts({ columns: cols })))
    expect(result.current.api.isCellEditable(1, 'total')).toBe(false)
    expect(result.current.api.isCellEditable(1, 'half')).toBe(true)
  })

  it('getCsv exports filtered rows in sorted order across pages, and selected rows only', () => {
    const { result } = renderHook(() => useGrid(opts({ pagination: true, initialState: { paginationModel: { page: 0, pageSize: 1 } } })))
    act(() => result.current.api.setSortModel([{ field: 'qty', direction: 'desc' }]))
    const all = result.current.api.getCsv({ bom: false }).split('\r\n')
    expect(all).toHaveLength(4) // header + 3 rows even though the page holds 1
    expect(all[1]!.startsWith("'=SUM(A1)")).toBe(true)
    act(() => result.current.api.toggleSelection(1, true))
    const picked = result.current.api.getCsv({ bom: false, selectedOnly: true }).split('\r\n')
    expect(picked).toHaveLength(2)
    expect(picked[1]!.startsWith('Alpha')).toBe(true)
  })

  it('focusCell moves focus and leaves edit mode when the cell changes', () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => void result.current.api.startEdit(1, 'name'))
    act(() => result.current.api.focusCell({ rowId: 1, field: 'name' }))
    expect(result.current.state.editingCell).not.toBeNull()
    act(() => result.current.api.focusCell({ rowId: 2, field: 'name' }))
    expect(result.current.state.editingCell).toBeNull()
    expect(result.current.state.focusedCell).toEqual({ rowId: 2, field: 'name' })
  })
})
