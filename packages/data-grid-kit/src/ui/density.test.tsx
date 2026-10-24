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

const rows = [{ id: 1, name: 'Ana' }]
const columns: UIColumnDef<{ id: number; name: string }>[] = [{ field: 'name', headerName: 'Name', width: 100 }]
const rowHeight = () => document.querySelector<HTMLElement>('.gk-row[data-rowindex="0"]')!.style.height
const headerHeight = () => document.querySelector<HTMLElement>('.gk-header')?.style.height ?? ''

describe('density', () => {
  it('standard is the default size; compact and comfortable scale the rows and the header', () => {
    const { unmount } = render(<Grid rows={rows} columns={columns} rowHeight={40} />)
    expect(rowHeight()).toBe('40px')
    unmount()
    render(<Grid rows={rows} columns={columns} rowHeight={40} initialState={{ density: 'compact' }} />)
    expect(rowHeight()).toBe('30px')
    cleanup()
    render(<Grid rows={rows} columns={columns} rowHeight={40} initialState={{ density: 'comfortable' }} />)
    expect(rowHeight()).toBe('52px')
    expect(headerHeight()).not.toBe('')
  })

  it('the toolbar button (densitySelector) opens a menu that changes it', () => {
    render(<Grid rows={rows} columns={columns} rowHeight={40} toolbar densitySelector />)
    fireEvent.click(screen.getByRole('button', { name: 'Density' }))
    expect(screen.getByRole('menuitemradio', { name: /Standard/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Compact/ }))
    expect(rowHeight()).toBe('30px')
    fireEvent.click(screen.getByRole('button', { name: 'Density' }))
    expect(screen.getByRole('menuitemradio', { name: /Compact/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('no button unless asked for, and it speaks the pack\'s language', () => {
    const { unmount } = render(<Grid rows={rows} columns={columns} toolbar />)
    expect(screen.queryByRole('button', { name: 'Density' })).toBeNull()
    unmount()
    render(<Grid rows={rows} columns={columns} toolbar densitySelector {...ptBR} />)
    fireEvent.click(screen.getByRole('button', { name: 'Densidade' }))
    expect(screen.getByRole('menuitemradio', { name: /Compacta/ })).toBeTruthy()
  })
})

describe('no results', () => {
  const data = [{ id: 1, name: 'Ana' }]
  it('a filter that matches nothing says so, apart from an empty grid', () => {
    const { unmount } = render(<Grid rows={[]} columns={columns} />)
    expect(screen.getByText('No rows')).toBeTruthy()
    unmount()
    render(<Grid rows={data} columns={columns} initialState={{ filterModel: { items: [], quickFilter: 'zzz' } }} />)
    expect(screen.getByText('No results found.')).toBeTruthy()
    expect(screen.queryByText('No rows')).toBeNull()
  })

  it('a filter row nothing was typed into does not count, and the slot can be replaced', () => {
    const { unmount } = render(<Grid rows={[]} columns={columns} initialState={{ filterModel: { items: [{ field: 'name', operator: 'contains', value: '' }] } }} />)
    expect(screen.getByText('No rows')).toBeTruthy()
    unmount()
    render(<Grid rows={data} columns={columns} initialState={{ filterModel: { items: [], quickFilter: 'zzz' } }} slots={{ noResultsOverlay: () => <p>Nothing here</p> }} />)
    expect(screen.getByText('Nothing here')).toBeTruthy()
  })
})
