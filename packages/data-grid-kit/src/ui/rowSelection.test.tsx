import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Grid } from './Grid'
import type { UIColumnDef } from './types'
import type { GridApi } from '../core'

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
  locked: boolean
}
const rows: P[] = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}`, locked: i === 3 }))
const columns: UIColumnDef<P>[] = [{ field: 'name', headerName: 'Name', width: 140 }]
const cell = (i: number) => document.querySelector<HTMLElement>(`.gk-row[data-rowindex="${i}"] .gk-cell`)!
const selected = () => [...document.querySelectorAll('.gk-row[data-selected]')].map((r) => r.getAttribute('data-rowindex'))

describe('row selection by click', () => {
  it('does nothing unless asked for', () => {
    render(<Grid<P> rows={rows} columns={columns} />)
    fireEvent.click(cell(1))
    expect(selected()).toEqual([])
  })

  it('a click selects that row alone, and clicking the only selected row unselects it', () => {
    render(<Grid<P> rows={rows} columns={columns} rowSelectionOnClick />)
    fireEvent.click(cell(1))
    fireEvent.click(cell(2))
    expect(selected()).toEqual(['2'])
    fireEvent.click(cell(2))
    expect(selected()).toEqual([])
  })

  it('Ctrl/Cmd+click adds and removes rows', () => {
    render(<Grid<P> rows={rows} columns={columns} rowSelectionOnClick />)
    fireEvent.click(cell(0))
    fireEvent.click(cell(2), { ctrlKey: true })
    fireEvent.click(cell(4), { metaKey: true })
    expect(selected()).toEqual(['0', '2', '4'])
    fireEvent.click(cell(2), { ctrlKey: true })
    expect(selected()).toEqual(['0', '4'])
  })

  it('Shift+click selects the range from the last click, and Ctrl+Shift adds it', () => {
    render(<Grid<P> rows={rows} columns={columns} rowSelectionOnClick />)
    fireEvent.click(cell(1))
    fireEvent.click(cell(3), { shiftKey: true })
    expect(selected()).toEqual(['1', '2', '3'])
    fireEvent.click(cell(5))
    fireEvent.click(cell(4), { shiftKey: true, ctrlKey: true })
    expect(selected()).toEqual(['4', '5'])
  })

  it('multipleRowSelection={false}: a click replaces, Ctrl and Shift do not add', () => {
    render(<Grid<P> rows={rows} columns={columns} rowSelectionOnClick multipleRowSelection={false} />)
    fireEvent.click(cell(1))
    fireEvent.click(cell(3), { ctrlKey: true })
    expect(selected()).toEqual(['3'])
    fireEvent.click(cell(5), { shiftKey: true })
    expect(selected()).toEqual(['5'])
  })

  it('isRowSelectable: those rows ignore the click, keep a disabled checkbox, and select-all skips them', () => {
    let api: GridApi<P> | undefined
    render(<Grid<P> rows={rows} columns={columns} rowSelectionOnClick checkboxSelection isRowSelectable={({ row }) => !row.locked} onReady={(a) => (api = a)} />)
    fireEvent.click(cell(1))
    fireEvent.click(cell(3)) // the locked row
    expect(selected()).toEqual(['1'])
    expect(screen.getAllByLabelText('Select row')[3]).toHaveProperty('disabled', true)
    expect(screen.getAllByLabelText('Select row')[2]).toHaveProperty('disabled', false)
    act(() => api!.selectAll())
    expect(selected()).toEqual(['0', '1', '2', '4', '5'])
    expect(api!.isRowSelectable(4)).toBe(false)
    expect(api!.isRowSelectable(5)).toBe(true)
  })

  it('Ctrl+A selects every selectable row, Space toggles the focused one', () => {
    render(<Grid<P> rows={rows} columns={columns} rowSelectionOnClick isRowSelectable={({ row }) => !row.locked} />)
    fireEvent.click(cell(0))
    const grid = document.querySelector('.gk-scroller')!
    fireEvent.keyDown(grid, { key: 'a', ctrlKey: true })
    expect(selected()).toEqual(['0', '1', '2', '4', '5'])
    fireEvent.keyDown(grid, { key: ' ' })
    expect(selected()).toEqual(['1', '2', '4', '5']) // the focused row (the first) was toggled off
  })

  it('not while cell selection is on (it uses those clicks)', () => {
    render(<Grid<P> rows={rows} columns={columns} rowSelectionOnClick cellSelection />)
    fireEvent.click(cell(1))
    expect(selected()).toEqual([])
  })
})
