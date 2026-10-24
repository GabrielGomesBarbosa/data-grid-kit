import { buildXlsx, type XlsxRow } from '../src/core/xlsx'

const rowsOf = (n: number): Iterable<XlsxRow> => ({
  [Symbol.iterator]: function* () {
    for (let i = 0; i < n; i++) yield { cells: [`Person ${i}`, ['Data', 'Growth', 'Design'][i % 3]!, i * 1.25, 20 + (i % 40), new Date(2015 + (i % 10), i % 12, 1 + (i % 27)), i % 2 === 0] }
  },
})
const columns = ['name', 'team', 'salary', 'age', 'hired', 'remote'].map((header) => ({ header }))

for (const n of [100_000, 500_000]) {
  for (const compress of [true, false]) {
    const t = performance.now()
    const bytes = await buildXlsx({ columns, rows: rowsOf(n) }, { compress, yieldEvery: 1e9 })
    console.log(`${n.toLocaleString()} rows x 6 columns, ${compress ? 'deflated' : 'stored'}: ${(performance.now() - t).toFixed(0)} ms, ${(bytes.length / 1e6).toFixed(1)} MB, heap ${(process.memoryUsage().heapUsed / 1e6).toFixed(0)} MB`)
  }
}
