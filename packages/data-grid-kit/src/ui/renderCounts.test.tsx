import { useState } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { Grid } from './Grid'
import { defaultSlots } from './defaultSlots'
import type { CellProps } from './Cell'
import type { RowProps } from './Row'
import type { GridApi } from '../core'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 })
})
afterAll(() => {
  delete (HTMLElement.prototype as any).clientWidth
  delete (HTMLElement.prototype as any).clientHeight
})
afterEach(cleanup)

interface P {
  id: number
  name: string
  age: number
}
const rows: P[] = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}`, age: 20 + (i % 40) }))
const columns = [{ field: 'name', headerName: 'Name', editable: true }, { field: 'age', headerName: 'Age', type: 'number' as const }]

// The contract: a custom row or cell slot is called only for what changed. These tests count the calls.
function setup() {
  const rowRenders: Record<string, number> = {}
  const cellRenders: Record<string, number> = {}
  // deliberately NOT memoised: the grid memoises a row slot itself
  const MyRow = (p: RowProps<P>) => {
    const id = String(p.row.id)
    rowRenders[id] = (rowRenders[id] ?? 0) + 1
    return <defaultSlots.row {...p} />
  }
  const MyCell = (p: CellProps<P>) => {
    const key = `${p.row.id}:${p.col.field}`
    cellRenders[key] = (cellRenders[key] ?? 0) + 1
    return <defaultSlots.cell {...p} />
  }
  let api!: GridApi<P>
  let bump = () => {}
  // module-level / stable props, as a careful app passes them
  const stable = { rows, columns, getRowId: (r: P) => r.id, pagination: false as const, rowHeight: 20, slots: { row: MyRow, cell: MyCell }, checkboxSelection: true, onReady: (a: GridApi<P>) => (api = a) }
  function Harness() {
    const [, set] = useState(0)
    bump = () => set((n) => n + 1)
    return <Grid<P> {...stable} />
  }
  const view = render(<Harness />)
  const total = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0)
  const reset = () => {
    for (const k of Object.keys(rowRenders)) delete rowRenders[k]
    for (const k of Object.keys(cellRenders)) delete cellRenders[k]
  }
  return { view, api: () => api, bump: () => act(() => bump()), rowRenders, cellRenders, total, reset }
}

describe('render counts of replaced rows and cells', () => {
  it('renders only the rows near the viewport (not 200)', () => {
    const t = setup()
    const n = Object.keys(t.rowRenders).length
    expect(n).toBeGreaterThan(5)
    expect(n).toBeLessThan(60)
  })

  it('a re-render of the parent with the same props renders no row and no cell again', () => {
    const t = setup()
    t.reset()
    t.bump()
    expect(t.total(t.rowRenders)).toBe(0)
    expect(t.total(t.cellRenders)).toBe(0)
  })

  it('moving the focus re-renders the row losing it and the row gaining it, and nothing else', () => {
    const t = setup()
    act(() => t.api().focusCell({ rowId: 1, field: 'name' }))
    t.reset()
    act(() => t.api().focusCell({ rowId: 3, field: 'name' }))
    expect(Object.keys(t.rowRenders).sort()).toEqual(['1', '3'])
  })

  it('selecting a row re-renders that row only', () => {
    const t = setup()
    t.reset()
    act(() => t.api().toggleSelection(4, true))
    expect(Object.keys(t.rowRenders)).toEqual(['4'])
  })

  it('changing one row of the data re-renders that row only', () => {
    const t = setup()
    t.reset()
    act(() => t.api().updateRows({ update: [{ ...rows[6]!, name: 'Changed' }] }))
    expect(Object.keys(t.rowRenders)).toEqual(['7'])
    expect(t.cellRenders['7:name']).toBeGreaterThan(0)
    expect(t.cellRenders['8:name']).toBeUndefined()
  })

  it('scrolling inside the rendered window renders nothing; scrolling past it renders the new rows only', () => {
    const t = setup()
    const first = Object.keys(t.rowRenders).length
    t.reset()
    act(() => t.api().setScroll(20, 0)) // one row: still inside the buffer
    expect(t.total(t.rowRenders)).toBeLessThanOrEqual(2) // at most the row that entered
    t.reset()
    act(() => t.api().setScroll(2000, 0)) // 100 rows down: all new
    const ids = Object.keys(t.rowRenders).map(Number)
    expect(Math.min(...ids)).toBeGreaterThan(80)
    expect(ids.length).toBeLessThan(first * 2)
  })
})
