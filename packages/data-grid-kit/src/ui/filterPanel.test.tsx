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
}
const rows: P[] = [
  { id: 1, name: 'Ana', team: 'Data' },
  { id: 2, name: 'Bia', team: 'Design' },
  { id: 3, name: 'Caio', team: 'Data' },
]
const columns: UIColumnDef<P>[] = [
  { field: 'name', headerName: 'Name', width: 120 },
  { field: 'team', headerName: 'Team', width: 120 },
]
const shown = (c: HTMLElement) => c.querySelectorAll('.gk-row[data-rowindex]').length
const panel = () => within(screen.getByRole('dialog'))

function open(initial?: { items: { field: string; operator: 'contains' | 'isEmpty'; value?: unknown }[] }) {
  const view = render(<Grid<P> rows={rows} columns={columns} toolbar initialState={initial ? { filterModel: initial } : undefined} />)
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
  return view
}

describe('the filter panel opens ready to use', () => {
  it('with one row to fill in, and no "No filters" text to click past', () => {
    open()
    expect(screen.queryByText(/No filters/)).toBeNull()
    expect(panel().getAllByLabelText('Column')).toHaveLength(1)
    expect((panel().getByLabelText('Column') as HTMLSelectElement).value).toBe('name')
    expect(panel().getByLabelText('Value')).toBeTruthy()
  })

  it('puts the focus in the value box', () => {
    open()
    expect(document.activeElement).toBe(panel().getByLabelText('Value'))
  })

  it('shows the row without making it a filter: nothing is filtered and the button counts nothing', () => {
    const { container } = open()
    expect(shown(container)).toBe(3)
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy() // no "n active"
    expect(panel().queryByRole('button', { name: 'Remove all' })).toBeNull()
    expect((panel().getByRole('button', { name: 'Remove filter' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('typing a value makes it a real filter', () => {
    const { container } = open()
    fireEvent.change(panel().getByLabelText('Value'), { target: { value: 'ana' } })
    expect(shown(container)).toBe(1)
    expect(screen.getByRole('button', { name: 'Filters, 1 active' })).toBeTruthy()
    expect(panel().getByRole('button', { name: /Remove all/ })).toBeTruthy()
  })

  it('changing the column of the ready row works as well', () => {
    const { container } = open()
    fireEvent.change(panel().getByLabelText('Column'), { target: { value: 'team' } })
    fireEvent.change(panel().getByLabelText('Value'), { target: { value: 'Design' } })
    expect(shown(container)).toBe(1)
  })

  it('Add filter next to the ready row gives a second row', () => {
    open()
    fireEvent.click(panel().getByRole('button', { name: /Add filter/ }))
    expect(panel().getAllByLabelText('Column')).toHaveLength(2)
  })

  it('removing the last real filter puts the ready row back', () => {
    const { container } = open({ items: [{ field: 'name', operator: 'contains', value: 'ana' }] })
    expect(shown(container)).toBe(1)
    fireEvent.click(panel().getByRole('button', { name: 'Remove filter' }))
    expect(shown(container)).toBe(3)
    expect(panel().getAllByLabelText('Column')).toHaveLength(1)
  })
})

describe('the filter count', () => {
  it('counts the filters that filter: a row with nothing typed does not count, "is empty" does', () => {
    open({
      items: [
        { field: 'name', operator: 'contains', value: '' },
        { field: 'team', operator: 'contains', value: 'Data' },
        { field: 'name', operator: 'isEmpty' },
      ],
    })
    expect(screen.getByRole('button', { name: 'Filters, 2 active' })).toBeTruthy()
  })

  it('a row with nothing typed filters nothing', () => {
    const { container } = open({ items: [{ field: 'name', operator: 'contains', value: '' }] })
    expect(shown(container)).toBe(3)
  })
})
