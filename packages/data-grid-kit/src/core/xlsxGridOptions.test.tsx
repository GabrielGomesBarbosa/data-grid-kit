import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGrid } from './useGrid'
import { readZip } from './xlsx.helpers'
import type { ColumnDef } from './types'

interface Item {
  id: number
  name: string
  kind: string
  qty: number
}
const rows: Item[] = [
  { id: 1, name: 'bolt', kind: 'a', qty: 5 },
  { id: 2, name: 'nut', kind: 'b', qty: 7 },
]
const columns: ColumnDef<Item>[] = [
  { field: 'name', headerName: 'Name' },
  { field: 'kind', headerName: 'Kind', type: 'singleSelect', valueOptions: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
  { field: 'qty', headerName: 'Qty', type: 'number' },
]
const grid = () => renderHook(() => useGrid<Item>({ rows, columns, getRowId: (r) => r.id, pagination: false })).result.current

describe('grid export options', () => {
  it('validateSelects gives singleSelect columns a drop-down of their labels; off by default', async () => {
    const g = grid()
    const on = await readZip(await g.api.getXlsx({ compress: false, validateSelects: true }))
    expect(on['xl/worksheets/sheet1.xml']).toContain('sqref="B2:B3"')
    expect(on['xl/worksheets/sheet1.xml']).toContain('<formula1>"Alpha,Beta"</formula1>')
    const off = await readZip(await g.api.getXlsx({ compress: false }))
    expect(off['xl/worksheets/sheet1.xml']).not.toContain('dataValidation')
  })

  it('columnStyles and headerStyle reach the file', async () => {
    const files = await readZip(await grid().api.getXlsx({ compress: false, headerStyle: { fill: '#112233' }, columnStyles: { qty: { color: '#0a7d36', bold: true } } }))
    expect(files['xl/styles.xml']).toContain('rgb="FF112233"')
    expect(files['xl/styles.xml']).toContain('<color rgb="FF0A7D36"/>')
  })

  it('extraSheets come after the grid sheet, in the same file', async () => {
    const files = await readZip(
      await grid().api.getXlsx({
        compress: false,
        sheetName: 'Items',
        extraSheets: [{ name: 'Legend', columns: [{ header: 'Code' }, { header: 'Meaning' }], rows: [{ cells: ['a', 'Alpha'] }, { cells: ['n', { formula: 'COUNTA(A2:A3)', value: 2 }] }] }],
      }),
    )
    expect(files['xl/workbook.xml']).toContain('<sheet name="Items" sheetId="1" r:id="rId1"/><sheet name="Legend" sheetId="2" r:id="rId2"/>')
    expect(files['xl/worksheets/sheet1.xml']).toContain('>bolt<')
    expect(files['xl/worksheets/sheet2.xml']).toContain('<f>COUNTA(A2:A3)</f><v>2</v>')
  })
})
