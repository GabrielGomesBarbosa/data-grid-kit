import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { Grid } from './Grid'
import type { UIColumnDef } from './types'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

// jsdom lays nothing out: a cell is as tall as its text (10 characters a line, 20px a line), unless a test says otherwise
const forced = new Map<number, number>() // row index → height of its cells
const lineHeight = (cell: HTMLElement) => 20 * Math.max(1, Math.ceil((cell.textContent ?? '').length / 10))
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 400 })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (!this.classList.contains('gk-cell')) return 0
      const index = Number(this.closest<HTMLElement>('.gk-row')?.dataset.rowindex)
      return forced.get(index) ?? lineHeight(this)
    },
  })
})
afterAll(() => {
  delete (HTMLElement.prototype as any).clientWidth
  delete (HTMLElement.prototype as any).clientHeight
  delete (HTMLElement.prototype as any).offsetHeight
})
afterEach(() => {
  cleanup()
  forced.clear()
})

interface P {
  id: number
  name: string
}
// text of 5, 15, 25, 35, 45 characters: 1, 2, 3, 4, 5 lines → 20, 40, 60, 80, 100 px
const rows: P[] = Array.from({ length: 500 }, (_, i) => ({ id: i + 1, name: 'x'.repeat(5 + (i % 5) * 10) }))
const columns: UIColumnDef<P>[] = [{ field: 'name', headerName: 'Name', width: 160 }]
const stable = { rows, columns, pagination: false as const, rowHeight: 20, getRowId: (r: P) => r.id }
const auto = () => 'auto' as const
const heightsByRow = (c: HTMLElement) => new Map([...c.querySelectorAll<HTMLElement>('.gk-row[data-rowindex]')].map((r) => [Number(r.dataset.rowindex), parseFloat(r.style.height)]))
const topOf = (el: HTMLElement) => Number(/translateY\(([\d.]+)px\)/.exec(el.style.transform)![1])

describe("getRowHeight: 'auto'", () => {
  it('rows take the height their content measured, and sit under the ones above', () => {
    const { container } = render(<Grid<P> {...stable} getRowHeight={auto} getEstimatedRowHeight={50} />)
    const h = heightsByRow(container)
    expect([0, 1, 2, 3, 4, 5].map((i) => h.get(i))).toEqual([20, 40, 60, 80, 100, 20])
    const tops = [0, 1, 2, 3, 4, 5].map((i) => topOf(container.querySelector<HTMLElement>(`.gk-row[data-rowindex="${i}"]`)!))
    expect(tops).toEqual([0, 20, 60, 120, 200, 300])
  })

  it('marks the rows and lets their cells keep their natural height', () => {
    const { container } = render(<Grid<P> {...stable} getRowHeight={auto} />)
    const row = container.querySelector<HTMLElement>('.gk-row[data-rowindex="0"]')!
    expect(row.hasAttribute('data-auto')).toBe(true)
    expect(row.querySelector<HTMLElement>('.gk-cell')!.style.bottom).toBe('') // not stretched to the row
    const fixed = render(<Grid<P> {...stable} getRowHeight={() => 30} />).container.querySelector<HTMLElement>('.gk-row[data-rowindex="0"]')!
    expect(fixed.hasAttribute('data-auto')).toBe(false)
    expect(fixed.querySelector<HTMLElement>('.gk-cell')!.style.bottom).toBe('0px')
  })

  it('rows not measured use the estimate: the body is as tall as the measured rows plus the estimated ones', () => {
    const { container } = render(<Grid<P> {...stable} getRowHeight={auto} getEstimatedRowHeight={50} />)
    const shown = heightsByRow(container).size
    const body = parseFloat(container.querySelector<HTMLElement>('.gk-body')!.style.height)
    // rows 0..m-1 were measured (a few more than are shown now: the window shrank when the real heights came in)
    const totals = Array.from({ length: 12 }, (_, k) => shown + k).map((m) => {
      let sum = (500 - m) * 50
      for (let i = 0; i < m; i++) sum += 20 + 20 * (i % 5)
      return sum
    })
    expect(totals).toContain(body)
  })

  it('a row mixing numbers and auto works: only the auto ones are measured', () => {
    const { container } = render(<Grid<P> {...stable} getRowHeight={({ id }) => (Number(id) % 2 ? 44 : 'auto')} />)
    const h = heightsByRow(container)
    expect([0, 1, 2, 3].map((i) => h.get(i))).toEqual([44, 40, 44, 80])
  })

  it('a row that changes above the visible rows does not move what the user is reading', () => {
    const { container, rerender } = render(<Grid<P> {...stable} getRowHeight={auto} />)
    const scroller = container.querySelector<HTMLElement>('.gk-scroller')!
    scroller.scrollTop = 3000
    fireEvent.scroll(scroller)
    const rendered = [...heightsByRow(container).keys()].sort((a, b) => a - b)
    const el = (i: number) => container.querySelector<HTMLElement>(`.gk-row[data-rowindex="${i}"]`)!
    const above = rendered[0]! // the first rendered row: in the buffer above the visible ones
    const reading = rendered.find((i) => topOf(el(i)) >= scroller.scrollTop)! // the first row fully in view
    expect(above).toBeLessThan(reading)
    const where = topOf(el(reading)) - scroller.scrollTop
    const before = scroller.scrollTop
    const old = heightsByRow(container).get(above)!
    forced.set(above, old + 60) // it grows by 60
    rerender(<Grid<P> {...stable} getRowHeight={() => 'auto'} />) // a render re-measures the rows on screen (same heights otherwise)
    expect(scroller.scrollTop - before).toBe(60)
    expect(topOf(el(reading)) - scroller.scrollTop).toBe(where) // still the same place on screen
  })

  describe('columns', () => {
    const wide: UIColumnDef<P>[] = Array.from({ length: 20 }, (_, i) => ({ field: `c${i}`, headerName: `C${i}`, width: 200, valueGetter: (r: P) => `${r.name}-${i}` }))
    const cellsOfFirstRow = (c: HTMLElement) => c.querySelectorAll('.gk-row[data-rowindex="0"] .gk-cell').length

    it("every column is rendered while there are 'auto' rows (a row is as tall as its tallest cell)", () => {
      const { container } = render(<Grid<P> {...stable} columns={wide} getRowHeight={auto} />)
      expect(cellsOfFirstRow(container)).toBe(20)
    })

    it('unless columns are asked to stay virtualized', () => {
      const { container } = render(<Grid<P> {...stable} columns={wide} getRowHeight={auto} virtualizeColumnsWithAutoRowHeight />)
      expect(cellsOfFirstRow(container)).toBeLessThan(20)
    })

    it('rows with numbers only, or no getRowHeight, keep virtualizing columns', () => {
      expect(cellsOfFirstRow(render(<Grid<P> {...stable} columns={wide} getRowHeight={() => 30} />).container)).toBeLessThan(20)
      cleanup()
      expect(cellsOfFirstRow(render(<Grid<P> {...stable} columns={wide} />).container)).toBeLessThan(20)
    })
  })

  it('settles: stable content is not re-measured forever', () => {
    let calls = 0
    const counting = () => {
      calls++
      return 'auto' as const
    }
    render(<Grid<P> {...stable} getRowHeight={counting} />)
    const first = calls
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(500 * 12) // the list is read a few times at most, not in a loop
  })
})
