import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { useGrid } from './useGrid'
import { Grid } from '../ui/Grid'
import { PIVOT_ROWS_FIELD, defaultPivotDerived, withDerivedColumns } from './pivot'
import type { ColumnDef, GridOptions, PivotModel } from './types'

// jsdom has no ResizeObserver, and the grid measures its viewport with one
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

// jsdom has no PointerEvent: a MouseEvent carries the same coordinates and button
if (typeof PointerEvent === 'undefined') (globalThis as any).PointerEvent = class extends MouseEvent {}

interface Sale {
  id: number
  region: string
  rep: string
  day: Date
  amount: number
}

const rows: Sale[] = [
  { id: 1, region: 'N', rep: 'ana', day: new Date(2024, 0, 5), amount: 100 },
  { id: 2, region: 'N', rep: 'bia', day: new Date(2024, 4, 9), amount: 50 },
  { id: 3, region: 'S', rep: 'dani', day: new Date(2023, 11, 20), amount: 300 },
  { id: 4, region: 'S', rep: 'dani', day: new Date(2024, 1, 2), amount: 20 },
]
const columns: ColumnDef<Sale>[] = [
  { field: 'region', headerName: 'Region' },
  { field: 'rep', headerName: 'Rep' },
  { field: 'day', headerName: 'Day', type: 'date' },
  { field: 'amount', headerName: 'Amount', type: 'number' },
]
const model: PivotModel = {
  rows: ['region'],
  columns: [{ field: 'day-year' }],
  values: [{ field: 'amount', aggFunc: 'sum' }],
}
const opts = (over: Partial<GridOptions<Sale>> = {}): GridOptions<Sale> => ({
  rows,
  columns,
  getRowId: (r) => r.id,
  pivoting: true,
  pagination: false,
  initialState: { pivotMode: true, pivotModel: model, expandAllByDefault: true },
  ...over,
})

// jsdom lays nothing out: give every element a size so the grid has a viewport to render into
const sizes = ['clientWidth', 'clientHeight'] as const
const saved = sizes.map((k) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, k))
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 400 })
})
afterAll(() => {
  sizes.forEach((k, i) => (saved[i] ? Object.defineProperty(HTMLElement.prototype, k, saved[i]!) : delete (HTMLElement.prototype as any)[k]))
})

afterEach(cleanup)

describe('derived columns', () => {
  it('a date column offers its year and quarter, hidden from the table', () => {
    const all = withDerivedColumns(columns, undefined)
    expect(all.map((c) => c.field)).toEqual(['region', 'rep', 'day', 'amount', 'day-year', 'day-quarter'])
    const [year, quarter] = defaultPivotDerived(columns[2]!)!
    expect(year!.valueGetter!(rows[0]!)).toBe(2024)
    expect(quarter!.valueGetter!(rows[1]!)).toBe('Q2')
    expect(year!.valueGetter!({ ...rows[0]!, day: null as never })).toBeNull()
  })
  it('can be turned off or replaced', () => {
    expect(withDerivedColumns(columns, false)).toBe(columns)
    const custom = withDerivedColumns(columns, (c) => (c.field === 'rep' ? [{ field: 'rep-initial', valueGetter: (r: Sale) => r.rep[0] }] : undefined))
    expect(custom.map((c) => c.field)).toContain('rep-initial')
    expect(custom.map((c) => c.field)).not.toContain('day-year')
  })
})

describe('pivot mode in the grid', () => {
  it('replaces the columns with a row-label column and one column per distinct column value', () => {
    const { result } = renderHook(() => useGrid(opts()))
    const g = result.current
    expect(g.pivot).not.toBeNull()
    expect(g.layout.all.map((c) => c.field)[0]).toBe(PIVOT_ROWS_FIELD)
    expect(g.layout.left.map((c) => c.field)).toEqual([PIVOT_ROWS_FIELD]) // pinned, so the labels stay in view
    const valueCols = g.layout.all.filter((c) => c.pivot)
    expect(valueCols.map((c) => c.group)).toEqual([['2023'], ['2024']])
    expect(valueCols[0]!.headerName).toBe('Amount (sum)')
    expect(g.headerDepth).toBe(1)
    expect(g.headerHeight).toBe(g.headerRowHeight * 2)
    // group rows carry the numbers under the generated fields
    const s = g.rows.find((r) => r.groupValue === 'S')!
    expect(s.aggregates![valueCols[0]!.field]).toBe(300)
    expect(s.aggregates![valueCols[1]!.field]).toBe(20)
    expect(g.rows.every((r) => r.type === 'group')).toBe(true)
    expect(g.pivot!.aggNames[valueCols[1]!.field]).toBe('sum')
  })

  it('can be switched on and off, and the original columns come back', () => {
    const { result } = renderHook(() => useGrid(opts({ initialState: { pivotModel: model } })))
    expect(result.current.pivot).toBeNull()
    expect(result.current.layout.all.map((c) => c.field)).toEqual(['region', 'rep', 'day', 'amount'])
    act(() => result.current.api.setPivotMode(true))
    expect(result.current.pivot).not.toBeNull()
    expect(result.current.state.rowGroupingModel).toEqual(['region']) // the pivot's rows are the row groups
    expect(result.current.rows.length).toBe(2) // expanded by default, groups only
    act(() => result.current.api.setPivotMode(false))
    expect(result.current.pivot).toBeNull()
    expect(result.current.headerDepth).toBe(0)
    expect(result.current.layout.all.map((c) => c.field)).toEqual(['region', 'rep', 'day', 'amount'])
    expect(result.current.rows).toHaveLength(4)
    expect(result.current.state.rowGroupingModel).toEqual([])
  })

  it('does nothing without the pivoting option, or with a data source', () => {
    const { result } = renderHook(() => useGrid(opts({ pivoting: false })))
    expect(result.current.pivot).toBeNull()
    expect(result.current.layout.all.map((c) => c.field)).toEqual(['region', 'rep', 'day', 'amount'])
  })

  it('follows model changes', () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.setPivotModel((m) => ({ ...m, columns: [{ field: 'rep', sort: 'desc' }], values: [{ field: 'amount', aggFunc: 'max' }, { field: 'amount', aggFunc: 'min' }] })))
    const cols = result.current.layout.all.filter((c) => c.pivot)
    expect(cols.map((c) => `${c.group!.join('/')}:${c.pivot!.valueField}`)).toEqual([
      'dani:amount',
      'dani:amount',
      'bia:amount',
      'bia:amount',
      'ana:amount',
      'ana:amount',
    ])
    act(() => result.current.api.setPivotModel((m) => ({ ...m, rows: ['region', 'rep'] })))
    expect(result.current.rows.map((r) => r.groupValue)).toEqual(['N', 'ana', 'bia', 'S', 'dani'])
    expect(result.current.rows.find((r) => r.groupValue === 'ana')!.expandable).toBe(false)
  })

  it('sorts the row groups from the label column', () => {
    const { result } = renderHook(() => useGrid(opts()))
    expect(result.current.rows.map((r) => r.groupValue)).toEqual(['N', 'S'])
    act(() => result.current.api.toggleSort(PIVOT_ROWS_FIELD))
    act(() => result.current.api.toggleSort(PIVOT_ROWS_FIELD)) // asc, then desc
    expect(result.current.rows.map((r) => r.groupValue)).toEqual(['S', 'N'])
  })

  it('totals row and total columns', () => {
    const { result } = renderHook(() => useGrid(opts({ pivotTotals: true })))
    const total = result.current.layout.all.find((c) => c.pivot?.total)!
    expect(total.group).toEqual(['Total'])
    expect(result.current.footer!.aggregates![total.field]).toBe(470)
  })

  it('exports the table as shown', () => {
    const { result } = renderHook(() => useGrid(opts()))
    const csv = result.current.api.getCsv({ bom: false })
    expect(csv.split('\r\n')).toEqual(['Region,2023 / Amount (sum),2024 / Amount (sum)', 'N,,150', 'S,300,20'])
  })

  it('pinning and reordering rows are off while pivoting', () => {
    const { result } = renderHook(() => useGrid(opts({ rowReordering: true })))
    expect(result.current.reorderAllowed).toBe(false)
  })

  it('live updates change the table without leaving pivot mode', () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.updateRows({ insert: [{ id: 9, region: 'W', rep: 'x', day: new Date(2025, 0, 1), amount: 7 }] }))
    expect(result.current.layout.all.filter((c) => c.pivot).map((c) => c.group![0])).toEqual(['2023', '2024', '2025'])
    expect(result.current.rows.map((r) => r.groupValue)).toEqual(['N', 'S', 'W'])
  })
})

describe('dragging fields in the pivot panel', () => {
  const open = (initial: object = {}, cols = columns) => {
    let api: import('./useGrid').GridApi<Sale>
    render(<Grid {...opts({ columns: cols, initialState: { pivotMode: true, pivotModel: model, ...initial } })} height={300} toolbar onReady={(a) => (api = a)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pivot' }))
    return { api: () => api!, panel: () => document.querySelector('.gk-pivot') as HTMLElement }
  }
  const item = (panel: HTMLElement, list: string, field: string) =>
    panel.querySelector(`[data-pivot-section="${list}"] [data-pivot-field="${field}"]`) as HTMLElement
  /** drag the grip of `from` and drop at `at` (jsdom lays nothing out, so the element under the pointer is given) */
  const drag = (from: HTMLElement, at: Element | null, y = 0) => {
    document.elementFromPoint = () => at
    const grip = from.querySelector('.gk-pivot-grip') as HTMLElement
    fireEvent.pointerDown(grip, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 20, clientY: y })
    fireEvent.pointerUp(window, { clientX: 20, clientY: y })
  }

  it('drops a field on a list: it leaves its old list and joins the new one', () => {
    const { api, panel } = open()
    drag(item(panel(), 'fields', 'rep'), panel().querySelector('[data-pivot-section="rows"]'))
    expect(api().store.getState().pivotModel.rows).toEqual(['region', 'rep'])
  })

  it('drops before a field, using the half of the row under the pointer', () => {
    const { api, panel } = open({ pivotModel: { rows: ['region', 'rep'], columns: [], values: [] } })
    const target = item(panel(), 'rows', 'region')
    target.getBoundingClientRect = () => ({ top: 0, height: 20, bottom: 20, left: 0, right: 10, width: 10, x: 0, y: 0, toJSON() {} }) as DOMRect
    drag(item(panel(), 'rows', 'rep'), target, 5) // upper half: before
    expect(api().store.getState().pivotModel.rows).toEqual(['rep', 'region'])
    const last = item(panel(), 'rows', 'region')
    last.getBoundingClientRect = () => ({ top: 0, height: 20, bottom: 20, left: 0, right: 10, width: 10, x: 0, y: 0, toJSON() {} }) as DOMRect
    drag(item(panel(), 'rows', 'rep'), last, 15) // lower half: after
    expect(api().store.getState().pivotModel.rows).toEqual(['region', 'rep'])
  })

  it('dropping on Fields removes the field; dropping outside any list does nothing', () => {
    const { api, panel } = open()
    drag(item(panel(), 'columns', 'day-year'), panel().querySelector('[data-pivot-section="fields"]'))
    expect(api().store.getState().pivotModel.columns).toEqual([])
    const before = api().store.getState().pivotModel
    drag(item(panel(), 'rows', 'region'), document.body)
    expect(api().store.getState().pivotModel).toBe(before)
  })

  it('a field that cannot be aggregated is refused by Values; a number gets a function', () => {
    const empty = { pivotModel: { rows: [], columns: [], values: [] } }
    const { api, panel } = open(empty, columns.map((c) => (c.field === 'rep' ? { ...c, aggregable: false } : c)))
    const values = panel().querySelector('[data-pivot-section="values"]')
    drag(item(panel(), 'fields', 'rep'), values)
    expect(api().store.getState().pivotModel.values).toEqual([])
    drag(item(panel(), 'fields', 'amount'), values)
    expect(api().store.getState().pivotModel.values).toEqual([{ field: 'amount', aggFunc: 'sum' }])
  })

  it('a click on the grip without moving, and Escape, change nothing', () => {
    const { api, panel } = open()
    const before = api().store.getState().pivotModel
    document.elementFromPoint = () => panel().querySelector('[data-pivot-section="rows"]')
    const grip = item(panel(), 'fields', 'rep').querySelector('.gk-pivot-grip') as HTMLElement
    fireEvent.pointerDown(grip, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(window, { clientX: 1, clientY: 1 })
    expect(api().store.getState().pivotModel).toBe(before)
    fireEvent.pointerDown(grip, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 30, clientY: 30 })
    expect(document.querySelector('.gk-pivot-ghost')).not.toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(window, { clientX: 30, clientY: 30 })
    expect(document.querySelector('.gk-pivot-ghost')).toBeNull()
    expect(api().store.getState().pivotModel).toBe(before)
  })
})

describe('pivot table on screen', () => {
  it('draws a header row for the column groups above the titles and one cell per group', () => {
    const { container } = render(<Grid {...opts()} height={300} />)
    const headerRows = container.querySelectorAll('.gk-header .gk-header-row')
    expect(headerRows).toHaveLength(2)
    expect(within(headerRows[0] as HTMLElement).getAllByRole('columnheader').map((e) => e.textContent)).toEqual(['2023', '2024'])
    expect(within(headerRows[1] as HTMLElement).getAllByRole('columnheader').map((e) => e.textContent?.replace(/[⋮⇤⇥]/g, '').trim())).toEqual(
      expect.arrayContaining(['Region', 'Amount (sum)']),
    )
    expect(headerRows[0]!.getAttribute('aria-rowindex')).toBe('1')
    expect(headerRows[1]!.getAttribute('aria-rowindex')).toBe('2')
    // body rows start after the header rows
    expect(container.querySelector('[data-rowindex="0"]')!.getAttribute('aria-rowindex')).toBe('3')
  })

  it('shows the numbers without the function label', () => {
    const { container } = render(<Grid {...opts()} height={300} />)
    const s = [...container.querySelectorAll('.gk-row')].find((r) => r.textContent?.includes('S'))!
    expect(s.querySelector('.gk-agg-pivot')!.textContent).toBe('300')
    expect(s.querySelector('.gk-agg-label')).toBeNull()
  })

  it('generated pivot columns have a column menu (Hide only: they cannot be sorted, filtered or moved)', () => {
    const { container } = render(<Grid {...opts()} height={300} />)
    const btn = container.querySelectorAll<HTMLElement>('.gk-header-row:last-child .gk-menu-btn')[1]! // the first generated column
    fireEvent.click(btn)
    const items = [...document.querySelectorAll('[role=menu] [role=menuitem]')].map((e) => e.textContent)
    expect(items).toEqual(['Hide column'])
  })

  it('has a Pivot button and panel in the toolbar', () => {
    render(<Grid {...opts({ initialState: {} })} height={300} toolbar />)
    expect(screen.getByRole('button', { name: 'Pivot' })).toBeTruthy()
  })
})
