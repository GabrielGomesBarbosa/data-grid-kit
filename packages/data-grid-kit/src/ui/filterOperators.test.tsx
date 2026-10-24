import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Grid } from './Grid'
import type { UIColumnDef } from './types'
import { getFilterOperators } from '../core'
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
  age: number
}
const rows: P[] = [
  { id: 1, name: 'José', age: 20 },
  { id: 2, name: 'Jose', age: 40 },
  { id: 3, name: 'Ana', age: 60 },
]
const names = () => [...document.querySelectorAll('.gk-row[data-rowindex] .gk-cell[data-field="name"]')].map((c) => c.textContent)

describe('filters in the grid', () => {
  it('ignoreDiacritics: the quick filter finds both spellings', () => {
    const cols: UIColumnDef<P>[] = [{ field: 'name', headerName: 'Name', width: 120 }]
    render(<Grid<P> rows={rows} columns={cols} toolbar ignoreDiacritics />)
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    fireEvent.change(screen.getByLabelText('Quick filter'), { target: { value: 'josé' } })
    expect(names()).toEqual(['José', 'Jose'])
  })

  it('the new operators are in the panel, in the pack\'s language, and "is any of" takes a list', () => {
    const cols: UIColumnDef<P>[] = [{ field: 'name', headerName: 'Name', width: 120 }]
    render(<Grid<P> rows={rows} columns={cols} toolbar {...ptBR} />)
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    const panel = within(screen.getByRole('dialog'))
    const operator = panel.getByLabelText('Operador')
    expect([...(operator as HTMLSelectElement).options].map((o) => o.textContent)).toContain('não contém')
    fireEvent.change(operator, { target: { value: 'isAnyOf' } })
    fireEvent.change(panel.getByPlaceholderText('a, b, c'), { target: { value: 'ana' } })
    expect(names()).toEqual(['Ana'])
  })

  it('a column\'s own operator brings its own input', () => {
    const cols: UIColumnDef<P>[] = [
      {
        field: 'age',
        headerName: 'Age',
        type: 'number',
        width: 100,
        filterOperators: [
          ...getFilterOperators({ type: 'number' }).filter((o) => o.value === 'equals'),
          {
            value: 'adult',
            label: 'is adult?',
            renderInput: ({ onChange, focusProps }) => <button {...focusProps} onClick={() => onChange(30)}>pick 30</button>,
            getApplyFilterFn: (item) => (item.value === undefined || item.value === '' ? null : (v) => Number(v) >= Number(item.value)),
          },
        ],
      },
      { field: 'name', headerName: 'Name', width: 120 },
    ]
    render(<Grid<P> rows={rows} columns={cols} toolbar />)
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const panel = within(screen.getByRole('dialog'))
    fireEvent.change(panel.getByLabelText('Operator'), { target: { value: 'adult' } })
    expect(names()).toEqual(['José', 'Jose', 'Ana']) // not complete yet: nothing is filtered
    fireEvent.click(panel.getByText('pick 30'))
    expect(names()).toEqual(['Jose', 'Ana'])
    expect(screen.getByRole('button', { name: 'Filters, 1 active' })).toBeTruthy()
  })
})
