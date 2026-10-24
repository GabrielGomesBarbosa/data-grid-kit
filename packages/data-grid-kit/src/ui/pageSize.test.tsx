import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Grid } from './Grid'
import type { UIColumnDef } from './types'
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

const rows = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }))
const columns: UIColumnDef<{ id: number; name: string }>[] = [{ field: 'name', headerName: 'Name', width: 100 }]
const pageText = () => document.querySelector('.gk-pager > span')!.textContent

describe('rows per page', () => {
  it('has no select unless pageSizeOptions is given', () => {
    render(<Grid rows={rows} columns={columns} />)
    expect(screen.queryByLabelText('Rows per page')).toBeNull()
  })

  it('a select with the options (and the current size) changes the page size', () => {
    render(<Grid rows={rows} columns={columns} pageSizeOptions={[25, 50, 100]} initialState={{ paginationModel: { page: 0, pageSize: 25 } }} />)
    const select = screen.getByLabelText('Rows per page') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['25', '50', '100'])
    expect(pageText()).toContain('1 / 5')
    fireEvent.change(select, { target: { value: '50' } })
    expect(pageText()).toContain('1 / 3')
  })

  it('-1 shows every row on one page, and a size that is not in the list is still listed', () => {
    render(<Grid rows={rows} columns={columns} pageSizeOptions={[25, -1]} initialState={{ paginationModel: { page: 0, pageSize: 40 } }} />)
    const select = screen.getByLabelText('Rows per page') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['25', '40', 'All'])
    fireEvent.change(select, { target: { value: '-1' } })
    expect(pageText()).toContain('1 / 1')
    expect(select.value).toBe('-1')
  })

  it('speaks the pack\'s language', () => {
    render(<Grid rows={rows} columns={columns} pageSizeOptions={[25, -1]} {...ptBR} />)
    expect(screen.getByLabelText('Linhas por página')).toBeTruthy()
  })

  it('autoPageSize fits the page to the height of the grid', () => {
    render(<Grid rows={rows} columns={columns} autoPageSize rowHeight={30} />)
    // 400 high: the header, and about a row for the footer, leave room for some rows, and more than one page of 120 rows is left
    const pages = Number(pageText()!.match(/\/ (\d+)/)![1])
    expect(pages).toBeGreaterThan(5)
    expect(pages).toBeLessThan(40)
  })
})
