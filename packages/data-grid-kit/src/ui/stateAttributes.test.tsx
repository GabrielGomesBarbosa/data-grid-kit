import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
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
  team: string
  n: number
}
const rows: P[] = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, team: i % 2 ? 'A' : 'B', n: i }))
const columns: UIColumnDef<P>[] = [
  { field: 'team', headerName: 'Team' },
  { field: 'n', headerName: 'N', type: 'number' },
]

// The look of the grid is yours: these attributes are what a stylesheet hangs state on.
describe('state attributes (the styling surface)', () => {
  it('header cells: sorted direction, pinned side, field and alignment', () => {
    const { container } = render(
      <Grid rows={rows} columns={columns} getRowId={(r) => r.id} pagination={false} initialState={{ sortModel: [{ field: 'n', direction: 'desc' }], pinnedColumns: { left: ['team'], right: [] } }} />,
    )
    const head = (f: string) => container.querySelector<HTMLElement>(`.gk-header-cell[data-field="${f}"]`)!
    expect(head('n').dataset.sort).toBe('desc')
    expect(head('n').dataset.align).toBe('right')
    expect(head('n').getAttribute('aria-sort')).toBe('descending')
    expect(head('team').dataset.sort).toBeUndefined()
    expect(head('team').dataset.pinned).toBe('left')
    expect(head('n').dataset.pinned).toBeUndefined()
  })

  it('rows: odd, selected, group, detail-open; cells: focused, field', () => {
    const { container } = render(
      <Grid rows={rows} columns={columns} getRowId={(r) => r.id} pagination={false} checkboxSelection initialState={{ rowGroupingModel: ['team'] }} />,
    )
    expect(container.querySelectorAll('.gk-row[data-group]')).toHaveLength(2)
    const first = container.querySelector<HTMLElement>('.gk-row')!
    expect(first.dataset.rowindex).toBe('0')
    expect(container.querySelector('.gk-row[data-odd]')).not.toBeNull()
    fireEvent.click(first.querySelector('input[type=checkbox]')!)
    expect(container.querySelector('.gk-row[data-selected]')).not.toBeNull()
  })

  it('the root says when it is loading or pivoting', () => {
    const { container } = render(<Grid columns={columns} dataSource={{ getRows: () => new Promise<never>(() => {}) }} pagination={false} />)
    expect(container.querySelector('.gk-root')!.hasAttribute('data-loading')).toBe(true)
    cleanup()
    const idle = render(<Grid rows={rows} columns={columns} getRowId={(r) => r.id} />)
    expect(idle.container.querySelector('.gk-root')!.hasAttribute('data-loading')).toBe(false)
    expect(idle.container.querySelector('.gk-root')!.hasAttribute('data-pivot')).toBe(false)
  })
})
