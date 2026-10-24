import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Grid } from './Grid'
import { ColumnsButton, ExportButton, FilterButton, PivotButton, QuickFilter, Toolbar, ToolbarButton, ToolbarSeparator, ToolbarTitle, useToolbar } from './toolbarParts'
import type { UIColumnDef } from './types'
import type { ToolbarProps } from './Toolbar'

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
const rows: P[] = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}` }))
const columns: UIColumnDef<P>[] = [{ field: 'name', headerName: 'Name', width: 160 }]
const names = (c: HTMLElement) => [...c.querySelectorAll('.gk-row[data-rowindex]')].length

describe('the default toolbar', () => {
  it('is a bar of icon buttons with accessible names, a title and a quick search', () => {
    render(<Grid<P> rows={rows} columns={columns} toolbar slotProps={{ toolbar: { title: 'People' } }} />)
    const bar = screen.getByRole('toolbar')
    expect(bar.textContent).toContain('People')
    for (const name of ['Columns', 'Filters', 'Export', 'Search']) expect(screen.getByRole('button', { name })).toBeTruthy()
    expect(bar.querySelectorAll('svg').length).toBeGreaterThanOrEqual(4) // icons, not words
    expect(bar.querySelectorAll('[role=separator]')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Search' }).getAttribute('title')).toBe('Search') // the tooltip
  })

  it('has no Pivot button unless pivoting is on', () => {
    render(<Grid<P> rows={rows} columns={columns} toolbar />)
    expect(screen.queryByRole('button', { name: 'Pivot' })).toBeNull()
    cleanup()
    render(<Grid<P> rows={rows} columns={columns} toolbar pivoting />)
    expect(screen.getByRole('button', { name: 'Pivot' })).toBeTruthy()
  })

  it('the buttons open their panels and mark themselves expanded', () => {
    render(<Grid<P> rows={rows} columns={columns} toolbar />)
    const columnsButton = screen.getByRole('button', { name: 'Columns' })
    fireEvent.click(columnsButton)
    expect(columnsButton.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('.gk-popover')).not.toBeNull()
  })
})

describe('the quick search', () => {
  it('opens from its button, filters, and Escape closes it only when it is empty', () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} toolbar />)
    expect(container.querySelector('.gk-search')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    const input = container.querySelector<HTMLInputElement>('.gk-search')!
    expect(document.activeElement).toBe(input)
    fireEvent.change(input, { target: { value: 'Person 3' } })
    expect(names(container)).toBe(1)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(container.querySelector('.gk-search')).not.toBeNull() // still filtering: stays open
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(names(container)).toBe(5)
    fireEvent.keyDown(container.querySelector('.gk-search')!, { key: 'Escape' })
    expect(container.querySelector('.gk-search')).toBeNull()
  })
})

describe('the parts in a toolbar of your own', () => {
  function Mine(props: ToolbarProps<P>) {
    const { grid } = useToolbar<P>()
    return (
      <Toolbar aria-label="Mine" className={props.className}>
        <ToolbarTitle>{grid.result.rows.length} people</ToolbarTitle>
        <FilterButton />
        <ToolbarSeparator />
        <QuickFilter defaultExpanded placeholder="Find…" />
        <ToolbarButton label="Reload" onClick={() => grid.api.refreshData()}>
          R
        </ToolbarButton>
      </Toolbar>
    )
  }

  it('work in a replaced toolbar slot: they read the grid from the context', () => {
    const { container } = render(<Grid<P> rows={rows} columns={columns} toolbar slots={{ toolbar: Mine }} />)
    const bar = screen.getByRole('toolbar', { name: 'Mine' })
    expect(bar.textContent).toContain('5 people')
    expect(container.querySelector<HTMLInputElement>('.gk-search')!.placeholder).toBe('Find…')
    fireEvent.change(container.querySelector('.gk-search')!, { target: { value: '2' } })
    expect(bar.textContent).toContain('1 people') // the title follows the grid
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
  })

  it('the filter button shows how many filters are on, and says so in its name', () => {
    render(
      <Grid<P> rows={rows} columns={columns} toolbar slots={{ toolbar: Mine }} initialState={{ filterModel: { items: [{ field: 'name', operator: 'contains', value: 'x' }] } }} />,
    )
    expect(screen.getByRole('button', { name: 'Filters, 1 active' })).toBeTruthy()
  })

  it('ColumnsButton, PivotButton and ExportButton can sit anywhere in it, with your own content', () => {
    function Bar() {
      return (
        <Toolbar>
          <ColumnsButton>cols</ColumnsButton>
          <PivotButton />
          <ExportButton label="Save">out</ExportButton>
        </Toolbar>
      )
    }
    render(<Grid<P> rows={rows} columns={columns} toolbar slots={{ toolbar: Bar }} />)
    expect(screen.getByRole('button', { name: 'Columns' }).textContent).toBe('cols')
    expect(screen.getByRole('button', { name: 'Save' }).textContent).toBe('out')
    expect(screen.queryByRole('button', { name: 'Pivot' })).toBeNull()
  })

  it('outside a toolbar a part says what is wrong', () => {
    const quiet = console.error
    console.error = () => {}
    expect(() => render(<FilterButton />)).toThrow(/inside the toolbar of a Grid/)
    console.error = quiet
  })
})
