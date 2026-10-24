import { readdirSync, readFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Grid } from './Grid'
import type { UIColumnDef } from './types'
import { defaultLocaleText, formatDate, formatNumber, resolveLocaleText } from '../core'
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
  amount: number
  day: Date
}
const rows: P[] = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}`, amount: 1234.5 * (i + 1), day: new Date(2024, 2, 5 + i) }))
const columns: UIColumnDef<P>[] = [
  { field: 'name', headerName: 'Name', width: 120 },
  { field: 'amount', headerName: 'Amount', type: 'number', width: 100 },
  { field: 'day', headerName: 'Day', type: 'date', width: 100 },
]

describe('the dictionary', () => {
  it('the Portuguese pack has every key the English dictionary has, with the same kind of value', () => {
    expect(Object.keys(ptBR.localeText).sort()).toEqual(Object.keys(defaultLocaleText).sort())
    for (const key of Object.keys(defaultLocaleText) as (keyof typeof defaultLocaleText)[]) {
      expect(typeof ptBR.localeText[key], key).toBe(typeof defaultLocaleText[key])
    }
  })

  it('what is not overridden stays in English, and an undefined key does not erase it', () => {
    const text = resolveLocaleText({ noRows: 'Nada', toolbarColumns: undefined })
    expect(text.noRows).toBe('Nada')
    expect(text.toolbarColumns).toBe('Columns')
    expect(resolveLocaleText()).toBe(defaultLocaleText)
  })

  it('no text is written into a component: labels, titles and placeholders come from the dictionary', () => {
    const files = ['.', 'panels'].flatMap((dir) =>
      readdirSync(new URL(dir === '.' ? '.' : `./${dir}/`, import.meta.url))
        .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
        .map((f) => new URL(dir === '.' ? f : `${dir}/${f}`, import.meta.url)),
    )
    const found: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/\b(aria-label|title|placeholder)="([^"]+)"/g)) found.push(`${file.pathname.split('/ui/')[1]}: ${m[1]}="${m[2]}"`)
    }
    expect(found).toEqual([])
  })
})

describe('numbers and dates', () => {
  it('are written in the given locale', () => {
    expect(formatNumber(1234.5, 'de-DE')).toBe('1.234,5')
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5')
    expect(formatDate(new Date(2024, 2, 5), 'en-US')).toBe('3/5/2024')
    expect(formatDate(new Date(2024, 2, 5), 'pt-BR')).toBe('05/03/2024')
    expect(formatDate(new Date('nope'), 'pt-BR')).toBe('Invalid Date')
  })
})

describe('a grid with its own texts', () => {
  const portuguese = (extra?: object) => render(<Grid<P> rows={rows} columns={columns} toolbar {...ptBR} {...extra} />)

  it('is in English by default', () => {
    render(<Grid<P> rows={rows} columns={columns} toolbar />)
    expect(screen.getByRole('button', { name: 'Columns' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(screen.getByText('4 rows')).toBeTruthy()
  })

  it('writes the toolbar, the footer and the column menu in the pack\'s language', () => {
    portuguese()
    expect(screen.getByRole('button', { name: 'Colunas' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filtros' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeTruthy()
    expect(screen.getByRole('toolbar', { name: 'Barra de ferramentas da tabela' })).toBeTruthy()
    expect(screen.getByText('4 linhas')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Menu da coluna Name' }))
    const menu = within(screen.getByRole('menu', { name: 'Menu da coluna' }))
    expect(menu.getByRole('menuitem', { name: 'Ordenar crescente' })).toBeTruthy()
    expect(menu.getByRole('menuitem', { name: 'Ocultar coluna' })).toBeTruthy()
  })

  it('translates the panels, the operators and the empty filter row', () => {
    portuguese()
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    const panel = within(screen.getByRole('dialog', { name: 'Filtros' }))
    expect(panel.getByText('Onde')).toBeTruthy()
    expect(panel.getByRole('option', { name: 'contém' })).toBeTruthy()
    expect(panel.getByRole('button', { name: /Adicionar filtro/ })).toBeTruthy()
  })

  it('writes numbers and dates in the pack\'s locale', () => {
    portuguese({ initialState: { aggregationModel: { amount: 'sum' } } })
    expect(screen.getByText('05/03/2024')).toBeTruthy() // a date cell
    expect(screen.getByText('12.345')).toBeTruthy() // the total row
  })

  it('one key can be changed on its own, and a function key gets its numbers', () => {
    render(<Grid<P> rows={rows} columns={columns} toolbar localeText={{ toolbarColumns: 'Spalten', footerRows: (n) => `${n} Zeilen` }} />)
    expect(screen.getByRole('button', { name: 'Spalten' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
    expect(screen.getByText('4 Zeilen')).toBeTruthy()
  })

  it('changing a key replaces the English text everywhere it was used', () => {
    render(<Grid<P> rows={rows} columns={columns} toolbar localeText={{ toolbarColumns: 'Spalten' }} />)
    expect(screen.queryByRole('button', { name: 'Columns' })).toBeNull()
  })

  it('writes the generated pivot columns in the pack\'s language', () => {
    render(
      <Grid<P>
        rows={rows}
        columns={[{ field: 'name', headerName: 'Name' }, { field: 'amount', headerName: 'Amount', type: 'number' }, { field: 'day', headerName: 'Day', type: 'date' }]}
        pivoting
        pivotTotals
        initialState={{ pivotMode: true, pivotModel: { rows: ['name'], columns: [], values: [{ field: 'amount', aggFunc: 'sum' }] } }}
        {...ptBR}
      />,
    )
    const titles = [...document.querySelectorAll('.gk-header-label')].map((h) => h.textContent)
    expect(titles).toContain('Amount (soma)')
  })
})
