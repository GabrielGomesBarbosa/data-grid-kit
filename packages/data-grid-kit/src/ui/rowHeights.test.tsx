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
const stable = { rows, columns, pagination: false as const, rowHeight: 20, getRowId: (r: P) => r.id }

const rowEl = (c: HTMLElement, index: number) => c.querySelector<HTMLElement>(`.gk-row[data-rowindex="${index}"]`)!
const topOf = (el: HTMLElement) => Number(/translateY\(([\d.]+)px\)/.exec(el.style.transform)![1])

// even rows 20 (the default), odd rows 60
const oddTall = ({ id }: { id: number | string }) => (Number(id) % 2 === 0 ? 60 : undefined) // id 2 is row index 1

describe('getRowHeight', () => {
  it('each row has its own height and sits under the ones above', () => {
    const { container } = render(<Grid<P> {...stable} getRowHeight={oddTall} />)
    expect([0, 1, 2, 3].map((i) => rowEl(container, i).style.height)).toEqual(['20px', '60px', '20px', '60px'])
    expect([0, 1, 2, 3].map((i) => topOf(rowEl(container, i)))).toEqual([0, 20, 80, 100])
    const body = container.querySelector<HTMLElement>('.gk-body')!
    expect(body.style.height).toBe(`${500 * 20 + 500 * 60}px`)
  })

  it('null, undefined, zero, negative and NaN fall back to rowHeight; "auto" uses the estimate', () => {
    const odd = new Map<number, number | null | undefined | 'auto'>([[1, 0], [2, -4], [3, Number.NaN], [4, null], [5, 'auto']])
    const { container } = render(<Grid<P> {...stable} getEstimatedRowHeight={33} getRowHeight={({ id }) => odd.get(Number(id))} />)
    expect([0, 1, 2, 3, 4].map((i) => rowEl(container, i).style.height)).toEqual(['20px', '20px', '20px', '20px', '33px'])
  })

  it('scrolling far renders the right rows for the heights (not the fixed-height guess)', () => {
    const { container } = render(<Grid<P> {...stable} getRowHeight={oddTall} />)
    const scroller = container.querySelector<HTMLElement>('.gk-scroller')!
    scroller.scrollTop = 20000 // 20000 / 40 average = row ~500
    fireEvent.scroll(scroller)
    const shown = [...container.querySelectorAll<HTMLElement>('.gk-row[data-rowindex]')].map((r) => Number(r.dataset.rowindex))
    expect(shown.some((i) => i >= 490 && i <= 510)).toBe(true)
    expect(Math.min(...shown)).toBeGreaterThan(400)
    // every row shown starts where the heights above it say
    for (const i of shown) expect(topOf(rowEl(container, i))).toBe(Math.floor(i / 2) * 80 + (i % 2 ? 20 : 0))
  })

  it('without getRowHeight nothing changes: rows are rowHeight apart', () => {
    const { container } = render(<Grid<P> {...stable} />)
    expect([0, 1, 2].map((i) => topOf(rowEl(container, i)))).toEqual([0, 20, 40])
  })
})
