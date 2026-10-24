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
  name: string
}
const rows: P[] = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}` }))
const columns: UIColumnDef<P>[] = [{ field: 'name', headerName: 'Name', width: 160 }]

const renderedIndexes = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('.gk-row[data-rowindex]')].map((r) => Number(r.dataset.rowindex))

describe('scrolling past the rendered rows', () => {
  it('renders the new rows inside the scroll event, not a frame later', () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} pagination={false} rowHeight={20} />)
    const scroller = container.querySelector<HTMLElement>('.gk-scroller')!
    expect(Math.max(...renderedIndexes(container))).toBeLessThan(100)
    scroller.scrollTop = 10000 // row 500: far outside the window
    fireEvent.scroll(scroller) // no animation frame is run between this and the assertion
    const now = renderedIndexes(container)
    expect(Math.min(...now)).toBeGreaterThan(400)
    expect(now).toContain(500)
  })

  it('a small scroll inside the rendered window waits for the frame (one write per frame)', () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} pagination={false} rowHeight={20} />)
    const scroller = container.querySelector<HTMLElement>('.gk-scroller')!
    const before = renderedIndexes(container).join()
    scroller.scrollTop = 20
    fireEvent.scroll(scroller)
    expect(renderedIndexes(container).join()).toBe(before)
  })
})
