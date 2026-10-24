import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { mergeProps } from './mergeProps'
import { useGridView } from './useGridView'
import type { GridProps } from './types'

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
  age: number
}
const rows: P[] = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}`, age: 20 + i }))
const columns = [{ field: 'name', headerName: 'Name' }, { field: 'age', headerName: 'Age', type: 'number' as const }]

/** A grid drawn with different elements (a list of <article>s) from the same view: nothing of the default markup. */
function CustomGrid(props: GridProps<P>) {
  const view = useGridView(props)
  const { layout } = view.grid
  return (
    <section {...view.getRootProps({ 'data-testid': 'root' })}>
      <div {...view.getScrollerProps({ 'data-testid': 'scroller' })}>
        <div {...view.getContentProps()}>
          <header role="row">
            {layout.all.map((c) => (
              <b key={c.field} role="columnheader">
                {c.headerName}
              </b>
            ))}
          </header>
          <div {...view.getBodyProps()}>
            {view.bodyRows.map((item) =>
              item.type === 'row' ? (
                <article
                  key={item.key}
                  role="row"
                  aria-rowindex={item.props.ariaRow}
                  data-selected={item.props.selected === true ? '' : undefined}
                  style={{ position: 'absolute', top: item.props.top, height: item.props.rowHeight }}
                >
                  {layout.all.map((c) => (
                    <span key={c.field} role="gridcell">
                      {String((item.props.row.row as P)[c.field as keyof P])}
                    </span>
                  ))}
                </article>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <output>{view.grid.state.focusedCell ? `${view.grid.state.focusedCell.rowId}:${view.grid.state.focusedCell.field}` : 'none'}</output>
    </section>
  )
}

describe('useGridView: the grid with your own markup', () => {
  it('gives virtualized rows (not all 40), the ARIA grid roles and the scrolling element', () => {
    render(<CustomGrid rows={rows} columns={columns} getRowId={(r) => r.id} pagination={false} rowHeight={20} height={100} />)
    const scroller = screen.getByTestId('scroller')
    expect(scroller.getAttribute('role')).toBe('grid')
    expect(scroller.getAttribute('aria-colcount')).toBe('2')
    expect(scroller.getAttribute('aria-rowcount')).toBe('41') // 40 rows + the header
    expect(scroller.tabIndex).toBe(0)
    const shown = screen.getAllByRole('row').filter((r) => r.tagName === 'ARTICLE')
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(40) // 400px of viewport, 20px rows, a buffer: far fewer than all
    expect(shown[0]!.textContent).toBe('Person 120')
  })

  it('keyboard navigation works through the scroller props', () => {
    let api: import('../core').GridApi<P> | undefined
    render(<CustomGrid rows={rows} columns={columns} getRowId={(r) => r.id} pagination={false} onReady={(a) => (api = a)} />)
    act(() => api!.focusCell({ rowId: 1, field: 'name' }))
    expect(screen.getByRole('status', { hidden: true }).textContent).toBe('1:name')
    fireEvent.keyDown(screen.getByTestId('scroller'), { key: 'ArrowDown' })
    expect(screen.getByRole('status', { hidden: true }).textContent).toBe('2:name')
    fireEvent.keyDown(screen.getByTestId('scroller'), { key: 'ArrowRight' })
    expect(screen.getByRole('status', { hidden: true }).textContent).toBe('2:age')
  })

  it('passing your own props to a getter merges them: class names joined, styles merged, handlers chained', () => {
    const onKeyDown = vi.fn()
    render(<CustomGrid rows={rows} columns={columns} getRowId={(r) => r.id} />)
    expect(screen.getByTestId('root').className).toContain('gk-root')
    cleanup()
    function Probe() {
      const view = useGridView<P>({ rows, columns, getRowId: (r) => r.id })
      const p = view.getScrollerProps({ className: 'mine', style: { color: 'red' }, onKeyDown, 'data-testid': 's' })
      return <div {...p} />
    }
    render(<Probe />)
    const el = screen.getByTestId('s')
    expect(el.className).toBe('gk-scroller mine')
    expect(el.style.color).toBe('red')
    fireEvent.keyDown(el, { key: 'x' })
    expect(onKeyDown).toHaveBeenCalledTimes(1) // the grid's own handler ran too (it ignores the key) and so did ours
  })
})

describe('mergeProps', () => {
  it('joins class names, merges styles, chains handlers in order, lets everything else be overridden', () => {
    const order: string[] = []
    const merged = mergeProps(
      { className: 'a', style: { color: 'red', top: 1 }, onClick: () => order.push('own'), title: 'own', id: 'x' },
      { className: 'b', style: { color: 'blue' }, onClick: () => order.push('yours'), title: 'yours' },
    ) as Record<string, any>
    expect(merged.className).toBe('a b')
    expect(merged.style).toEqual({ color: 'blue', top: 1 })
    merged.onClick()
    expect(order).toEqual(['own', 'yours'])
    expect(merged.title).toBe('yours')
    expect(merged.id).toBe('x')
  })
  it('returns the same object when there is nothing to merge', () => {
    const own = { a: 1 }
    expect(mergeProps(own)).toBe(own)
  })
})
