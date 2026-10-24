import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGrid } from './useGrid'
import type { ColumnDef, GridOptions } from './types'

interface Sale {
  id: number
  region: string
  rep: string
  amount: number | null
  day: Date
  ok: boolean
  kind: string
}

const rows: Sale[] = [
  { id: 1, region: 'N', rep: 'ana', amount: 100, day: new Date(2024, 0, 5), ok: true, kind: 'a' },
  { id: 2, region: 'N', rep: 'bia', amount: 50, day: new Date(2024, 4, 9), ok: false, kind: 'b' },
  { id: 3, region: 'S', rep: 'dani', amount: null, day: new Date(2023, 11, 20), ok: true, kind: 'a' },
  { id: 4, region: 'S', rep: 'edu', amount: 20.5, day: new Date(2024, 1, 2), ok: false, kind: 'zz' },
]
const columns: ColumnDef<Sale>[] = [
  { field: 'region', headerName: 'Region' },
  { field: 'rep', headerName: 'Rep' },
  { field: 'amount', headerName: 'Amount', type: 'number', valueFormatter: (v) => `$${v}` },
  { field: 'day', headerName: 'Day', type: 'date' },
  { field: 'ok', headerName: 'OK', type: 'boolean' },
  { field: 'kind', headerName: 'Kind', type: 'singleSelect', valueOptions: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
]
const opts = (over: Partial<GridOptions<Sale>> = {}): GridOptions<Sale> => ({ rows, columns, getRowId: (r) => r.id, pagination: false, ...over })

/** unzip the one worksheet and read it back as a { A1: value } map */
function readSheet(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = bytes.length - 22
  while (v.getUint32(eocd, true) !== 0x06054b50) eocd--
  let at = v.getUint32(eocd + 16, true)
  let xml = ''
  for (let i = 0; i < v.getUint16(eocd + 10, true); i++) {
    const method = v.getUint16(at + 10, true)
    const packed = v.getUint32(at + 20, true)
    const nameLen = v.getUint16(at + 28, true)
    const local = v.getUint32(at + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen))
    if (name === 'xl/worksheets/sheet1.xml') {
      const dataAt = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
      const body = bytes.subarray(dataAt, dataAt + packed)
      if (method !== 0) throw new Error('these tests export with compress: false')
      xml = new TextDecoder().decode(body)
    }
    at += 46 + nameLen
  }
  const cells: Record<string, string | number | boolean> = {}
  for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"(?: t="(\w+)")?[^>]*?(?:\/>|>(.*?)<\/c>)/g)) {
    const [, ref, t, inner] = m
    if (!inner) continue
    if (t === 'inlineStr') cells[ref!] = inner.match(/<t[^>]*>(.*?)<\/t>/)![1]!.replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    else if (t === 'b') cells[ref!] = inner.includes('<v>1</v>')
    else cells[ref!] = Number(inner.match(/<v>(.*?)<\/v>/)![1])
  }
  const levels = [...xml.matchAll(/<row r="(\d+)" outlineLevel="(\d)"/g)].map((m) => [Number(m[1]), Number(m[2])])
  return { xml, cells, levels }
}

describe('exporting the grid to xlsx', () => {
  it('flat grid: titles, typed cells, formatted text for strings and select labels', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    const { cells } = readSheet(await result.current.api.getXlsx({ compress: false }))
    expect([cells.A1, cells.B1, cells.C1, cells.D1, cells.E1, cells.F1]).toEqual(['Region', 'Rep', 'Amount', 'Day', 'OK', 'Kind'])
    expect(cells.A2).toBe('N')
    expect(cells.C2).toBe(100) // a number stays a number even though the grid formats it as $100
    expect(cells.C4).toBeUndefined() // null amount: empty cell
    expect(cells.C5).toBe(20.5)
    expect(cells.D2).toBe(45296) // the date, as a serial
    expect(cells.E2).toBe(true)
    expect(cells.E3).toBe(false)
    expect(cells.F2).toBe('Alpha') // singleSelect: the label
    expect(cells.F5).toBe('zz') // unknown option: the raw value
    expect(Object.keys(cells).some((k) => /^A6$/.test(k))).toBe(false)
  })

  it('`formatted` writes what the grid shows instead of typed cells', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    const { cells } = readSheet(await result.current.api.getXlsx({ compress: false, formatted: true }))
    expect(cells.C2).toBe('$100')
    expect(typeof cells.D2).toBe('string')
    expect(cells.E2).toBe('true')
  })

  it('follows sort, filter, hidden columns and column order', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => {
      result.current.api.setSortModel([{ field: 'rep', direction: 'desc' }])
      result.current.api.setColumnVisibility('day', false)
      result.current.api.setFilterModel({ items: [{ field: 'region', operator: 'equals', value: 'N' }] })
    })
    const { cells } = readSheet(await result.current.api.getXlsx({ compress: false }))
    expect([cells.A1, cells.B1, cells.C1, cells.D1]).toEqual(['Region', 'Rep', 'Amount', 'OK'])
    expect([cells.B2, cells.B3, cells.B4]).toEqual(['bia', 'ana', undefined])
  })

  it('selectedOnly, includeHeaders, sheet options and number formats', async () => {
    const { result } = renderHook(() => useGrid(opts()))
    act(() => result.current.api.toggleSelection(3, true))
    const { cells, xml } = readSheet(await result.current.api.getXlsx({ compress: false, selectedOnly: true, includeHeaders: false, numFmts: { amount: '0.0' } }))
    expect(cells.A1).toBe('S')
    expect(cells.B1).toBe('dani')
    expect(cells.A2).toBeUndefined()
    expect(xml).not.toContain('<pane')
  })

  it('grouped grid: every group row with its aggregates, leaves outlined below, and the total', async () => {
    const { result } = renderHook(() =>
      useGrid(opts({ initialState: { rowGroupingModel: ['region'], aggregationModel: { amount: 'sum' } } })),
    ) // groups collapsed on screen: the export has everything anyway
    const { cells, levels } = readSheet(await result.current.api.getXlsx({ compress: false }))
    expect([cells.A2, cells.C2]).toEqual(['N', 150]) // group row: label + sum
    expect([cells.B3, cells.C3]).toEqual(['ana', 100]) // its leaves
    expect([cells.A5, cells.C5]).toEqual(['S', 20.5])
    expect(cells.A8).toBe('Total')
    expect(cells.C8).toBe(170.5)
    expect(levels.filter(([, l]) => l === 1).map(([r]) => r)).toEqual([3, 4, 6, 7])
  })

  it('pivot table: column groups merged above the titles, group rows with the numbers', async () => {
    const { result } = renderHook(() =>
      useGrid(
        opts({
          pivoting: true,
          initialState: {
            pivotMode: true,
            pivotModel: { rows: ['region'], columns: [{ field: 'kind' }], values: [{ field: 'amount', aggFunc: 'sum' }] },
          },
        }),
      ),
    )
    const { cells, xml } = readSheet(await result.current.api.getXlsx({ compress: false }))
    expect(cells.A1).toBeUndefined()
    expect([cells.B1, cells.C1, cells.D1]).toEqual(['a', 'b', 'zz'])
    expect([cells.A2, cells.B2]).toEqual(['Region', 'Amount (sum)'])
    expect([cells.A3, cells.B3, cells.C3]).toEqual(['N', 100, 50])
    expect([cells.A4, cells.B4, cells.D4]).toEqual(['S', undefined, 20.5])
    expect(xml).toContain('<pane ySplit="2"')
  })

  it('server-side data exports what has been loaded', async () => {
    const { result } = renderHook(() =>
      useGrid<Sale>({
        columns,
        getRowId: (r) => r.id,
        dataSource: { getRows: async ({ start, end }) => ({ rows: rows.slice(start, end + 1), rowCount: rows.length }) },
        initialState: { paginationModel: { page: 0, pageSize: 2 } },
      }),
    )
    await act(async () => {
      for (let i = 0; i < 15; i++) await Promise.resolve()
    })
    const { cells } = readSheet(await result.current.api.getXlsx({ compress: false }))
    expect([cells.A2, cells.A3, cells.A4]).toEqual(['N', 'N', undefined]) // page 1 only
  })

  it('reports progress through the options', async () => {
    const seen: number[] = []
    const { result } = renderHook(() => useGrid(opts()))
    await result.current.api.getXlsx({ compress: false, onProgress: (n) => seen.push(n) })
    expect(seen).toEqual([4]) // one report at the end: 4 data rows
  })
})
