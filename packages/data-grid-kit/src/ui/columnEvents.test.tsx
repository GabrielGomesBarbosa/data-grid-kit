import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
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

const rows = [{ id: 1, a: 'x', b: 'y', c: 'z' }]
const columns: UIColumnDef<(typeof rows)[number]>[] = [
  { field: 'a', headerName: 'A', width: 100, minWidth: 60, maxWidth: 200 },
  { field: 'b', headerName: 'B', width: 100 },
  { field: 'c', headerName: 'C', width: 100 },
]

/** a pointer event with coordinates (jsdom has no PointerEvent) */
const pointer = (type: string, clientX: number) => Object.assign(new MouseEvent(type, { bubbles: true, clientX, button: 0 }), { pointerId: 1 })

describe('column events', () => {
  it('onColumnResize while dragging a divider, onColumnWidthChange when it ends, both within the limits', () => {
    const onColumnResize = vi.fn()
    const onColumnWidthChange = vi.fn()
    render(<Grid rows={rows} columns={columns} onColumnResize={onColumnResize} onColumnWidthChange={onColumnWidthChange} />)
    const divider = document.querySelector('.gk-header-cell[data-field="a"] .gk-resizer')!
    act(() => void divider.dispatchEvent(pointer('pointerdown', 100)))
    act(() => void window.dispatchEvent(pointer('pointermove', 130)))
    act(() => void window.dispatchEvent(pointer('pointermove', 400))) // far past maxWidth
    expect(onColumnResize.mock.calls.map((c) => c[0])).toEqual([{ field: 'a', width: 130 }, { field: 'a', width: 200 }])
    expect(onColumnWidthChange).not.toHaveBeenCalled()
    act(() => void window.dispatchEvent(pointer('pointerup', 400)))
    expect(onColumnWidthChange).toHaveBeenCalledTimes(1)
    expect(onColumnWidthChange).toHaveBeenCalledWith({ field: 'a', width: 200 })
  })

  it('a resize that changes nothing is not a width change', () => {
    const onColumnWidthChange = vi.fn()
    render(<Grid rows={rows} columns={columns} onColumnWidthChange={onColumnWidthChange} />)
    const divider = document.querySelector('.gk-header-cell[data-field="b"] .gk-resizer')!
    act(() => void divider.dispatchEvent(pointer('pointerdown', 100)))
    act(() => void window.dispatchEvent(pointer('pointerup', 100)))
    expect(onColumnWidthChange).not.toHaveBeenCalled()
  })

  it('fitting columns reports their new widths', () => {
    const onColumnWidthChange = vi.fn()
    let api!: GridApi<(typeof rows)[number]>
    render(<Grid rows={rows} columns={columns} onColumnWidthChange={onColumnWidthChange} onReady={(a) => (api = a)} />)
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 90 })
    try {
      act(() => void api.autosizeColumns({ columns: ['b'] }))
    } finally {
      delete (HTMLElement.prototype as any).offsetWidth
    }
    expect(onColumnWidthChange).toHaveBeenCalledWith({ field: 'b', width: 91 })
  })

  it('onColumnOrderChange says which column moved and where', () => {
    const onColumnOrderChange = vi.fn()
    let api!: GridApi<(typeof rows)[number]>
    render(<Grid rows={rows} columns={columns} onColumnOrderChange={onColumnOrderChange} onReady={(a) => (api = a)} />)
    act(() => void api.moveColumn('a', 2))
    expect(onColumnOrderChange).toHaveBeenCalledWith({ field: 'a', oldIndex: 0, targetIndex: 2 })
    act(() => void api.moveColumnBy('c', -1))
    expect(onColumnOrderChange).toHaveBeenLastCalledWith({ field: 'c', oldIndex: 1, targetIndex: 0 })
    onColumnOrderChange.mockClear()
    act(() => void api.moveColumn('c', 0)) // already there
    expect(onColumnOrderChange).not.toHaveBeenCalled()
  })
})

describe('rowHeader', () => {
  it('the cells of a rowHeader column are row headers for a screen reader; the others stay grid cells', () => {
    const cols: UIColumnDef<(typeof rows)[number]>[] = [{ field: 'a', headerName: 'A', width: 100, rowHeader: true }, { field: 'b', headerName: 'B', width: 100 }]
    render(<Grid rows={rows} columns={cols} />)
    expect(document.querySelector('.gk-row[data-rowindex="0"] [data-field="a"]')!.getAttribute('role')).toBe('rowheader')
    expect(document.querySelector('.gk-row[data-rowindex="0"] [data-field="b"]')!.getAttribute('role')).toBe('gridcell')
  })
})
