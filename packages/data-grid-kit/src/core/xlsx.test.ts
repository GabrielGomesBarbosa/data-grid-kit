// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { crc32, zip } from './zip'
import { readZip } from './xlsx.helpers'
import { MAX_ROWS, buildXlsx, columnLetters, excelSerial, type XlsxRow } from './xlsx'

describe('zip', () => {
  it('writes entries a reader can get back, stored or deflated, with correct checksums', async () => {
    const enc = new TextEncoder()
    const big = enc.encode('hello world '.repeat(5000))
    const files = [
      { name: 'a.txt', chunks: [enc.encode('tiny')] },
      { name: 'dir/b.txt', chunks: [big.subarray(0, 100), big.subarray(100)] },
      { name: 'ünï.txt', chunks: [enc.encode('utf8 name')] },
    ]
    for (const compress of [true, false]) {
      const got = await readZip(await zip(files, { compress }))
      expect(Object.keys(got)).toEqual(['a.txt', 'dir/b.txt', 'ünï.txt'])
      expect(got['a.txt']).toBe('tiny')
      expect(got['dir/b.txt']).toBe('hello world '.repeat(5000))
    }
    expect((await zip(files, { compress: true })).length).toBeLessThan((await zip(files, { compress: false })).length)
  })

  it('crc32 of a known string', () => {
    expect(crc32([new TextEncoder().encode('123456789')])).toBe(0xcbf43926)
  })
})

describe('helpers', () => {
  it('column letters', () => {
    expect([0, 25, 26, 27, 51, 52, 701, 702, 16383].map(columnLetters)).toEqual(['A', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA', 'XFD'])
  })
  it('dates become Excel serials in wall-clock time, with the 1900 quirk', () => {
    expect(excelSerial(new Date(2024, 0, 5))).toBe(45296)
    expect(excelSerial(new Date(2024, 0, 5, 12))).toBe(45296.5)
    expect(excelSerial(new Date(1900, 2, 1))).toBe(61) // Excel: 1900-03-01 is 61
    expect(excelSerial(new Date(1900, 0, 1))).toBe(1)
  })
})

const sheetOf = async (rows: XlsxRow[], over: Partial<Parameters<typeof buildXlsx>[0]> = {}) => {
  const files = await readZip(
    await buildXlsx({ columns: [{ header: 'A' }, { header: 'B', numFmt: '#,##0.00' }, { header: 'C' }], rows, ...over }),
  )
  return { files, sheet: files['xl/worksheets/sheet1.xml']! }
}

describe('worksheet', () => {
  it('has the parts of a workbook', async () => {
    const { files } = await sheetOf([])
    expect(Object.keys(files).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'])
  })

  it('writes typed cells: numbers, booleans, dates, text; skips empty ones', async () => {
    const { sheet } = await sheetOf([{ cells: ['x', 12.5, true] }, { cells: [null, '', false] }, { cells: [new Date(2024, 0, 5), NaN, new Date('nope')] }])
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t>x</t></is></c>')
    expect(sheet).toContain('<c r="B2" s="1"><v>12.5</v></c>') // the column's number format
    expect(sheet).toContain('<c r="C2" t="b"><v>1</v></c>')
    expect(sheet).not.toContain('r="A3"')
    expect(sheet).not.toContain('r="B3"')
    expect(sheet).toContain('<c r="C3" t="b"><v>0</v></c>'.replace('C3', 'C3')) // false is a value
    expect(sheet).toMatch(/<c r="A4" s="\d+"><v>45296<\/v><\/c>/)
    expect(sheet).not.toContain('r="B4"') // NaN
    expect(sheet).not.toContain('r="C4"') // invalid date
  })

  it('keeps text as text: formulas never run, markup and control characters are neutralised', async () => {
    const { sheet } = await sheetOf([{ cells: ['=1+1', '<b>&"q"</b>', 'a\u0001b\uD800c'] }])
    expect(sheet).toContain('<is><t>=1+1</t></is>') // an inline string: Excel does not evaluate it
    expect(sheet).toContain('&lt;b&gt;&amp;&quot;q&quot;&lt;/b&gt;')
    expect(sheet).toContain('<t>abc</t>')
    expect(sheet).not.toContain('\u0001')
  })

  it('preserves leading / trailing spaces and truncates text over the 32,767 limit', async () => {
    const { sheet } = await sheetOf([{ cells: [' x ', 'y'.repeat(40000)] }])
    expect(sheet).toContain('<t xml:space="preserve"> x </t>')
    expect(sheet.match(/<t>(y+)<\/t>/)![1]!.length).toBe(32767)
  })

  it('header row, freeze pane, column widths and an optional filter', async () => {
    const { sheet, files } = await sheetOf([{ cells: [1, 2, 3] }], {
      columns: [{ header: 'A', width: 20 }, { header: 'B' }],
      autoFilter: true,
    })
    expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>')
    expect(sheet).toContain('<col min="1" max="1" width="20.00" customWidth="1"/>')
    expect(sheet).toContain('<autoFilter ref="A1:B2"/>')
    expect(files['xl/workbook.xml']).toContain('_xlnm._FilterDatabase')
    const none = await sheetOf([{ cells: [1] }], { headers: false })
    expect(none.sheet).not.toContain('<pane')
    expect(none.sheet).not.toContain('inlineStr')
  })

  it('column groups become rows of merged cells above the titles', async () => {
    const { sheet } = await sheetOf([{ cells: [1, 2, 3, 4] }], {
      columns: [
        { header: 'Label' },
        { header: 'sum', group: ['2023'] },
        { header: 'avg', group: ['2023'] },
        { header: 'sum', group: ['2024', 'EU'] },
      ],
      autoFilter: true,
    })
    expect(sheet).toContain('<mergeCells count="1"><mergeCell ref="B1:C1"/></mergeCells>')
    expect(sheet).toContain('<row r="2">') // second group level (only the last column has it)
    expect(sheet).toMatch(/<c r="D2" t="inlineStr" s="\d+"><is><t>EU<\/t><\/is><\/c>/)
    expect(sheet).toContain('<pane ySplit="3"') // frozen under all header rows
    expect(sheet).not.toContain('<autoFilter') // no filter buttons under merged groups
    expect(sheet).toContain('<row r="4">') // data starts below the titles
  })

  it('outline levels and bold group rows', async () => {
    const { sheet } = await sheetOf([{ cells: ['g', 5], level: 0, bold: true }, { cells: ['leaf', 1], level: 1 }])
    expect(sheet).toContain('<row r="3" outlineLevel="1">')
    expect(sheet).toContain('<sheetFormatPr defaultRowHeight="15" outlineLevelRow="1"/>')
    expect(sheet).toContain('<outlinePr summaryBelow="0"/>')
    expect(sheet).toMatch(/<c r="B2" s="\d+"><v>5<\/v>/)
  })

  it('sheet names are made safe', async () => {
    const { files } = await sheetOf([], { name: "Q1/Q2: 'big' [x]*? and a very long name that is over thirty-one" })
    const name = files['xl/workbook.xml']!.match(/<sheet name="([^"]*)"/)![1]!.replace(/&apos;|&quot;|&amp;/g, 'x')
    expect(name).not.toMatch(/[[\]:*?/\\]/)
    expect(name.length).toBeLessThanOrEqual(31)
  })

  it('refuses more rows than Excel holds, and honours abort', async () => {
    const many = { [Symbol.iterator]: function* () { for (let i = 0; i < MAX_ROWS; i++) yield { cells: [i] } } }
    await expect(buildXlsx({ columns: [{ header: 'n' }], rows: many }, { compress: false })).rejects.toThrow(/at most 1,048,576 rows/)
    const ctl = new AbortController()
    const rows = { [Symbol.iterator]: function* () { for (let i = 0; i < 50000; i++) { if (i === 100) ctl.abort(); yield { cells: [i] } } } }
    await expect(buildXlsx({ columns: [{ header: 'n' }], rows }, { signal: ctl.signal, yieldEvery: 50 })).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('reports progress and yields while writing', async () => {
    const seen: number[] = []
    const rows = Array.from({ length: 2500 }, (_, i) => ({ cells: [i] }))
    await buildXlsx({ columns: [{ header: 'n' }], rows }, { yieldEvery: 1000, onProgress: (n) => seen.push(n) })
    expect(seen).toEqual([1000, 2000, 2500])
  })

  it('rejects more columns than Excel holds', async () => {
    const columns = Array.from({ length: 16385 }, (_, i) => ({ header: String(i) }))
    await expect(buildXlsx({ columns, rows: [] })).rejects.toThrow(/at most 16384 columns/)
  })
})
