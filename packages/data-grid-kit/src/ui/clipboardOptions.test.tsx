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
  a: number
  b: number
  label: string
}
const rows = (): P[] => [
  { id: 1, a: 1, b: 10, label: 'x' },
  { id: 2, a: 2, b: 10, label: 'y' },
  { id: 3, a: 0, b: 0, label: '' },
  { id: 4, a: 0, b: 0, label: '' },
]
const columns: UIColumnDef<P>[] = [
  { field: 'a', headerName: 'A', type: 'number', width: 70, editable: true },
  { field: 'b', headerName: 'B', type: 'number', width: 70, editable: true },
  { field: 'label', headerName: 'L', width: 70, editable: true },
]
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 20))))
const text = (i: number, field: string) => document.querySelector<HTMLElement>(`.gk-row[data-rowindex="${i}"] .gk-cell[data-field="${field}"]`)!.textContent

function setup(extra: object = {}) {
  let api!: GridApi<P>
  let data = rows()
  const view = render(<Grid<P> rows={data} columns={columns} getRowId={(r) => r.id} cellSelection processRowUpdate={(n) => n} onReady={(a) => (api = a)} {...extra} />)
  return { api, view, data }
}
const select = (api: GridApi<P>, from: [number, string], to: [number, string]) =>
  act(() => {
    api.focusCell({ rowId: from[0], field: from[1] }) // the keys go to the focused cell
    api.selectCells({ anchor: { rowId: from[0], field: from[1] }, focus: { rowId: to[0], field: to[1] } })
  })

describe('paste events and options', () => {
  it('onBeforeClipboardPasteStart can cancel a paste, even after asking (a promise)', async () => {
    let allow = false
    const ended = vi.fn()
    const { api } = setup({ onBeforeClipboardPasteStart: async () => allow, onClipboardPasteEnd: ended })
    act(() => api.focusCell({ rowId: 3, field: 'a' }))
    await act(async () => void (await api.pasteText('7')))
    expect(text(2, 'a')).toBe('0')
    expect(ended).not.toHaveBeenCalled()
    allow = true
    await act(async () => void (await api.pasteText('7')))
    await settle()
    expect(text(2, 'a')).toBe('7')
    expect(ended).toHaveBeenCalledWith({ applied: 1, skipped: 0, rejected: 0 })
  })

  it('onClipboardPasteStart gets the text and the rows of cells the before-hook sees', async () => {
    const start = vi.fn()
    const before = vi.fn()
    const { api } = setup({ onClipboardPasteStart: start, onBeforeClipboardPasteStart: before })
    act(() => api.focusCell({ rowId: 3, field: 'a' }))
    await act(async () => void (await api.pasteText('1\t2\n3\t4')))
    expect(before).toHaveBeenCalledWith({ text: '1\t2\n3\t4', rows: [['1', '2'], ['3', '4']] })
    expect(start).toHaveBeenCalledWith({ text: '1\t2\n3\t4' })
  })

  it('disableClipboardPaste turns pasting off', async () => {
    const { api } = setup({ disableClipboardPaste: true })
    act(() => api.focusCell({ rowId: 3, field: 'a' }))
    await act(async () => void (await api.pasteText('9')))
    await settle()
    expect(text(2, 'a')).toBe('0')
  })

  it('onClipboardCopy gets the copied text', () => {
    const copied = vi.fn()
    const { api } = setup({ onClipboardCopy: copied })
    select(api, [1, 'a'], [2, 'b'])
    const data = { setData: vi.fn() }
    fireEvent.copy(document.querySelector('.gk-scroller')!, { clipboardData: data })
    expect(copied).toHaveBeenCalledWith('1\t10\n2\t10')
  })
})

describe('fill', () => {
  it('with fillSeries, numbers a constant step apart continue as a series and anything else repeats', async () => {
    const { api } = setup({ fillSeries: true })
    await act(async () => void (await api.fillCells({ r0: 0, r1: 1, c0: 0, c1: 2 }, { row: 3, col: 2 })))
    await settle()
    expect([0, 1, 2, 3].map((i) => text(i, 'a'))).toEqual(['1', '2', '3', '4']) // 1, 2 → 3, 4
    expect([0, 1, 2, 3].map((i) => text(i, 'b'))).toEqual(['10', '10', '10', '10']) // a step of 0 is a series of tens
    expect([0, 1, 2, 3].map((i) => text(i, 'label'))).toEqual(['x', 'y', 'x', 'y']) // text repeats
  })

  it('without it a fill repeats, and a single cell repeats whatever the option', async () => {
    const { api } = setup()
    await act(async () => void (await api.fillCells({ r0: 0, r1: 1, c0: 0, c1: 0 }, { row: 3, col: 0 })))
    await settle()
    expect([0, 1, 2, 3].map((i) => text(i, 'a'))).toEqual(['1', '2', '1', '2'])
  })

  it('a single cell repeats (no step to continue)', async () => {
    const { api } = setup({ fillSeries: true })
    await act(async () => void (await api.fillCells({ r0: 0, r1: 0, c0: 0, c1: 0 }, { row: 2, col: 0 })))
    await settle()
    expect([0, 1, 2].map((i) => text(i, 'a'))).toEqual(['1', '1', '1'])
  })

  it('Ctrl+D fills the selection down from its first row, Ctrl+R to the right from its first column, and never as a series', async () => {
    const { api } = setup()
    select(api, [1, 'a'], [4, 'a'])
    await act(async () => {
      fireEvent.keyDown(document.querySelector('.gk-scroller')!, { key: 'd', ctrlKey: true })
    })
    await settle()
    expect([0, 1, 2, 3].map((i) => text(i, 'a'))).toEqual(['1', '1', '1', '1'])
    select(api, [1, 'a'], [1, 'b'])
    await act(async () => {
      fireEvent.keyDown(document.querySelector('.gk-scroller')!, { key: 'r', metaKey: true })
    })
    await settle()
    expect(text(0, 'b')).toBe('1')
  })

  it('Ctrl+D on one cell copies the one above', async () => {
    const { api } = setup()
    select(api, [3, 'label'], [3, 'label'])
    await act(async () => {
      fireEvent.keyDown(document.querySelector('.gk-scroller')!, { key: 'd', ctrlKey: true })
    })
    await settle()
    expect(text(2, 'label')).toBe('y')
  })
})
