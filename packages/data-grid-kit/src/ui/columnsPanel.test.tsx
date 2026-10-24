import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
  team: string
  age: number
}
const rows: P[] = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}`, team: 'Data', age: 20 + i }))
const columns: UIColumnDef<P>[] = [
  { field: 'name', headerName: 'Name', width: 120 },
  { field: 'team', headerName: 'Team', width: 100 },
  { field: 'age', headerName: 'Age', width: 80, hidden: true },
]

const open = () => {
  const view = render(<Grid<P> rows={rows} columns={columns} toolbar />)
  fireEvent.click(screen.getByRole('button', { name: 'Columns' }))
  return view
}
const panel = () => within(screen.getByRole('dialog'))
const headers = () => [...document.querySelectorAll('.gk-header-cell')].map((h) => h.getAttribute('data-field'))

describe('columns panel', () => {
  it('lists every column with its checkbox, a search box, Show/Hide All and Reset', () => {
    open()
    expect(panel().getAllByRole('checkbox').map((c) => (c as HTMLInputElement).checked)).toEqual([true, true, false, false]) // 3 columns + Show/Hide All
    expect(panel().getByLabelText('Search columns')).toBeTruthy()
    expect(panel().getByLabelText('Show/Hide All')).toBeTruthy()
    expect(panel().getByRole('button', { name: 'Reset' })).toBeTruthy()
  })

  it('the search filters the list by title, ignoring case, and says when nothing matches', () => {
    open()
    fireEvent.change(panel().getByLabelText('Search columns'), { target: { value: 'TEA' } })
    expect(panel().getByLabelText('Team')).toBeTruthy()
    expect(panel().queryByLabelText('Name')).toBeNull()
    fireEvent.change(panel().getByLabelText('Search columns'), { target: { value: 'zzz' } })
    expect(panel().getByText('No column matches')).toBeTruthy()
  })

  it('Show/Hide All is mixed while some are hidden, shows everything when ticked and hides everything when cleared', () => {
    open()
    const all = panel().getByLabelText('Show/Hide All') as HTMLInputElement
    expect(all.indeterminate).toBe(true) // Age is hidden
    fireEvent.click(all)
    expect(headers()).toEqual(['name', 'team', 'age'])
    expect(all.checked).toBe(true)
    expect(all.indeterminate).toBe(false)
    fireEvent.click(all)
    expect(headers()).toEqual([])
    expect(all.checked).toBe(false)
  })

  it('Reset goes back to what the columns say (Age starts hidden) and is disabled when nothing was changed', () => {
    open()
    const reset = panel().getByRole('button', { name: 'Reset' }) as HTMLButtonElement
    expect(reset.disabled).toBe(true)
    fireEvent.click(panel().getByLabelText('Age'))
    fireEvent.click(panel().getByLabelText('Team'))
    expect(headers()).toEqual(['name', 'age'])
    expect(reset.disabled).toBe(false)
    fireEvent.click(reset)
    expect(headers()).toEqual(['name', 'team'])
    expect(reset.disabled).toBe(true)
  })

  it('the last column can be hidden too', () => {
    open()
    fireEvent.click(panel().getByLabelText('Team'))
    const name = panel().getByLabelText('Name') as HTMLInputElement
    expect(name.disabled).toBe(false)
    fireEvent.click(name)
    expect(headers()).toEqual([])
  })
})

describe('a grid with no columns', () => {
  it('shows "No columns" and no rows, with a Manage columns button that opens the panel', () => {
    const { container } = open()
    fireEvent.click(panel().getByLabelText('Show/Hide All'))
    fireEvent.click(panel().getByLabelText('Show/Hide All')) // hide all
    expect(screen.getByText('No columns')).toBeTruthy()
    expect(container.querySelectorAll('.gk-row[data-rowindex]')).toHaveLength(0)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Manage columns' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(panel().getByLabelText('Show/Hide All'))
    expect(screen.queryByText('No columns')).toBeNull()
    expect(container.querySelectorAll('.gk-row[data-rowindex]').length).toBeGreaterThan(0)
  })

  it('without a toolbar the way back is the Manage columns button too', () => {
    render(<Grid<P> rows={rows} columns={columns.map((c) => ({ ...c, hidden: true }))} />)
    expect(screen.getByText('No columns')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Manage columns' }))
    expect(screen.getByRole('dialog', { name: /column/i })).toBeTruthy()
  })
})
