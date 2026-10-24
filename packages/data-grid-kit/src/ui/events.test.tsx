import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Grid } from './Grid'
import type { UIColumnDef } from './types'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 400 })
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
const rows: P[] = [
  { id: 1, name: 'Ana', age: 30 },
  { id: 2, name: 'Bia', age: 41 },
  { id: 3, name: 'Caio', age: 25 },
]
const columns: UIColumnDef<P>[] = [
  { field: 'name', headerName: 'Name', width: 120 },
  { field: 'age', headerName: 'Age', type: 'number', width: 80 },
]
const cell = (rowIndex: number, field: string) => document.querySelector<HTMLElement>(`.gk-row[data-rowindex="${rowIndex}"] .gk-cell[data-field="${field}"]`)!

describe('events', () => {
  it('onRowClick and onCellClick say which row and cell were hit', () => {
    const onRowClick = vi.fn()
    const onCellClick = vi.fn()
    render(<Grid<P> rows={rows} columns={columns} onRowClick={onRowClick} onCellClick={onCellClick} />)
    fireEvent.click(cell(1, 'age'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0]![0]).toMatchObject({ id: 2, row: rows[1] })
    expect(onCellClick.mock.calls[0]![0]).toMatchObject({ id: 2, field: 'age', value: 41, row: rows[1] })
    expect(onCellClick.mock.calls[0]![0].colDef.field).toBe('age')
  })

  it('double click and key down have their own handlers', () => {
    const onRowDoubleClick = vi.fn()
    const onCellDoubleClick = vi.fn()
    const onCellKeyDown = vi.fn()
    render(<Grid<P> rows={rows} columns={columns} onRowDoubleClick={onRowDoubleClick} onCellDoubleClick={onCellDoubleClick} onCellKeyDown={onCellKeyDown} />)
    fireEvent.doubleClick(cell(0, 'name'))
    expect(onRowDoubleClick.mock.calls[0]![0].id).toBe(1)
    expect(onCellDoubleClick.mock.calls[0]![0]).toMatchObject({ field: 'name', value: 'Ana' })
    // the focus is on the grid: the key is for the focused cell
    fireEvent.click(cell(2, 'name'))
    fireEvent.keyDown(document.querySelector('.gk-scroller')!, { key: 'ArrowRight' })
    expect(onCellKeyDown).toHaveBeenCalledTimes(1)
    expect(onCellKeyDown.mock.calls[0]![0]).toMatchObject({ id: 3, field: 'name' })
  })

  it('onColumnHeaderClick fires for a header, and calling preventDefault stops the sort', () => {
    const onColumnHeaderClick = vi.fn((_: unknown, e: { preventDefault(): void }) => e.preventDefault())
    render(<Grid<P> rows={rows} columns={columns} onColumnHeaderClick={onColumnHeaderClick} />)
    fireEvent.click(screen.getByText('Name'))
    expect(onColumnHeaderClick.mock.calls[0]![0]).toMatchObject({ field: 'name' })
    expect(document.querySelector('.gk-header-cell[data-field="name"]')!.getAttribute('aria-sort')).toBe('none')
  })

  it('without preventDefault the grid still does its own thing (the click sorts)', () => {
    render(<Grid<P> rows={rows} columns={columns} onColumnHeaderClick={() => {}} />)
    fireEvent.click(screen.getByText('Name'))
    expect(document.querySelector('.gk-header-cell[data-field="name"]')!.getAttribute('aria-sort')).toBe('ascending')
  })

  it('preventDefault on a cell double click keeps the editor from opening', () => {
    const editable: UIColumnDef<P>[] = [{ field: 'name', headerName: 'Name', width: 120, editable: true }]
    render(<Grid<P> rows={rows} columns={editable} onCellDoubleClick={(_, e) => e.preventDefault()} />)
    fireEvent.doubleClick(cell(0, 'name'))
    expect(document.querySelector('.gk-cell[data-editing]')).toBeNull()
  })
})

describe('class names, header props', () => {
  it('cellClassName (string and function), getCellClassName and getRowClassName add classes from the data', () => {
    const cols: UIColumnDef<P>[] = [
      { field: 'name', headerName: 'Name', width: 120, cellClassName: 'name-cell' },
      { field: 'age', headerName: 'Age', type: 'number', width: 80, cellClassName: ({ value }) => ((value as number) > 35 ? 'old' : undefined) },
    ]
    render(
      <Grid<P>
        rows={rows}
        columns={cols}
        getRowClassName={({ index }) => (index % 2 ? 'odd-row' : undefined)}
        getCellClassName={({ field, value }) => (field === 'name' && value === 'Caio' ? 'caio' : undefined)}
      />,
    )
    expect(cell(0, 'name').classList.contains('name-cell')).toBe(true)
    expect(cell(1, 'age').classList.contains('old')).toBe(true)
    expect(cell(0, 'age').classList.contains('old')).toBe(false)
    expect(cell(2, 'name').classList.contains('caio')).toBe(true)
    expect(document.querySelector('.gk-row[data-rowindex="1"]')!.classList.contains('odd-row')).toBe(true)
    expect(document.querySelector('.gk-row[data-rowindex="0"]')!.classList.contains('odd-row')).toBe(false)
  })

  it('headerAlign, headerClassName, description and renderHeader change the header', () => {
    const cols: UIColumnDef<P>[] = [
      { field: 'name', headerName: 'Name', width: 120, headerAlign: 'right', headerClassName: 'hdr', description: 'Who it is' },
      { field: 'age', headerName: 'Age', width: 80, renderHeader: ({ colDef }) => <em>{colDef.headerName}!</em> },
    ]
    render(<Grid<P> rows={rows} columns={cols} />)
    const h = document.querySelector<HTMLElement>('.gk-header-cell[data-field="name"]')!
    expect(h.dataset.align).toBe('right')
    expect(h.classList.contains('hdr')).toBe(true)
    expect(h.title).toBe('Who it is')
    expect(screen.getByText('Age!').tagName).toBe('EM')
  })
})
