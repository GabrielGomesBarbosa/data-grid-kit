import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
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
  // jsdom has no layout: a copy is as wide as its text (10px a letter) plus 16px of padding
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return this.textContent.length * 10 + 16 } })
})
afterAll(() => {
  delete (HTMLElement.prototype as any).clientWidth
  delete (HTMLElement.prototype as any).clientHeight
  delete (HTMLElement.prototype as any).offsetWidth
})
afterEach(cleanup)

interface P {
  id: number
  name: string
  note: string
}
const rows: P[] = [
  { id: 1, name: 'Ana', note: 'ok' },
  { id: 2, name: 'Beatrice', note: 'fine' },
  { id: 3, name: 'Caio', note: 'ok' },
]
const columns: UIColumnDef<P>[] = [
  { field: 'name', headerName: 'Name', width: 300 },
  { field: 'note', headerName: 'A long header', width: 300 },
]
const widthOf = (field: string) => document.querySelector<HTMLElement>(`.gk-header-cell[data-field="${field}"]`)!.style.width

describe('autosize', () => {
  it('fits a column to its widest cell, or its header when that is wider', () => {
    let api!: GridApi<P>
    render(<Grid<P> rows={rows} columns={columns} onReady={(a) => (api = a)} />)
    let out: Record<string, number> = {}
    act(() => {
      out = api.autosizeColumns()
    })
    // name: "Beatrice" (8 letters, 96px) beats the header "Name" (4 letters, 56px); note: the header (13 letters, 146px) beats "fine"
    const header = (field: string) => document.querySelector<HTMLElement>(`.gk-header-cell[data-field="${field}"]`)!.offsetWidth
    expect(out.name).toBe(97)
    expect(out.note).toBe(header('note') + 1)
    expect(out.note).toBeGreaterThan(130)
    expect(widthOf('name')).toBe('97px')
    expect(widthOf('note')).toBe(`${out.note}px`)
  })

  it('includeHeaders: false leaves the header out; columns picks which', () => {
    let api!: GridApi<P>
    render(<Grid<P> rows={rows} columns={columns} onReady={(a) => (api = a)} />)
    act(() => {
      api.autosizeColumns({ columns: ['note'], includeHeaders: false })
    })
    expect(widthOf('note')).toBe('57px') // "fine": 4 letters, 40px + 16px of padding + 1
    expect(widthOf('name')).toBe('300px')
  })

  it('a double click on the divider fits that column', () => {
    render(<Grid<P> rows={rows} columns={columns} />)
    fireEvent.doubleClick(document.querySelector('.gk-header-cell[data-field="name"] .gk-resizer')!)
    expect(widthOf('name')).toBe('97px')
    expect(widthOf('note')).toBe('300px')
  })

  it('autosizeOnMount fits every column once the rows are drawn', async () => {
    render(<Grid<P> rows={rows} columns={columns} autosizeOnMount />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    expect(widthOf('name')).toBe('97px')
  })

  it('expand shares a spare edge of the grid among the fitted columns', () => {
    let api!: GridApi<P>
    render(<Grid<P> rows={rows} columns={columns} onReady={(a) => (api = a)} />)
    act(() => {
      api.autosizeColumns({ expand: true })
    })
    const total = parseInt(widthOf('name')) + parseInt(widthOf('note'))
    expect(total).toBeGreaterThanOrEqual(797) // the 800px grid, give or take rounding
    expect(parseInt(widthOf('note'))).toBeGreaterThan(parseInt(widthOf('name')))
  })

  it('respects minWidth and maxWidth', () => {
    let api!: GridApi<P>
    const bounded: UIColumnDef<P>[] = [
      { field: 'name', headerName: 'Name', width: 300, maxWidth: 80 },
      { field: 'note', headerName: 'N', width: 300, minWidth: 200 },
    ]
    render(<Grid<P> rows={rows} columns={bounded} onReady={(a) => (api = a)} />)
    act(() => {
      api.autosizeColumns()
    })
    expect(widthOf('name')).toBe('80px')
    expect(widthOf('note')).toBe('200px')
  })
})
