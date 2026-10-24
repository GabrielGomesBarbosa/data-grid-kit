// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readZip } from './xlsx.helpers'
import { buildXlsx, buildXlsxWorkbook, type XlsxSheet } from './xlsx'

const sheet = (over: Partial<XlsxSheet> = {}): XlsxSheet => ({
  columns: [{ header: 'Name' }, { header: 'Status' }, { header: 'Total' }],
  rows: [{ cells: ['a', 'open', 1] }, { cells: ['b', 'done', 2] }],
  ...over,
})

describe('formulas', () => {
  it('only an explicit object is a formula; text that starts with = stays text', async () => {
    const files = await readZip(await buildXlsx(sheet({ rows: [{ cells: ['=1+1', { formula: '=SUM(C3:C4)', value: 3 }, { formula: 'A3&"!"', value: 'a!' }] }] })))
    const xml = files['xl/worksheets/sheet1.xml']!
    expect(xml).toContain('t="inlineStr"><is><t>=1+1</t>') // text
    expect(xml).toContain('<f>SUM(C3:C4)</f><v>3</v>') // leading = dropped, result cached
    expect(xml).toContain('t="str"><f>A3&amp;&quot;!&quot;</f><v>a!</v>')
  })

  it('a formula without a result is written without one, and an empty formula is skipped', async () => {
    const files = await readZip(await buildXlsx(sheet({ rows: [{ cells: [{ formula: 'NOW()' }, { formula: '=' }, null] }] })))
    const xml = files['xl/worksheets/sheet1.xml']!
    expect(xml).toContain('<f>NOW()</f></c>')
    expect(xml).not.toContain('<f></f>')
  })
})

describe('styles', () => {
  it('a column style and a header style become fonts, fills and alignment of the cells that use them', async () => {
    const files = await readZip(
      await buildXlsx(
        sheet({
          headerStyle: { fill: '#112233', color: '#ffffff' },
          columns: [{ header: 'Name', style: { italic: true, color: '#FF0000', align: 'center', wrap: true } }, { header: 'Status', style: { fill: '#ffee00', bold: true } }, { header: 'Total' }],
        }),
      ),
    )
    const styles = files['xl/styles.xml']!
    expect(styles).toContain('<i/>')
    expect(styles).toContain('<color rgb="FFFF0000"/>')
    expect(styles).toContain('rgb="FF112233"')
    expect(styles).toContain('rgb="FFFFEE00"')
    expect(styles).toContain('horizontal="center"')
    expect(styles).toContain('wrapText="1"')
    expect(styles).toMatch(/<fonts count="(\d+)">/)
    const sheetXml = files['xl/worksheets/sheet1.xml']!
    const textCell = /<c r="A3" t="inlineStr" s="(\d+)">/.exec(sheetXml)
    expect(textCell).not.toBeNull() // the styled column's text carries a style
  })

  it('a bad colour is ignored, and a sheet without styles keeps the plain style for text', async () => {
    const files = await readZip(await buildXlsx(sheet({ columns: [{ header: 'Name', style: { color: 'red' } }, { header: 'S' }, { header: 'T' }] })))
    expect(files['xl/styles.xml']).toContain('<fonts count="2">') // no new font for a colour that is not #rrggbb
    const plain = await readZip(await buildXlsx(sheet()))
    expect(plain['xl/worksheets/sheet1.xml']).toContain('<c r="A3" t="inlineStr"><is>')
  })
})

describe('validation lists', () => {
  it('a column asks for a drop-down over its data cells', async () => {
    const files = await readZip(await buildXlsx(sheet({ columns: [{ header: 'Name' }, { header: 'Status', validationList: ['open', 'done', 'late & lost'] }, { header: 'Total' }] })))
    const xml = files['xl/worksheets/sheet1.xml']!
    expect(xml).toContain('<dataValidations count="1">')
    expect(xml).toContain('sqref="B2:B3"')
    expect(xml).toContain('<formula1>"open,done,late &amp; lost"</formula1>')
    expect(xml.indexOf('</sheetData>')).toBeLessThan(xml.indexOf('<dataValidations'))
  })

  it('a list that cannot be an inline list is left out: commas, quotes, too long, empty', async () => {
    for (const list of [['a,b'], ['say "hi"'], ['x'.repeat(256)], [], ['ok', '']]) {
      const files = await readZip(await buildXlsx(sheet({ columns: [{ header: 'Name' }, { header: 'Status', validationList: list }, { header: 'Total' }] })))
      expect(files['xl/worksheets/sheet1.xml']).not.toContain('dataValidation')
    }
  })

  it('no data rows, no validation range', async () => {
    const files = await readZip(await buildXlsx(sheet({ rows: [], columns: [{ header: 'S', validationList: ['a'] }] })))
    expect(files['xl/worksheets/sheet1.xml']).not.toContain('dataValidation')
  })
})

describe('several sheets', () => {
  it('writes every sheet, in order, with its own part, relation and content type', async () => {
    const files = await readZip(await buildXlsxWorkbook([sheet({ name: 'First' }), sheet({ name: 'Second', rows: [{ cells: ['only', 'one', 9] }] })]))
    expect(Object.keys(files).filter((n) => n.startsWith('xl/worksheets/'))).toEqual(['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'])
    expect(files['xl/workbook.xml']).toContain('<sheet name="First" sheetId="1" r:id="rId1"/><sheet name="Second" sheetId="2" r:id="rId2"/>')
    expect(files['xl/_rels/workbook.xml.rels']).toContain('Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"')
    expect(files['[Content_Types].xml']).toContain('/xl/worksheets/sheet2.xml')
    expect(files['xl/worksheets/sheet2.xml']).toContain('>only<')
    expect(files['xl/worksheets/sheet1.xml']).not.toContain('>only<')
  })

  it('sheet names are made unique, ignoring case', async () => {
    const files = await readZip(await buildXlsxWorkbook([sheet({ name: 'Data' }), sheet({ name: 'data' }), sheet({ name: 'DATA' })]))
    expect(files['xl/workbook.xml']).toContain('name="Data"')
    expect(files['xl/workbook.xml']).toContain('name="data (2)"')
    expect(files['xl/workbook.xml']).toContain('name="DATA (3)"')
  })

  it('each sheet with a filter declares its own range, by its own index', async () => {
    const files = await readZip(await buildXlsxWorkbook([sheet({ name: 'A' }), sheet({ name: 'B', autoFilter: true })]))
    expect(files['xl/workbook.xml']).toContain('localSheetId="1"')
    expect(files['xl/workbook.xml']).not.toContain('localSheetId="0"')
  })

  it('needs a sheet', async () => {
    await expect(buildXlsxWorkbook([])).rejects.toThrow(/at least one sheet/)
  })

  it('a single sheet still works the same as before', async () => {
    const files = await readZip(await buildXlsx(sheet({ name: 'Solo' })))
    expect(Object.keys(files)).toContain('xl/worksheets/sheet1.xml')
    expect(files['xl/workbook.xml']).toContain('<sheet name="Solo" sheetId="1" r:id="rId1"/>')
  })
})
