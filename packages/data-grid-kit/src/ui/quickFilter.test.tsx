import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Grid } from './Grid'
import { QuickFilter, Toolbar, useToolbar } from './toolbarParts'
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

const rows = [
  { id: 1, name: 'Ana' },
  { id: 2, name: 'Bia' },
]
const columns: UIColumnDef<(typeof rows)[number]>[] = [{ field: 'name', headerName: 'Name', width: 100 }]
const names = () => [...document.querySelectorAll('.gk-row[data-rowindex] .gk-cell')].map((c) => c.textContent)

function Bar({ debounceMs }: { debounceMs?: number }) {
  void useToolbar
  return (
    <Toolbar>
      <QuickFilter defaultExpanded debounceMs={debounceMs} />
    </Toolbar>
  )
}
const wait = (ms: number) => act(async () => void (await new Promise((r) => setTimeout(r, ms))))

describe('quick filter box', () => {
  it('filters at once without a delay', () => {
    render(<Grid rows={rows} columns={columns} toolbar slots={{ toolbar: Bar as never }} />)
    fireEvent.change(screen.getByLabelText('Quick filter'), { target: { value: 'ana' } })
    expect(names()).toEqual(['Ana'])
  })

  it('with debounceMs the box shows what is typed at once and the rows follow later', async () => {
    render(<Grid rows={rows} columns={columns} toolbar slots={{ toolbar: (() => <Bar debounceMs={60} />) as never }} />)
    const box = screen.getByLabelText('Quick filter') as HTMLInputElement
    fireEvent.change(box, { target: { value: 'ana' } })
    expect(box.value).toBe('ana')
    expect(names()).toEqual(['Ana', 'Bia'])
    await wait(120)
    expect(names()).toEqual(['Ana'])
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(box.value).toBe('')
    expect(names()).toEqual(['Ana', 'Bia'])
  })
})
