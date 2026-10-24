import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
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
  region: string
  amount: number
}
const rows: P[] = [
  { id: 1, region: 'N', amount: 10 },
  { id: 2, region: 'S', amount: 20 },
]
const columns: UIColumnDef<P>[] = [
  { field: 'region', headerName: 'Region', width: 120 },
  { field: 'amount', headerName: 'Amount', type: 'number', width: 100 },
]
const pivotButton = () => screen.getByRole('button', { name: 'Pivot' })

describe('the pivot panel docked beside the grid', () => {
  it('opens inside the grid frame, next to the content, not as a popover', () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} toolbar pivoting />)
    expect(container.querySelector('.gk-dock')).toBeNull()
    fireEvent.click(pivotButton())
    const root = container.querySelector('.gk-root')!
    const dock = root.querySelector(':scope > .gk-dock')!
    expect(dock.querySelector('.gk-pivot')).not.toBeNull()
    expect(dock.previousElementSibling?.classList.contains('gk-main')).toBe(true) // the grid's content is the other half
    expect(document.querySelector('.gk-popover')).toBeNull()
    expect(pivotButton().getAttribute('aria-expanded')).toBe('true')
  })

  it('does not rebuild the grid: the scroller is the same element before and after', () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} toolbar pivoting />)
    const scroller = container.querySelector('.gk-scroller')
    fireEvent.click(pivotButton())
    expect(container.querySelector('.gk-scroller')).toBe(scroller)
    fireEvent.click(pivotButton())
    expect(container.querySelector('.gk-scroller')).toBe(scroller)
  })

  it('closes with the toolbar button, its own close button and Escape', () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} toolbar pivoting />)
    fireEvent.click(pivotButton())
    fireEvent.click(pivotButton())
    expect(container.querySelector('.gk-dock')).toBeNull()
    fireEvent.click(pivotButton())
    fireEvent.click(screen.getByRole('button', { name: 'Close pivot panel' }))
    expect(container.querySelector('.gk-dock')).toBeNull()
    fireEvent.click(pivotButton())
    fireEvent.keyDown(container.querySelector('.gk-dock .gk-pivot')!, { key: 'Escape' })
    expect(container.querySelector('.gk-dock')).toBeNull()
  })

  it('stays open while you work in the grid (a click elsewhere does not close it)', () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} toolbar pivoting />)
    fireEvent.click(pivotButton())
    fireEvent.pointerDown(container.querySelector('.gk-scroller')!)
    fireEvent.click(container.querySelector('.gk-row[data-rowindex="0"] .gk-cell')!)
    expect(container.querySelector('.gk-dock')).not.toBeNull()
  })

  it('works: the switch turns pivot mode on and the fields can be added', () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} toolbar pivoting />)
    fireEvent.click(pivotButton())
    const dock = container.querySelector('.gk-dock')!
    fireEvent.click(dock.querySelector('input[role=switch]')!)
    fireEvent.click(screen.getByRole('button', { name: 'Add Region to rows' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Amount to values' }))
    expect(container.querySelector('.gk-root')!.hasAttribute('data-pivot')).toBe(true)
    expect(container.querySelector('.gk-header-cell[data-field="__gk_pivot_rows__"]')).not.toBeNull()
  })

  it('pivotPanelMode="popover" keeps the floating panel', () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} toolbar pivoting pivotPanelMode="popover" />)
    fireEvent.click(pivotButton())
    expect(container.querySelector('.gk-dock')).toBeNull()
    expect(document.querySelector('.gk-popover .gk-pivot')).not.toBeNull()
  })

  it('a grid without the panel open has the same single content column as before', () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} toolbar pivoting />)
    const root = container.querySelector('.gk-root')!
    expect([...root.children].map((c) => c.className)).toEqual(['gk-main'])
  })
})
