import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
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
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 400 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 340 })
})
afterAll(() => {
  delete (HTMLElement.prototype as any).clientWidth
  delete (HTMLElement.prototype as any).clientHeight
})
afterEach(cleanup)

interface P {
  id: number
}
const rows: P[] = Array.from({ length: 200 }, (_, i) => ({ id: i + 1 }))
// ten columns of 100px: the scrolling area is 400px wide
const columns: UIColumnDef<P>[] = Array.from({ length: 10 }, (_, i) => ({ field: i === 0 ? 'id' : `c${i}`, headerName: `C${i}`, width: 100, valueGetter: (r: P) => r.id }))
// rows are 30px and the header 40px (the grid's default): the body is 300px high
const setup = (extra: object = {}) => {
  let api!: GridApi<P>
  render(<Grid<P> rows={rows} columns={columns} getRowId={(r) => r.id} rowHeight={30} headerHeight={40} pagination={false} onReady={(a) => (api = a)} {...extra} />)
  const el = document.querySelector<HTMLElement>('.gk-scroller')!
  return { api, el }
}

describe('scroll api', () => {
  it('scrollToIndexes puts a row at the start, middle or end of the body', () => {
    const { api, el } = setup()
    act(() => void api.scrollToIndexes({ rowIndex: 100, align: 'start' }))
    expect(el.scrollTop).toBe(3000)
    act(() => void api.scrollToIndexes({ rowIndex: 100, align: 'center' }))
    expect(el.scrollTop).toBe(3000 - 135) // (300 - 30) / 2
    act(() => void api.scrollToIndexes({ rowIndex: 100, align: 'end' }))
    expect(el.scrollTop).toBe(3000 + 30 - 300)
  })

  it('nearest leaves a row that is in view alone and moves the shortest way for one that is not', () => {
    const { api, el } = setup()
    act(() => void api.scrollToIndexes({ rowIndex: 3 }))
    expect(el.scrollTop).toBe(0)
    act(() => void api.scrollToIndexes({ rowIndex: 50 }))
    expect(el.scrollTop).toBe(50 * 30 + 30 - 300) // it comes in at the bottom
    act(() => void api.scrollToIndexes({ rowIndex: 10 }))
    expect(el.scrollTop).toBe(300) // and back in at the top
  })

  it('scrollToColumn and scrollToCell account for the width of the scrolling area', () => {
    const { api, el } = setup()
    act(() => void api.scrollToColumn('c7', 'start'))
    expect(el.scrollLeft).toBe(700)
    act(() => void api.scrollToColumn('c9', 'end'))
    expect(el.scrollLeft).toBe(1000 - 400)
    act(() => void api.scrollToCell(150, 'c2', 'start'))
    expect(el.scrollTop).toBe(149 * 30)
    expect(el.scrollLeft).toBe(200)
  })

  it('pinned columns are always in view: scrolling to one does not move', () => {
    const { api, el } = setup({ initialState: { pinnedColumns: { left: ['c1'], right: [] } } })
    act(() => void api.scrollToColumn('c1', 'start'))
    expect(el.scrollLeft).toBe(0)
  })

  it('returns false for a row or column that does not exist', () => {
    const { api } = setup()
    expect(api.scrollToRow(99999)).toBe(false)
    expect(api.scrollToColumn('nope')).toBe(false)
    expect(api.scrollToIndexes({})).toBe(false)
    expect(api.scrollToRow(5)).toBe(true)
  })

  it('initialState.scroll puts the element where the state says', () => {
    const { el } = setup({ initialState: { scroll: { top: 900, left: 300 } } })
    expect(el.scrollTop).toBe(900)
    expect(el.scrollLeft).toBe(300)
    // and the rows drawn are the ones there
    expect(document.querySelector('.gk-row[data-rowindex="30"]')).toBeTruthy()
    expect(document.querySelector('.gk-row[data-rowindex="0"]')).toBeNull()
  })
})
