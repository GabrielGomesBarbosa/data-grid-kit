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

const rows = [{ id: 1, name: 'Ana', team: 'Data', city: 'Rio' }]
const columns: UIColumnDef<(typeof rows)[number]>[] = [
  { field: 'name', headerName: 'Name', width: 100, hideable: false },
  { field: 'team', headerName: 'Team', width: 100 },
  { field: 'city', headerName: 'City', width: 100 },
]
const headers = () => [...document.querySelectorAll('.gk-header-cell')].map((h) => h.getAttribute('data-field'))
const openPanel = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Columns' }))
  return within(screen.getByRole('dialog'))
}

describe('columns panel options', () => {
  it('hideable: false keeps a column: its checkbox and its menu item are off, and Show/Hide All skips it', () => {
    render(<Grid rows={rows} columns={columns} toolbar />)
    const panel = openPanel()
    expect((panel.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(panel.getByLabelText('Show/Hide All')) // all shown → hide the ones that can be hidden
    expect(headers()).toEqual(['name'])
    fireEvent.click(panel.getByLabelText('Show/Hide All'))
    expect(headers()).toEqual(['name', 'team', 'city'])
    fireEvent.click(screen.getByRole('button', { name: 'Name column menu' }))
    expect((screen.getByRole('menuitem', { name: 'Hide column' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('Show/Hide All and Reset can be left out', () => {
    render(<Grid rows={rows} columns={columns} toolbar slotProps={{ columnsPanel: { disableShowHideToggle: true, disableResetButton: true } }} />)
    const panel = openPanel()
    expect(panel.queryByLabelText('Show/Hide All')).toBeNull()
    expect(panel.queryByRole('button', { name: 'Reset' })).toBeNull()
  })

  it('getTogglableColumns limits what the panel lists', () => {
    render(<Grid rows={rows} columns={columns} toolbar slotProps={{ columnsPanel: { getTogglableColumns: (cols) => cols.filter((c) => c.field !== 'city').map((c) => c.field) } }} />)
    const panel = openPanel()
    expect(panel.queryByLabelText('City')).toBeNull()
    expect(panel.getByLabelText('Team')).toBeTruthy()
  })

  it("toggleAllMode 'filteredOnly': Show/Hide All acts on the columns the search leaves", () => {
    render(<Grid rows={rows} columns={columns} toolbar slotProps={{ columnsPanel: { toggleAllMode: 'filteredOnly' } }} />)
    const panel = openPanel()
    fireEvent.change(panel.getByLabelText('Search columns'), { target: { value: 'te' } })
    fireEvent.click(panel.getByLabelText('Show/Hide All'))
    expect(headers()).toEqual(['name', 'city']) // only Team went
  })
})
