import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { forwardRef } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Grid } from './Grid'
import { defaultSlots } from './defaultSlots'
import type { CellProps } from './Cell'
import type { RowProps } from './Row'
import type { UIColumnDef } from './types'

// jsdom lays nothing out: give the grid a viewport and the observers it needs
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
const sizes = ['clientWidth', 'clientHeight'] as const
const saved = sizes.map((k) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, k))
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 400 })
})
afterAll(() => sizes.forEach((k, i) => (saved[i] ? Object.defineProperty(HTMLElement.prototype, k, saved[i]!) : delete (HTMLElement.prototype as any)[k])))
afterEach(cleanup)

interface Person {
  id: number
  name: string
  age: number
}
const rows: Person[] = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}`, age: 20 + i }))
const columns: UIColumnDef<Person>[] = [
  { field: 'name', headerName: 'Name' },
  { field: 'age', headerName: 'Age', type: 'number' },
]
const grid = (props: Partial<React.ComponentProps<typeof Grid<Person>>> = {}) =>
  render(<Grid<Person> rows={rows} columns={columns} getRowId={(r) => r.id} height={300} pagination={false} {...props} />)

describe('slotProps: class names and style', () => {
  it('rows, cells and header cells get the extra class names; styles are merged with the positioning ones', () => {
    const { container } = grid({
      slotProps: {
        row: { className: 'my-row' },
        cell: { className: 'my-cell', style: { color: 'rgb(1, 2, 3)' } },
        headerCell: { className: 'my-head', style: { fontStyle: 'italic' } },
      },
    })
    expect(container.querySelectorAll('.gk-row.my-row').length).toBe(5)
    const cell = container.querySelector('.gk-cell.my-cell') as HTMLElement
    expect(cell.style.color).toBe('rgb(1, 2, 3)')
    expect(cell.style.width).not.toBe('') // the column width is still there
    const head = container.querySelector('.gk-header-cell.my-head') as HTMLElement
    expect(head.style.fontStyle).toBe('italic')
    expect(head.style.width).not.toBe('')
    expect(head.style.position === 'absolute' || head.style.flex !== '').toBe(true) // and so is its place
  })

  it('toolbar, footer and the pager take class names too', () => {
    const { container } = grid({ toolbar: true, pagination: true, slotProps: { toolbar: { className: 'my-toolbar' }, footer: { className: 'my-footer' } } })
    expect(container.querySelector('.gk-toolbar.my-toolbar')).not.toBeNull()
    expect(container.querySelector('.gk-footer.my-footer')).not.toBeNull()
  })
})

describe('slots: replacing parts', () => {
  it('a row slot receives the row props and can render the built-in row (wrapping it)', () => {
    const seen: string[] = []
    const MyRow = (p: RowProps<Person>) => {
      seen.push(String(p.row.id))
      return <div data-testid="wrapped"><defaultSlots.row {...p} /></div>
    }
    const { container } = grid({ slots: { row: MyRow } })
    expect(screen.getAllByTestId('wrapped')).toHaveLength(5)
    expect(container.querySelectorAll('.gk-row')).toHaveLength(5)
    expect(seen).toEqual(expect.arrayContaining(['1', '2', '3', '4', '5']))
  })

  it('a cell slot can change what a cell shows', () => {
    const MyCell = (p: CellProps<Person>) =>
      p.col.field === 'age' ? <div role="gridcell" data-testid="age" style={p.style}>{String(p.row.row?.age)} yrs</div> : <defaultSlots.cell {...p} />
    grid({ slots: { cell: MyCell } })
    expect(screen.getAllByTestId('age').map((e) => e.textContent)).toEqual(['20 yrs', '21 yrs', '22 yrs', '23 yrs', '24 yrs'])
    expect(screen.getByText('Person 1')).toBeTruthy() // the other column is the built-in cell
  })

  it('a header cell slot', () => {
    const { container } = grid({ slots: { headerCell: (p) => <div role="columnheader" data-testid="h">{p.col.headerName}</div> } })
    expect(screen.getAllByTestId('h').map((e) => e.textContent)).toEqual(['Name', 'Age'])
    expect(container.querySelector('.gk-header-cell')).toBeNull()
  })

  it('toolbar and footer slots replace the built-in ones and get the grid', () => {
    const toolbar = vi.fn((p: { grid: { rows: unknown[] } }) => <div data-testid="tb">{p.grid.rows.length} rows</div>)
    const { container } = grid({ toolbar: true, pagination: true, slots: { toolbar, footer: () => <footer data-testid="ft">my footer</footer> } })
    expect(screen.getByTestId('tb').textContent).toBe('5 rows')
    expect(screen.getByTestId('ft').textContent).toBe('my footer')
    expect(container.querySelector('.gk-toolbar')).toBeNull()
    expect(container.querySelector('.gk-footer')).toBeNull()
  })

  it('overlays: no rows, loading and error', async () => {
    grid({ rows: [], slots: { noRowsOverlay: () => <p data-testid="none">Nothing here</p> } })
    expect(screen.getByTestId('none')).toBeTruthy()
    cleanup()
    const { container } = grid({
      rows: undefined,
      dataSource: { getRows: () => new Promise(() => {}) }, // never answers: stays loading
      slots: { loadingOverlay: () => <div data-testid="busy">busy</div> },
    })
    expect(screen.getByTestId('busy')).toBeTruthy()
    expect(container.querySelector('.gk-loading')).toBeNull()
  })

  it('column menu and panels open inside the popover slot, and use the panel slots', () => {
    const Pop = (p: { children: React.ReactNode; label: string }) => <section data-testid="pop" aria-label={p.label}>{p.children}</section>
    grid({
      toolbar: true,
      slots: { popover: Pop as never, filterPanel: () => <div data-testid="fp">my filters</div> },
      slotProps: { columnMenu: { aggregation: false } },
    })
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    const pop = screen.getByTestId('pop')
    expect(pop.getAttribute('aria-label')).toBe('Filters')
    expect(within(pop).getByTestId('fp').textContent).toBe('my filters')
  })

  it('slotProps.popover adds class names to the popover', () => {
    grid({ toolbar: true, slotProps: { popover: { className: 'my-pop' } } })
    fireEvent.click(screen.getByRole('button', { name: /Columns/ }))
    expect(document.querySelector('.gk-popover.my-pop')).not.toBeNull()
  })

  it('without slots nothing changes: every slot is its built-in component', () => {
    const { container } = grid({ toolbar: true, pagination: true })
    expect(container.querySelector('.gk-toolbar')).not.toBeNull()
    expect(container.querySelector('.gk-footer')).not.toBeNull()
    expect(container.querySelectorAll('.gk-row')).toHaveLength(5)
  })
})

describe('slots: base controls and icons', () => {
  it('baseButton replaces every button the grid makes (pager, toolbar, header menu)', () => {
    const Btn = forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(function Btn(props, ref) {
      return <button ref={ref} data-ds="button" type="button" {...props} />
    })
    const { container } = grid({ toolbar: true, pagination: true, slots: { baseButton: Btn } })
    const ours = container.querySelectorAll('[data-ds="button"]')
    expect(ours.length).toBeGreaterThanOrEqual(2 + 2 + 3) // pager, header titles, toolbar
    // every grid button is one of ours (the popover is not open, so nothing else renders buttons)
    expect(container.querySelectorAll('button:not([data-ds])')).toHaveLength(0)
  })

  it('baseCheckbox: row selection and the indeterminate state still work through a forwarded ref', () => {
    const Box = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(function Box(props, ref) {
      return <input ref={ref} data-ds="box" {...props} />
    })
    const { container } = grid({ checkboxSelection: true, slots: { baseCheckbox: Box } })
    const boxes = container.querySelectorAll<HTMLInputElement>('[data-ds="box"]')
    expect(boxes).toHaveLength(5)
    fireEvent.click(boxes[0]!)
    expect((container.querySelectorAll<HTMLInputElement>('[data-ds="box"]')[0]!).checked).toBe(true)
  })

  it('baseInput and baseSelect: the quick filter and the filter operators', () => {
    const Input = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(function Input(props, ref) {
      return <input ref={ref} data-ds="input" {...props} />
    })
    const Select = forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(function Select(props, ref) {
      return <select ref={ref} data-ds="select" {...props} />
    })
    const { container } = grid({ toolbar: true, slots: { baseInput: Input, baseSelect: Select } })
    expect(container.querySelector('input.gk-search')).toBeNull() // the search is a button until it is opened
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(container.querySelector('input.gk-search[data-ds="input"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    fireEvent.click(screen.getByRole('button', { name: /Add filter/i }))
    expect(document.querySelectorAll('.gk-panel select[data-ds="select"]').length).toBeGreaterThan(0)
  })

  it('icons: each symbol can be replaced on its own, the rest stay', () => {
    const { container } = grid({
      pagination: true,
      initialState: { sortModel: [{ field: 'name', direction: 'asc' }] },
      slots: { icons: { sortAsc: () => <b data-testid="up">UP</b>, nextPage: () => <b data-testid="next">NEXT</b> } as never },
    })
    expect(screen.getByTestId('up').textContent).toBe('UP')
    expect(screen.getByTestId('next').textContent).toBe('NEXT')
    expect(container.querySelector('.gk-header-cell .gk-menu-btn')!.textContent).toBe('⋮') // untouched
    expect(within(container.querySelector('.gk-pager') as HTMLElement).getByLabelText('Previous page').textContent).toBe('‹')
  })
})
