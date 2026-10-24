import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
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

const cols: UIColumnDef<{ id: number }>[] = [
  { field: 'id', headerName: 'Id', width: 100 },
  { field: 'a', headerName: 'A', flex: 1 },
  { field: 'b', headerName: 'B', flex: 3 },
]
const headerWidths = () => [...document.querySelectorAll<HTMLElement>('.gk-header-cell')].map((h) => h.style.width)

describe('flex columns in the grid', () => {
  it('fill the grid: the fixed column keeps its width, the others share the rest 1 : 3', () => {
    render(<Grid rows={[{ id: 1 }]} columns={cols} />)
    expect(headerWidths()).toEqual(['100px', '175px', '525px']) // 800 - 100 = 700
  })
})
