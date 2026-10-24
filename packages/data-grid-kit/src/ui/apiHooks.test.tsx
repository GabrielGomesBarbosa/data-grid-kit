import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { Grid } from './Grid'
import { useGridApiContext, useGridApiRef, useGridSelector } from './apiContext'
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
const rows: P[] = [
  { id: 1, name: 'Ana' },
  { id: 2, name: 'Bia' },
]

describe('api hooks', () => {
  it('apiRef gives the api outside the grid, and null again when the grid goes away', () => {
    let ref!: ReturnType<typeof useGridApiRef<P>>
    function App({ show }: { show: boolean }) {
      ref = useGridApiRef<P>()
      return show ? <Grid<P> rows={rows} columns={[{ field: 'name', headerName: 'Name' }]} apiRef={ref} /> : null
    }
    const view = render(<App show />)
    expect(ref.current).not.toBeNull()
    act(() => ref.current!.setSortModel([{ field: 'name', direction: 'desc' }]))
    expect(document.querySelector('.gk-header-cell')!.getAttribute('aria-sort')).toBe('descending')
    view.rerender(<App show={false} />)
    expect(ref.current).toBeNull()
  })

  it('inside the grid a renderer reaches the api and reads the state', () => {
    function Picked() {
      const api = useGridApiContext<P>()
      const sorted = useGridSelector((s) => s.sortModel.length)
      return (
        <button onClick={() => api.setSortModel([{ field: 'name', direction: 'asc' }])}>
          sorted by {sorted}
        </button>
      )
    }
    const columns: UIColumnDef<P>[] = [{ field: 'name', headerName: 'Name', renderHeader: () => <Picked /> }]
    render(<Grid<P> rows={rows} columns={columns} />)
    const mine = () => document.querySelector<HTMLElement>('.gk-header-label button')!
    expect(mine().textContent).toBe('sorted by 0')
    act(() => mine().click())
    expect(mine().textContent).toBe('sorted by 1')
  })

  it('outside a grid the context hook says what to do', () => {
    function Lost() {
      useGridApiContext()
      return null
    }
    const spy = console.error
    console.error = () => {}
    try {
      expect(() => render(<Lost />)).toThrow(/inside a <Grid>/)
    } finally {
      console.error = spy
    }
  })
})
