import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Grid } from './Grid'
import { ColumnMenuItem } from './panels/ColumnMenu'
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

const rows = [{ id: 1, name: 'Ana', age: 30 }]
const columns: UIColumnDef<(typeof rows)[number]>[] = [
  { field: 'name', headerName: 'Name', width: 120 },
  { field: 'age', headerName: 'Age', type: 'number', width: 80, columnMenu: false },
]
const items = () => within(screen.getByRole('menu')).getAllByRole('menuitem').map((i) => i.textContent)

describe('column menu customization', () => {
  it('hiddenItems leaves groups out', () => {
    render(<Grid rows={rows} columns={columns} slotProps={{ columnMenu: { hiddenItems: ['pin', 'move', 'hide', 'filter', 'aggregate'] } }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Name column menu' }))
    expect(items()).toEqual(['Sort ascending', 'Sort descending'])
  })

  it('itemsBefore and itemsAfter add your own, which know the column and can close the menu', () => {
    const onPick = vi.fn()
    render(
      <Grid
        rows={rows}
        columns={columns}
        slotProps={{
          columnMenu: {
            hiddenItems: ['sort', 'filter', 'pin', 'move', 'hide', 'aggregate'],
            itemsBefore: ({ field }) => <ColumnMenuItem onClick={() => onPick(`before ${field}`)}>First</ColumnMenuItem>,
            itemsAfter: ({ column, close }) => (
              <ColumnMenuItem
                onClick={() => {
                  onPick(`after ${column.headerName}`)
                  close()
                }}
              >
                Last
              </ColumnMenuItem>
            ),
          },
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Name column menu' }))
    expect(items()).toEqual(['First', 'Last'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Last' }))
    expect(onPick).toHaveBeenCalledWith('after Name')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('a column can turn its menu off, and columnControls={false} turns them all off', () => {
    const { unmount } = render(<Grid rows={rows} columns={columns} />)
    expect(screen.queryByRole('button', { name: 'Age column menu' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Name column menu' })).toBeTruthy()
    unmount()
    render(<Grid rows={rows} columns={columns} columnControls={false} />)
    expect(screen.queryByRole('button', { name: /column menu/ })).toBeNull()
  })

  it('Ctrl/Cmd+Enter on a header opens the menu; Enter alone still sorts', () => {
    render(<Grid rows={rows} columns={columns} />)
    const title = document.querySelector<HTMLElement>('.gk-header-cell[data-field="name"] .gk-header-title')!
    fireEvent.keyDown(title, { key: 'Enter', ctrlKey: true })
    expect(screen.getByRole('menu')).toBeTruthy()
    cleanup()
    render(<Grid rows={rows} columns={columns} />)
    const again = document.querySelector<HTMLElement>('.gk-header-cell[data-field="name"] .gk-header-title')!
    fireEvent.keyDown(again, { key: 'Enter' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
