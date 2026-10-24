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
})
afterAll(() => {
  delete (HTMLElement.prototype as any).clientWidth
  delete (HTMLElement.prototype as any).clientHeight
})
afterEach(cleanup)

interface P {
  id: number
  name: string
  age: number | null
}
const rows: P[] = [
  { id: 1, name: 'Ana', age: 30 },
  { id: 2, name: 'Bia', age: 41 },
  { id: 3, name: 'Caio', age: null },
]
const columns: UIColumnDef<P>[] = [
  { field: 'name', headerName: 'Name', width: 100 },
  { field: 'age', headerName: 'Age', type: 'number', width: 80 },
]
const sortOf = (field: string) => document.querySelector(`.gk-header-cell[data-field="${field}"]`)!.getAttribute('aria-sort')
const click = (label: string, extra: object = {}) => fireEvent.click(document.querySelector(`.gk-header-cell[data-field="${label}"] .gk-header-title`)!, extra)

describe('autoHeight', () => {
  it('has no fixed height and says so', () => {
    render(<Grid<P> rows={rows} columns={columns} autoHeight height={123} />)
    const root = document.querySelector<HTMLElement>('.gk-root')!
    expect(root.hasAttribute('data-autoheight')).toBe(true)
    expect(root.style.height).toBe('')
  })
  it('a normal grid keeps its height', () => {
    render(<Grid<P> rows={rows} columns={columns} height={123} />)
    expect(document.querySelector<HTMLElement>('.gk-root')!.style.height).toBe('123px')
  })
})

describe('sorting options', () => {
  it('sortingOrder sets the turns of a click (and a column can have its own)', () => {
    render(<Grid<P> rows={rows} columns={[{ field: 'name', headerName: 'Name', width: 100 }, { field: 'age', headerName: 'Age', width: 80, sortingOrder: ['desc', null] }]} sortingOrder={['desc', 'asc']} />)
    click('name')
    expect(sortOf('name')).toBe('descending')
    click('name')
    expect(sortOf('name')).toBe('ascending')
    click('name')
    expect(sortOf('name')).toBe('descending') // never back to unsorted
    click('age')
    expect(sortOf('age')).toBe('descending')
    click('age')
    expect(sortOf('age')).toBe('none')
  })

  it("multipleColumnsSortingMode='always' adds to the sort without a modifier key; Ctrl and Cmd work as Shift", () => {
    render(<Grid<P> rows={rows} columns={columns} multipleColumnsSortingMode="always" />)
    click('name')
    click('age')
    expect(sortOf('name')).toBe('ascending')
    expect(sortOf('age')).toBe('ascending')
    cleanup()
    render(<Grid<P> rows={rows} columns={columns} />)
    click('name')
    click('age', { ctrlKey: true })
    expect(sortOf('name')).toBe('ascending')
    expect(sortOf('age')).toBe('ascending')
    click('name')
    expect(sortOf('age')).toBe('none') // a plain click replaces the sort
  })
})

describe('exportState / restoreState', () => {
  it('give the arrangement back as plain data and apply it again', () => {
    let api!: GridApi<P>
    render(<Grid<P> rows={rows} columns={columns} onReady={(a) => (api = a)} />)
    act(() => {
      api.setSortModel([{ field: 'age', direction: 'desc' }])
      api.setColumnWidth('name', 222)
      api.pinColumn('age', 'left')
      api.setDensity('compact')
    })
    const saved = JSON.parse(JSON.stringify(api.exportState()))
    expect(saved.sortModel).toEqual([{ field: 'age', direction: 'desc' }])
    expect(saved.columnWidths).toEqual({ name: 222 })
    expect(saved.density).toBe('compact')
    expect('viewport' in saved || 'scroll' in saved || 'focusedCell' in saved || 'selection' in saved).toBe(false)
    cleanup()
    render(<Grid<P> rows={rows} columns={columns} onReady={(a) => (api = a)} />)
    expect(api.exportState().sortModel).toEqual([])
    act(() => api.restoreState({ ...saved, viewport: { width: 1, height: 1 } } as any))
    expect(sortOf('age')).toBe('descending')
    expect(document.querySelector<HTMLElement>('.gk-header-cell[data-field="name"]')!.style.width).toBe('222px')
    expect(api.exportState().density).toBe('compact')
  })

  it('works as initialState too', () => {
    let api!: GridApi<P>
    render(<Grid<P> rows={rows} columns={columns} initialState={{ sortModel: [{ field: 'name', direction: 'desc' }] }} onReady={(a) => (api = a)} />)
    expect(api.exportState().sortModel).toEqual([{ field: 'name', direction: 'desc' }])
  })
})
