import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Grid } from './Grid'
import type { UIColumnDef } from './types'
import { cellToText, formatDateTimeInput, parseCellText, parseDateTimeInput, type GridApi } from '../core'
import { ptBR } from '../locales'

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
  at: Date
}
const rows: P[] = [
  { id: 1, name: 'Ana', at: new Date(2024, 2, 5, 14, 30) },
  { id: 2, name: 'Bia', at: new Date(2024, 2, 6, 9, 5) },
]
const cell = (i: number, field: string) => document.querySelector<HTMLElement>(`.gk-row[data-rowindex="${i}"] .gk-cell[data-field="${field}"]`)!

describe('dateTime columns', () => {
  const columns: UIColumnDef<P>[] = [
    { field: 'name', headerName: 'Name', width: 100 },
    { field: 'at', headerName: 'At', type: 'dateTime', width: 160, editable: true },
  ]

  it('show the date and the time, in the grid\'s locale', () => {
    render(<Grid<P> rows={rows} columns={columns} locale="en-US" />)
    expect(cell(0, 'at').textContent).toMatch(/3\/5\/24,?\s+2:30\s?PM/)
    cleanup()
    render(<Grid<P> rows={rows} columns={columns} {...ptBR} />)
    expect(cell(0, 'at').textContent).toMatch(/05\/03\/2024,? 14:30/)
  })

  it('are edited with a date-time input, and the typed value becomes a Date', async () => {
    let api!: GridApi<P>
    render(<Grid<P> rows={rows} columns={columns} getRowId={(r) => r.id} onReady={(a) => (api = a)} processRowUpdate={(n) => n} />)
    fireEvent.doubleClick(cell(1, 'at'))
    const input = document.querySelector<HTMLInputElement>('.gk-editor')!
    expect(input.type).toBe('datetime-local')
    expect(input.value).toBe('2024-03-06T09:05')
    fireEvent.change(input, { target: { value: '2024-03-07T18:45' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(api.getCsv().split('\n')[2]).toContain('2024-03-07T18:45:00')
  })

  it('are filtered with a date-time input and compared with the time', () => {
    render(<Grid<P> rows={rows} columns={columns} toolbar />)
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const panel = within(screen.getByRole('dialog'))
    fireEvent.change(panel.getByLabelText('Column'), { target: { value: 'at' } })
    const value = panel.getByLabelText('Value') as HTMLInputElement
    expect(value.type).toBe('datetime-local')
    fireEvent.change(panel.getByLabelText('Operator'), { target: { value: 'gt' } })
    fireEvent.change(value, { target: { value: '2024-03-05T20:00' } })
    expect([...document.querySelectorAll('.gk-row[data-rowindex] .gk-cell[data-field="name"]')].map((c) => c.textContent)).toEqual(['Bia'])
  })

  it('copy and paste as local date-time text', () => {
    const col = columns[1]!
    expect(cellToText(col, rows[0]!)).toBe('2024-03-05T14:30')
    const parsed = parseCellText(col, '2024-03-05 14:30', rows[0]!)
    expect(parsed.ok && (parsed.value as Date).getTime()).toBe(new Date(2024, 2, 5, 14, 30).getTime())
    expect(parseDateTimeInput('2024-13-40')).not.toBeNull() // JS rolls the month over; garbage text is what fails
    expect(parseDateTimeInput('nope')).toBeNull()
    expect(formatDateTimeInput(new Date(2024, 0, 2, 3, 4))).toBe('2024-01-02T03:04')
  })
})

describe('actions columns', () => {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  const columns: UIColumnDef<P>[] = [
    { field: 'name', headerName: 'Name', width: 100 },
    {
      field: 'actions',
      headerName: 'Actions',
      type: 'actions',
      width: 120,
      getActions: ({ row }) => [
        { label: `Edit ${row.name}`, icon: '✎', onClick: () => onEdit(row.id) },
        { label: 'Delete', showInMenu: true, onClick: () => onDelete(row.id) },
        { label: 'Locked', showInMenu: true, disabled: true },
      ],
    },
  ]

  it('draw the buttons of each row, and call them with the row', () => {
    render(<Grid<P> rows={rows} columns={columns} getRowId={(r) => r.id} />)
    fireEvent.click(within(cell(1, 'actions')).getByRole('button', { name: 'Edit Bia' }))
    expect(onEdit).toHaveBeenCalledWith(2)
  })

  it('put showInMenu actions in a ⋮ menu that closes after one is chosen', () => {
    render(<Grid<P> rows={rows} columns={columns} getRowId={(r) => r.id} />)
    fireEvent.click(within(cell(0, 'actions')).getByRole('button', { name: 'More actions' }))
    const menu = within(screen.getByRole('menu', { name: 'More actions' }))
    expect(menu.getByRole('menuitem', { name: 'Locked' })).toHaveProperty('disabled', true)
    fireEvent.click(menu.getByRole('menuitem', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('cannot be sorted, filtered or exported, and the pack translates the menu button', () => {
    let api!: GridApi<P>
    render(<Grid<P> rows={rows} columns={columns} toolbar onReady={(a) => (api = a)} {...ptBR} />)
    expect(document.querySelector('.gk-header-cell[data-field="actions"]')!.getAttribute('aria-sort')).toBeNull()
    expect(api.getCsv()).not.toContain('Actions')
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    const options = [...(within(screen.getByRole('dialog')).getByLabelText('Coluna') as HTMLSelectElement).options].map((o) => o.textContent)
    expect(options).toEqual(['Name'])
    expect(within(cell(0, 'actions')).getByRole('button', { name: 'Mais ações' })).toBeTruthy()
  })
})
