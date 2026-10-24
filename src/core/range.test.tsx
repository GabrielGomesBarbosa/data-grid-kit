import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { countCells, fillSourceOf, fillTarget, resolveRange, type RangeRect } from './range'
import { cellToText, emptyValueFor, parseCellText, parseTsv, toTsv } from './clipboard'
import { useGrid } from './useGrid'
import type { ColumnDef, GridOptions } from './types'

describe('text <-> matrix', () => {
  it('quotes tabs, line breaks and quotes, and reads them back', () => {
    const m = [['a', 'b\tc', 'd"e'], ['line1\nline2', '', 'x']]
    const text = toTsv(m)
    expect(text).toBe('a\t"b\tc"\t"d""e"\n"line1\nline2"\t\tx')
    expect(parseTsv(text)).toEqual(m)
  })

  it('reads what spreadsheets put on the clipboard', () => {
    expect(parseTsv('1\t2\r\n3\t4\r\n')).toEqual([['1', '2'], ['3', '4']]) // CRLF and a trailing newline
    expect(parseTsv('only')).toEqual([['only']])
    expect(parseTsv('a\t\tb')).toEqual([['a', '', 'b']]) // empty cell in the middle
    expect(parseTsv('a\t')).toEqual([['a', '']]) // trailing empty cell
    expect(parseTsv('')).toEqual([])
    expect(parseTsv('"unterminated')).toEqual([['unterminated']]) // never throws on bad input
  })
})

describe('cell text', () => {
  const num: ColumnDef = { field: 'n', type: 'number' }
  const date: ColumnDef = { field: 'd', type: 'date' }
  const bool: ColumnDef = { field: 'b', type: 'boolean' }
  const sel: ColumnDef = { field: 's', type: 'singleSelect', valueOptions: ['a', { value: 'x', label: 'Ex' }] }
  const str: ColumnDef = { field: 't' }

  it('copies raw values', () => {
    expect(cellToText(num, { n: 12.5 })).toBe('12.5')
    expect(cellToText(date, { d: new Date(2024, 2, 9) })).toBe('2024-03-09')
    expect(cellToText(bool, { b: true })).toBe('true')
    expect(cellToText(str, { t: null })).toBe('')
  })

  it('parses by column type and says when it cannot', () => {
    expect(parseCellText(num, ' 7 ', {})).toEqual({ ok: true, value: 7 })
    expect(parseCellText(num, '', {})).toEqual({ ok: true, value: null })
    expect(parseCellText(num, 'abc', {})).toEqual({ ok: false })
    expect(parseCellText(date, '2024-03-09', {})).toEqual({ ok: true, value: new Date(2024, 2, 9) })
    expect(parseCellText(date, 'nope', {})).toEqual({ ok: false })
    expect(parseCellText(bool, 'Yes', {})).toEqual({ ok: true, value: true })
    expect(parseCellText(bool, '0', {})).toEqual({ ok: true, value: false })
    expect(parseCellText(bool, 'maybe', {})).toEqual({ ok: false })
    expect(parseCellText(sel, 'ex', {})).toEqual({ ok: true, value: 'x' }) // by label, case-insensitive
    expect(parseCellText(sel, 'A', {})).toEqual({ ok: true, value: 'a' })
    expect(parseCellText(sel, 'zzz', {})).toEqual({ ok: false })
    expect(parseCellText(str, ' keep spaces ', {})).toEqual({ ok: true, value: ' keep spaces ' })
  })

  it('a column valueParser takes over, and its errors mean "invalid"', () => {
    const money: ColumnDef = { field: 'm', valueParser: (t) => Number(t.replace('$', '')) }
    expect(parseCellText(money, '$40', {})).toEqual({ ok: true, value: 40 })
    const bad: ColumnDef = { field: 'x', valueParser: () => { throw new Error('no') } }
    expect(parseCellText(bad, 'a', {})).toEqual({ ok: false })
  })

  it('what delete leaves behind depends on the type', () => {
    expect(emptyValueFor(str)).toBe('')
    expect(emptyValueFor(num)).toBeNull()
  })
})

describe('ranges and fill planning', () => {
  it('resolves by id and field, in any drag direction, and gives up when an end is gone', () => {
    const rows = ['a', 'b', 'c', 'd']
    const cols = ['x', 'y', 'z']
    const idx = (id: string | number) => rows.indexOf(String(id))
    const cidx = (f: string) => cols.indexOf(f)
    expect(resolveRange({ anchor: { rowId: 'c', field: 'z' }, focus: { rowId: 'a', field: 'y' } }, idx, cidx)).toEqual({ r0: 0, r1: 2, c0: 1, c1: 2 })
    expect(resolveRange({ anchor: { rowId: 'gone', field: 'x' }, focus: { rowId: 'a', field: 'x' } }, idx, cidx)).toBeNull()
  })

  it('counts cells once even when ranges overlap', () => {
    const a: RangeRect = { r0: 0, r1: 2, c0: 0, c1: 1 } // 6
    const b: RangeRect = { r0: 1, r1: 3, c0: 1, c1: 2 } // 6, overlaps 2
    expect(countCells([a])).toBe(6)
    expect(countCells([a, b])).toBe(10)
  })

  const src: RangeRect = { r0: 2, r1: 3, c0: 1, c1: 2 }
  it('extends along one axis: whichever the pointer went further', () => {
    expect(fillTarget(src, 5, 2)).toEqual({ r0: 4, r1: 5, c0: 1, c1: 2 }) // down
    expect(fillTarget(src, 0, 1)).toEqual({ r0: 0, r1: 1, c0: 1, c1: 2 }) // up
    expect(fillTarget(src, 3, 5)).toEqual({ r0: 2, r1: 3, c0: 3, c1: 5 }) // right
    expect(fillTarget(src, 2, 0)).toEqual({ r0: 2, r1: 3, c0: 0, c1: 0 }) // left
    expect(fillTarget(src, 6, 3)).toEqual({ r0: 4, r1: 6, c0: 1, c1: 2 }) // more rows than columns: down
    expect(fillTarget(src, 3, 2)).toBeNull() // nowhere
  })

  it('repeats the source pattern in both directions', () => {
    expect(fillSourceOf(src, 4, 1)).toEqual({ row: 2, col: 1 })
    expect(fillSourceOf(src, 5, 2)).toEqual({ row: 3, col: 2 })
    expect(fillSourceOf(src, 6, 1)).toEqual({ row: 2, col: 1 })
    expect(fillSourceOf(src, 1, 1)).toEqual({ row: 3, col: 1 }) // continues upward: the row above the block is its last row
    expect(fillSourceOf(src, 0, 1)).toEqual({ row: 2, col: 1 })
    expect(fillSourceOf(src, 2, 3)).toEqual({ row: 2, col: 1 })
  })
})

/* ---------------------------------------------------------------- grid */

interface Item {
  id: number
  name: string
  qty: number
  done: boolean
}
const items: Item[] = [
  { id: 1, name: 'a', qty: 10, done: false },
  { id: 2, name: 'b', qty: 20, done: true },
  { id: 3, name: 'c', qty: 30, done: false },
  { id: 4, name: 'd', qty: 40, done: true },
]
const columns: ColumnDef<Item>[] = [
  { field: 'name', editable: true },
  { field: 'qty', type: 'number', editable: true },
  { field: 'done', type: 'boolean', editable: true },
  { field: 'id', type: 'number' }, // read-only
]
const opts = (over: Partial<GridOptions<Item>> = {}): GridOptions<Item> => ({ rows: items, columns, pagination: false, ...over })
const pt = (rowId: number, field: string) => ({ rowId, field })

describe('selecting cells', () => {
  it('selects, extends and adds ranges, and resolves them to rectangles', () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.selectCells({ anchor: pt(1, 'name'), focus: pt(2, 'qty') }))
    expect(result.current.api.getCellRects()).toEqual([{ r0: 0, r1: 1, c0: 0, c1: 1 }])
    act(() => result.current.api.extendCellSelection(pt(3, 'done')))
    expect(result.current.api.getCellRects()).toEqual([{ r0: 0, r1: 2, c0: 0, c1: 2 }])
    act(() => result.current.api.selectCells({ anchor: pt(4, 'id'), focus: pt(4, 'id') }, { add: true }))
    expect(result.current.api.getCellRects()).toHaveLength(2)
    act(() => result.current.api.clearCellSelection())
    expect(result.current.api.getCellRects()).toEqual([])
  })

  it('starts a range at the focused cell when extending with none', () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.focusCell(pt(2, 'name')))
    act(() => result.current.api.extendCellSelection(pt(3, 'qty')))
    expect(result.current.api.getCellRects()).toEqual([{ r0: 1, r1: 2, c0: 0, c1: 1 }])
  })

  it('follows its cells when the rows are sorted', () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.selectCells({ anchor: pt(1, 'name'), focus: pt(2, 'name') }))
    act(() => result.current.api.setSortModel([{ field: 'qty', direction: 'desc' }]))
    // rows 1 and 2 are now at the bottom: 4,3,2,1
    expect(result.current.api.getCellRects()).toEqual([{ r0: 2, r1: 3, c0: 0, c1: 0 }])
  })

  it('drops a range whose end is filtered out', () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.selectCells({ anchor: pt(1, 'name'), focus: pt(2, 'name') }))
    act(() => result.current.api.setFilterModel({ items: [{ field: 'name', operator: 'equals', value: 'a' }] }))
    expect(result.current.api.getCellRects()).toEqual([])
  })
})

describe('copy', () => {
  it('copies the active range as tab-separated raw values', () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.selectCells({ anchor: pt(1, 'name'), focus: pt(2, 'done') }))
    expect(result.current.api.copySelection()).toBe('a\t10\tfalse\nb\t20\ttrue')
  })

  it('falls back to selected rows, then the focused cell', () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.focusCell(pt(3, 'qty')))
    expect(result.current.api.copySelection()).toBe('30')
    act(() => result.current.api.toggleSelection(2, true))
    expect(result.current.api.copySelection()).toBe('b\t20\ttrue\t2')
  })

  it('skips group rows inside a range', () => {
    const { result } = renderHook(() => useGrid(opts({ initialState: { rowGroupingModel: ['done'], expandAllByDefault: true } })))
    // rows: group(false), 1, 3, group(true), 2, 4 -> the range from row 1 to row 2 also covers 3 and the group row between them
    act(() => result.current.api.selectCells({ anchor: pt(1, 'name'), focus: pt(2, 'name') }))
    expect(result.current.api.getCellRects()).toEqual([{ r0: 1, r1: 4, c0: 0, c1: 0 }])
    expect(result.current.api.copySelection()).toBe('a\nc\nb') // the group row has no values: skipped
  })
})

describe('paste', () => {
  it('writes a block at the active range and selects what it wrote', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.selectCells({ anchor: pt(2, 'name'), focus: pt(2, 'name') }))
    let res = { applied: 0, skipped: 0, rejected: 0 }
    await act(async () => void (res = await result.current.api.pasteText('X\t99\nY\t98')))
    expect(res).toEqual({ applied: 4, skipped: 0, rejected: 0 })
    expect(result.current.rows.map((r) => [r.row!.name, r.row!.qty])).toEqual([['a', 10], ['X', 99], ['Y', 98], ['d', 40]])
    expect(result.current.api.getCellRects()).toEqual([{ r0: 1, r1: 2, c0: 0, c1: 1 }])
  })

  it('one value pasted over a selection fills all of it', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.selectCells({ anchor: pt(1, 'qty'), focus: pt(3, 'qty') }))
    await act(async () => void (await result.current.api.pasteText('7')))
    expect(result.current.rows.map((r) => r.row!.qty)).toEqual([7, 7, 7, 40])
  })

  it('starts at the focused cell when nothing is selected, and clips at the grid edge', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.focusCell(pt(4, 'qty')))
    await act(async () => void (await result.current.api.pasteText('1\ttrue\t5\t6\nignored row')))
    expect(result.current.rows[3]!.row).toMatchObject({ qty: 1, done: true, id: 4 }) // id is read-only: untouched
  })

  it('skips read-only cells and text that does not fit, and says so', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.selectCells({ anchor: pt(1, 'qty'), focus: pt(1, 'qty') }))
    let res = { applied: 0, skipped: 0, rejected: 0 }
    await act(async () => void (res = await result.current.api.pasteText('abc\tmaybe\t55')))
    expect(res.applied).toBe(0)
    expect(res.skipped).toBe(3) // two invalid, one into the read-only id column
    expect(result.current.rows[0]!.row!.qty).toBe(10)
  })

  it('goes through processRowUpdate once per row, and a refusal only affects that row', async () => {
    const processRowUpdate = vi.fn(async (next: Item) => {
      if (next.id === 2) throw new Error('refused')
      return next
    })
    const onError = vi.fn()
    const { result } = renderHook(() => useGrid(opts({ processRowUpdate, onProcessRowUpdateError: onError })))
    act(() => result.current.api.selectCells({ anchor: pt(1, 'name'), focus: pt(1, 'name') }))
    let res = { applied: 0, skipped: 0, rejected: 0 }
    await act(async () => void (res = await result.current.api.pasteText('P\t1\nQ\t2\nR\t3')))
    expect(processRowUpdate).toHaveBeenCalledTimes(3) // 3 rows, each with 2 changed cells
    expect(res).toEqual({ applied: 4, skipped: 0, rejected: 2 })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(result.current.rows.map((r) => r.row!.name)).toEqual(['P', 'b', 'R', 'd'])
  })

  it('does nothing without a target', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    let res = { applied: 9, skipped: 9, rejected: 9 }
    await act(async () => void (res = await result.current.api.pasteText('x')))
    expect(res).toEqual({ applied: 0, skipped: 0, rejected: 0 })
  })
})

describe('clear (delete / cut)', () => {
  it('empties editable cells of the selection only', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.selectCells({ anchor: pt(1, 'name'), focus: pt(2, 'id') }))
    await act(async () => void (await result.current.api.clearSelectedCells()))
    expect(result.current.rows.map((r) => [r.row!.name, r.row!.qty, r.row!.id])).toEqual([['', null, 1], ['', null, 2], ['c', 30, 3], ['d', 40, 4]])
  })

  it('clears the focused cell when there is no range', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.focusCell(pt(3, 'qty')))
    await act(async () => void (await result.current.api.clearSelectedCells()))
    expect(result.current.rows[2]!.row!.qty).toBeNull()
  })
})

describe('fill', () => {
  it('repeats the source block downward and selects the whole area', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    const src: RangeRect = { r0: 0, r1: 1, c0: 0, c1: 1 } // a/10, b/20
    act(() => result.current.api.selectCells({ anchor: pt(1, 'name'), focus: pt(2, 'qty') }))
    let res = { applied: 0, skipped: 0, rejected: 0 }
    await act(async () => void (res = await result.current.api.fillCells(src, { row: 3, col: 1 })))
    expect(res.applied).toBe(4)
    expect(result.current.rows.map((r) => [r.row!.name, r.row!.qty])).toEqual([['a', 10], ['b', 20], ['a', 10], ['b', 20]])
    expect(result.current.api.getCellRects()).toEqual([{ r0: 0, r1: 3, c0: 0, c1: 1 }])
  })

  it('fills sideways, skipping cells that are not editable', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    const src: RangeRect = { r0: 0, r1: 0, c0: 1, c1: 1 } // qty of row 1 (10)
    let res = { applied: 0, skipped: 0, rejected: 0 }
    await act(async () => void (res = await result.current.api.fillCells(src, { row: 0, col: 3 }))) // over done, id
    // done (boolean) takes the number as-is; id is read-only
    expect(res.skipped).toBe(1)
    expect(result.current.rows[0]!.row!.id).toBe(1)
  })

  it('does nothing when the pointer stays inside the source', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    let res = { applied: 5, skipped: 5, rejected: 5 }
    await act(async () => void (res = await result.current.api.fillCells({ r0: 0, r1: 1, c0: 0, c1: 0 }, { row: 1, col: 0 })))
    expect(res).toEqual({ applied: 0, skipped: 0, rejected: 0 })
  })
})
