// Writes sample workbooks for scripts/verify_xlsx.py (an independent reader). Usage: tsx scripts/xlsx-fixture.ts <dir>
import { writeFileSync } from 'node:fs'
import { buildXlsx } from '../src/core/xlsx'

const dir = process.argv[2]!
const columns = [
  { header: 'Name', group: ['People'], width: 18 },
  { header: 'Team', group: ['People'] },
  { header: 'Salary', group: ['Pay'], numFmt: '$#,##0.00' },
  { header: 'Hired', group: ['Pay'] },
  { header: 'Remote' },
]
const rows = [
  { cells: ['Data', null, 3000.5, null, null], level: 0, bold: true },
  { cells: ['Ana <b> & "Co"', 'Data', 1200.25, new Date(2020, 0, 15, 13, 30), true], level: 1 },
  { cells: ['=1+1', '@SUM(A1)', 1800.25, new Date(2021, 5, 1), false], level: 1 },
  { cells: ['Emoji 😀 日本語', 'Data\nnew line', NaN, new Date('invalid'), undefined], level: 1 },
  { cells: ['x'.repeat(40000), 'long', 0, new Date(1999, 11, 31), true] },
]
for (const compress of [true, false]) {
  const bytes = await buildXlsx({ name: 'Sheet: bad/chars?', columns, rows }, { compress })
  writeFileSync(`${dir}/fixture-${compress ? 'deflated' : 'stored'}.xlsx`, bytes)
}
