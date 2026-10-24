import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Grid } from './Grid'
import type { UIColumnDef } from './types'
import type { GridApi } from '../core'

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
  team: string
}
const rows: P[] = [
  { id: 1, name: 'Ana', age: 30, team: 'Data' },
  { id: 2, name: 'Bia', age: 41, team: 'Design' },
]
const base: UIColumnDef<P>[] = [
  { field: 'name', headerName: 'Name', width: 120, editable: true },
  { field: 'age', headerName: 'Age', type: 'number', width: 80, editable: true },
  { field: 'team', headerName: 'Team', type: 'singleSelect', valueOptions: ['Data', 'Design'], width: 100, editable: true },
  { field: 'id', headerName: 'Id', width: 60 },
]
const cell = (i: number, field: string) => document.querySelector<HTMLElement>(`.gk-row[data-rowindex="${i}"] .gk-cell[data-field="${field}"]`)!
const editors = () => [...document.querySelectorAll<HTMLElement>('.gk-row [data-editing]')].map((c) => c.dataset.field ?? c.closest<HTMLElement>('.gk-cell')?.dataset.field)
const input = (i: number, field: string) => cell(i, field).querySelector<HTMLInputElement>('input, select')!
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 20))))

describe("editMode: 'row'", () => {
  it('opens an editor in every editable cell of the row and saves them together with Enter', async () => {
    const processRowUpdate = vi.fn((next: P) => next)
    render(<Grid<P> rows={rows} columns={base} getRowId={(r) => r.id} editMode="row" processRowUpdate={processRowUpdate} />)
    fireEvent.doubleClick(cell(0, 'age'))
    expect(editors()).toEqual(['name', 'age', 'team']) // the Id column is not editable
    expect(cell(1, 'name').querySelector('input')).toBeNull() // other rows are not
    expect(document.activeElement).toBe(input(0, 'age')) // the one that was clicked has the focus
    fireEvent.change(input(0, 'name'), { target: { value: 'Ana Maria' } })
    fireEvent.change(input(0, 'age'), { target: { value: '31' } })
    fireEvent.change(input(0, 'team'), { target: { value: 'Design' } })
    await act(async () => {
      fireEvent.keyDown(input(0, 'age'), { key: 'Enter' })
    })
    await settle()
    expect(processRowUpdate).toHaveBeenCalledTimes(1)
    expect(processRowUpdate.mock.calls[0]![0]).toEqual({ id: 1, name: 'Ana Maria', age: 31, team: 'Design' })
    expect(editors()).toEqual([])
    expect(cell(0, 'name').textContent).toBe('Ana Maria')
  })

  it('Escape throws the changes away; Tab inside the row does not save it', async () => {
    const processRowUpdate = vi.fn((next: P) => next)
    render(<Grid<P> rows={rows} columns={base} getRowId={(r) => r.id} editMode="row" processRowUpdate={processRowUpdate} />)
    fireEvent.doubleClick(cell(0, 'name'))
    fireEvent.change(input(0, 'name'), { target: { value: 'Changed' } })
    fireEvent.keyDown(input(0, 'name'), { key: 'Tab' })
    fireEvent.blur(input(0, 'name'))
    expect(editors()).toEqual(['name', 'age', 'team'])
    fireEvent.keyDown(input(0, 'age'), { key: 'Escape' })
    await settle()
    expect(editors()).toEqual([])
    expect(processRowUpdate).not.toHaveBeenCalled()
    expect(cell(0, 'name').textContent).toBe('Ana')
  })

  it('a click outside the row saves it, a click inside does not', async () => {
    const processRowUpdate = vi.fn((next: P) => next)
    render(<Grid<P> rows={rows} columns={base} getRowId={(r) => r.id} editMode="row" processRowUpdate={processRowUpdate} />)
    fireEvent.doubleClick(cell(0, 'name'))
    fireEvent.change(input(0, 'name'), { target: { value: 'Changed' } })
    fireEvent.pointerDown(cell(0, 'id'))
    await settle()
    expect(processRowUpdate).not.toHaveBeenCalled()
    fireEvent.pointerDown(cell(1, 'name'))
    await settle()
    expect(processRowUpdate).toHaveBeenCalledTimes(1)
    expect(editors()).toEqual([])
  })

  it('a row with nothing editable does not open', () => {
    render(<Grid<P> rows={rows} columns={base} getRowId={(r) => r.id} editMode="row" isCellEditable={() => false} />)
    fireEvent.doubleClick(cell(0, 'name'))
    expect(editors()).toEqual([])
  })
})

describe('validate', () => {
  const columns: UIColumnDef<P>[] = [
    { field: 'name', headerName: 'Name', width: 120, editable: true, validate: ({ value }) => (String(value).trim() === '' ? 'A name is required' : null) },
    { field: 'age', headerName: 'Age', type: 'number', width: 80, editable: true, validate: async ({ value }) => ((value as number) < 18 ? 'Must be an adult' : undefined) },
  ]

  it('in a cell: a refused value is not saved, the editor shows the message, and a good one goes through', async () => {
    const processRowUpdate = vi.fn((next: P) => next)
    render(<Grid<P> rows={rows} columns={columns} getRowId={(r) => r.id} processRowUpdate={processRowUpdate} />)
    fireEvent.doubleClick(cell(0, 'name'))
    fireEvent.change(input(0, 'name'), { target: { value: ' ' } })
    await settle()
    expect(input(0, 'name').getAttribute('aria-invalid')).toBe('true')
    expect(input(0, 'name').title).toBe('A name is required')
    await act(async () => {
      fireEvent.keyDown(input(0, 'name'), { key: 'Enter' })
    })
    expect(processRowUpdate).not.toHaveBeenCalled()
    expect(editors()).toEqual(['name'])
    fireEvent.change(input(0, 'name'), { target: { value: 'Ana B' } })
    await settle()
    expect(input(0, 'name').getAttribute('aria-invalid')).toBeNull()
    await act(async () => {
      fireEvent.keyDown(input(0, 'name'), { key: 'Enter' })
    })
    await settle()
    expect(processRowUpdate).toHaveBeenCalledTimes(1)
  })

  it('in a row: every cell is checked, async checks included, and the row stays open until all pass', async () => {
    const processRowUpdate = vi.fn((next: P) => next)
    render(<Grid<P> rows={rows} columns={columns} getRowId={(r) => r.id} editMode="row" processRowUpdate={processRowUpdate} />)
    fireEvent.doubleClick(cell(0, 'name'))
    fireEvent.change(input(0, 'age'), { target: { value: '12' } })
    await act(async () => {
      fireEvent.keyDown(input(0, 'age'), { key: 'Enter' })
    })
    await settle()
    expect(processRowUpdate).not.toHaveBeenCalled()
    expect(input(0, 'age').getAttribute('aria-invalid')).toBe('true')
    expect(input(0, 'age').title).toBe('Must be an adult')
    expect(input(0, 'name').getAttribute('aria-invalid')).toBeNull()
    fireEvent.change(input(0, 'age'), { target: { value: '19' } })
    await settle()
    await act(async () => {
      fireEvent.keyDown(input(0, 'age'), { key: 'Enter' })
    })
    await settle()
    expect(processRowUpdate).toHaveBeenCalledTimes(1)
    expect(processRowUpdate.mock.calls[0]![0].age).toBe(19)
  })

  it('a validate that throws refuses with the error message', async () => {
    const throwing: UIColumnDef<P>[] = [{ field: 'name', headerName: 'Name', width: 120, editable: true, validate: () => { throw new Error('nope') } }]
    render(<Grid<P> rows={rows} columns={throwing} getRowId={(r) => r.id} />)
    fireEvent.doubleClick(cell(0, 'name'))
    fireEvent.change(input(0, 'name'), { target: { value: 'x' } })
    await settle()
    expect(input(0, 'name').title).toBe('nope')
  })
})

describe('edit events', () => {
  it('onCellEditStart can stop an edit; onCellEditStop says why it ended and can keep it open', async () => {
    const stops: string[] = []
    let veto = true
    let api!: GridApi<P>
    render(
      <Grid<P>
        rows={rows}
        columns={base}
        getRowId={(r) => r.id}
        onReady={(a) => (api = a)}
        onCellEditStart={({ id }) => (id === 2 ? false : undefined)}
        onCellEditStop={({ reason, cancelled }) => {
          stops.push(`${reason}${cancelled ? ':cancelled' : ''}`)
          return veto ? false : undefined
        }}
      />,
    )
    fireEvent.doubleClick(cell(1, 'name'))
    expect(editors()).toEqual([]) // refused to start
    fireEvent.doubleClick(cell(0, 'name'))
    expect(editors()).toEqual(['name'])
    await act(async () => {
      fireEvent.keyDown(input(0, 'name'), { key: 'Enter' })
    })
    expect(stops).toEqual(['enter'])
    expect(editors()).toEqual(['name']) // vetoed: still editing
    veto = false
    fireEvent.keyDown(input(0, 'name'), { key: 'Escape' })
    expect(stops).toEqual(['enter', 'escape:cancelled'])
    expect(editors()).toEqual([])
    act(() => void api.startEdit(1, 'name'))
    await act(async () => void (await api.commitEdit('Ann')))
    expect(stops.at(-1)).toBe('api')
  })

  it('onRowEditStart / onRowEditStop do the same for a row', async () => {
    const log: string[] = []
    render(
      <Grid<P>
        rows={rows}
        columns={base}
        getRowId={(r) => r.id}
        editMode="row"
        onRowEditStart={({ id }) => {
          log.push(`start ${id}`)
        }}
        onRowEditStop={({ id, reason, cancelled }) => {
          log.push(`stop ${id} ${reason} ${cancelled}`)
        }}
      />,
    )
    fireEvent.doubleClick(cell(1, 'age'))
    fireEvent.keyDown(input(1, 'age'), { key: 'Escape' })
    await settle()
    expect(log).toEqual(['start 2', 'stop 2 escape true'])
  })
})
