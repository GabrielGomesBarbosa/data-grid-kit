import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import axe from 'axe-core'
import { Grid } from './Grid'
import { defaultSlots } from './defaultSlots'
import type { CellProps } from './Cell'
import type { UIColumnDef } from './types'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as never // axe probes canvas; jsdom has none
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
const rows: P[] = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}`, age: 20 + i }))
const columns: UIColumnDef<P>[] = [
  { field: 'name', headerName: 'Name', width: 160 },
  { field: 'age', headerName: 'Age', type: 'number', width: 100 },
]

// Rules that need layout or colours cannot run in jsdom; the structural ARIA rules can.
async function violations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}

describe('accessibility (axe, structural rules)', () => {
  it('control: axe does report broken grid markup', async () => {
    const { container } = render(
      <div role="grid" aria-label="x">
        <div role="gridcell">orphan cell</div>
      </div>,
    )
    expect((await violations(container)).length).toBeGreaterThan(0)
  })

  it('the default grid has no violations', async () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} pagination={false} />)
    expect(await violations(container)).toEqual([])
  })

  it('with checkboxes, a toolbar and a pager', async () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} checkboxSelection toolbar />)
    expect(await violations(container)).toEqual([])
  })

  it('with a custom cell that wraps the built-in one', async () => {
    const Cell = (p: CellProps<P>) => <defaultSlots.cell {...p} />
    const { container } = render(<Grid<P> rows={rows} columns={columns} slots={{ cell: Cell }} />)
    expect(await violations(container)).toEqual([])
  })

  it('exposes the grid roles and counts', () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} pagination={false} />)
    const grid = container.querySelector('[role="grid"]')!
    expect(grid.getAttribute('aria-rowcount')).toBe(String(rows.length + 1))
    expect(grid.getAttribute('aria-colcount')).toBe(String(columns.length))
    expect(container.querySelectorAll('[role="columnheader"]').length).toBe(columns.length)
    expect(container.querySelector('[role="row"][aria-rowindex="2"]')).not.toBeNull()
  })
})
