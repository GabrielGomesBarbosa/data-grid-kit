import { describe, expect, it } from 'vitest'
import { movePivotField } from './pivot'
import { createPipeline, type PipelineInput, type PipelineResult } from './pipeline'
import type { ColumnDef, PivotModel, RowId } from './types'

interface Sale {
  id: number
  region: string
  rep: string
  q: string | null
  year: number
  amount: number | null
}

const columns: ColumnDef<Sale>[] = [
  { field: 'id', type: 'number' },
  { field: 'region' },
  { field: 'rep' },
  { field: 'q' },
  { field: 'year', type: 'number' },
  { field: 'amount', type: 'number' },
]

const sales: Sale[] = [
  { id: 1, region: 'N', rep: 'ana', q: 'Q1', year: 2024, amount: 100 },
  { id: 2, region: 'N', rep: 'bia', q: 'Q2', year: 2024, amount: 50 },
  { id: 3, region: 'N', rep: 'ana', q: 'Q1', year: 2023, amount: null },
  { id: 4, region: 'S', rep: 'dani', q: 'Q2', year: 2024, amount: 300 },
  { id: 5, region: 'S', rep: 'dani', q: 'Q1', year: 2024, amount: 20 },
]

const input = (over: Partial<PipelineInput<Sale>> = {}): PipelineInput<Sale> => ({
  rows: sales,
  columns,
  getRowId: (r) => r.id,
  sortModel: [],
  filterModel: { items: [] },
  rowGroupingModel: ['region'],
  expandedIds: new Set<RowId>(),
  expandAllByDefault: true,
  pivot: { columns: [{ field: 'q' }], values: [{ field: 'amount', aggFunc: 'sum' }] },
  ...over,
})

const cell = (out: PipelineResult<Sale>, group: unknown, path: string[], valueField = 'amount') => {
  const col = out.pivotColumns.find((c) => c.valueField === valueField && c.path.join('|') === path.join('|'))
  return out.rows.find((r) => r.groupValue === group)!.aggregates![col!.field]
}

describe('pivot', () => {
  it('spreads the distinct column values into columns and aggregates each cell', () => {
    const out = createPipeline<Sale>()(input())
    expect(out.pivotColumns.map((c) => c.path.join('|'))).toEqual(['Q1', 'Q2'])
    expect(cell(out, 'N', ['Q1'])).toBe(100)
    expect(cell(out, 'N', ['Q2'])).toBe(50)
    expect(cell(out, 'S', ['Q1'])).toBe(20)
    expect(cell(out, 'S', ['Q2'])).toBe(300)
  })

  it('shows group rows only: no leaves, and the last group level is not expandable', () => {
    const out = createPipeline<Sale>()(input({ rowGroupingModel: ['region', 'rep'] }))
    expect(out.rows.every((r) => r.type === 'group')).toBe(true)
    const ana = out.rows.find((r) => r.groupValue === 'ana')!
    expect(ana.expandable).toBe(false)
    expect(ana.aggregates).toBeDefined()
    const north = out.rows.find((r) => r.groupValue === 'N')!
    expect(north.expandable).toBe(true)
  })

  it('totals row and per-value total columns', () => {
    const out = createPipeline<Sale>()(input({ pivot: { columns: [{ field: 'q' }], values: [{ field: 'amount', aggFunc: 'sum' }], totals: true } }))
    expect(out.pivotColumns.map((c) => (c.total ? 'total' : c.path.join('|')))).toEqual(['Q1', 'Q2', 'total'])
    const total = out.pivotColumns.find((c) => c.total)!
    expect(out.rows.find((r) => r.groupValue === 'N')!.aggregates![total.field]).toBe(150)
    expect(out.getTotals()![total.field]).toBe(470)
    const q1 = out.pivotColumns.find((c) => c.path[0] === 'Q1')!
    expect(out.getTotals()![q1.field]).toBe(120)
  })

  it('nested column fields give nested paths, sorted per level', () => {
    const pivot = { columns: [{ field: 'q', sort: 'desc' as const }, { field: 'year' }], values: [{ field: 'amount', aggFunc: 'sum' }, { field: 'id', aggFunc: 'size' }] }
    const out = createPipeline<Sale>()(input({ pivot }))
    expect(out.pivotColumns.map((c) => `${c.path.join('|')}/${c.valueField}`)).toEqual([
      'Q2|2024/amount',
      'Q2|2024/id',
      'Q1|2023/amount',
      'Q1|2023/id',
      'Q1|2024/amount',
      'Q1|2024/id',
    ])
  })

  it('an empty column value gets the "(No value)" column and its own cells', () => {
    const rows = [...sales, { id: 6, region: 'N', rep: 'x', q: null, year: 2024, amount: 5 }]
    const out = createPipeline<Sale>()(input({ rows }))
    expect(out.pivotColumns.at(-1)!.path).toEqual(['(No value)']) // empty values sort last
    expect(cell(out, 'N', ['(No value)'])).toBe(5)
    expect(cell(out, 'S', ['(No value)'])).toBeNull()
  })

  it('columns follow the filter: a value that no longer has rows loses its column', () => {
    const run = createPipeline<Sale>()
    const out = run(input({ filterModel: { items: [{ field: 'amount', operator: 'gt', value: 60 }] } }))
    expect(out.pivotColumns.map((c) => c.path[0])).toEqual(['Q1', 'Q2'])
    const out2 = run(input({ filterModel: { items: [{ field: 'amount', operator: 'gt', value: 200 }] } }))
    expect(out2.pivotColumns.map((c) => c.path[0])).toEqual(['Q2'])
  })

  it('keeps the same column list (identity) while the set of columns is unchanged', () => {
    const run = createPipeline<Sale>()
    const a = run(input())
    run.patch({ update: [{ ...sales[0]!, amount: 999 }] })
    const b = run(input())
    expect(b.pivotColumns).toBe(a.pivotColumns)
    expect(cell(b, 'N', ['Q1'])).toBe(999)
  })

  it('without row groups there are no rows, only the totals', () => {
    const out = createPipeline<Sale>()(input({ rowGroupingModel: [] }))
    expect(out.rows).toEqual([])
    const q1 = out.pivotColumns.find((c) => c.path[0] === 'Q1')!
    expect(out.getTotals()![q1.field]).toBe(120)
  })

  it('values with unknown fields or non built-in functions are ignored', () => {
    const out = createPipeline<Sale>()(input({ pivot: { columns: [{ field: 'q' }], values: [{ field: 'ghost', aggFunc: 'sum' }, { field: 'amount', aggFunc: 'nope' }] } }))
    expect(out.pivotColumns).toEqual([])
  })

  it('leaving pivot mode restores plain grouping', () => {
    const run = createPipeline<Sale>()
    run(input())
    const out = run(input({ pivot: undefined, aggregationModel: { amount: 'sum' } }))
    expect(out.pivotColumns).toEqual([])
    expect(out.rows.find((r) => r.groupValue === 'N')!.aggregates).toEqual({ amount: 150 })
    expect(out.rows.some((r) => r.type === 'leaf')).toBe(true)
  })
})

/* ------------------------------------------------------------ randomised: incremental vs from scratch vs naive */

const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 32
}

type Fn = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'size'

function naive(rows: Sale[], keep: (r: Sale) => boolean, groupBy: (keyof Sale)[], cols: (keyof Sale)[], values: { field: keyof Sale; fn: Fn }[]) {
  const live = rows.filter(keep)
  const label = (v: unknown) => (v == null || v === '' ? '(No value)' : String(v))
  const compute = (list: Sale[], field: keyof Sale, fn: Fn): unknown => {
    const vals = list.map((r) => r[field]).filter((v) => v != null && v !== '')
    const nums = vals.filter((v): v is number => typeof v === 'number')
    switch (fn) {
      case 'sum':
        return nums.length ? nums.reduce((a, b) => a + b, 0) : null
      case 'avg':
        return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
      case 'min':
        return vals.length ? Math.min(...(vals as number[])) : null
      case 'max':
        return vals.length ? Math.max(...(vals as number[])) : null
      case 'count':
        return vals.length
      case 'size':
        return list.length
    }
  }
  const colKeys = new Set(live.map((r) => cols.map((c) => label(r[c])).join('|')))
  const groups = new Map<string, Sale[]>()
  for (const r of live) {
    for (let d = 1; d <= groupBy.length; d++) {
      const k = groupBy.slice(0, d).map((g) => String(r[g])).join('|')
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(r)
    }
  }
  const cellOf = (list: Sale[], colKey: string, v: { field: keyof Sale; fn: Fn }) =>
    compute(
      list.filter((r) => cols.map((c) => label(r[c])).join('|') === colKey),
      v.field,
      v.fn,
    )
  return { live, colKeys, groups, cellOf, compute }
}

describe('pivot: column churn', () => {
  it('columns that lose their last row disappear, and the dead ones are cleaned up in the end', () => {
    const many: Sale[] = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, region: i % 2 ? 'N' : 'S', rep: 'a', q: `K${i}`, year: 2024, amount: i }))
    const run = createPipeline<Sale>()
    expect(run(input({ rows: many })).pivotColumns).toHaveLength(300)
    const keep = many.slice(0, 5)
    run.patch({ remove: many.slice(5).map((r) => r.id) })
    const after = run(input({ rows: keep }))
    const fresh = createPipeline<Sale>()(input({ rows: keep }))
    expect(after.pivotColumns.map((c) => c.field)).toEqual(fresh.pivotColumns.map((c) => c.field))
    expect(after.rows.map((r) => r.aggregates)).toEqual(fresh.rows.map((r) => r.aggregates))
    // every aggregate key is a live column: no dead ones are reported
    for (const row of after.rows) expect(Object.keys(row.aggregates!).sort()).toEqual(after.pivotColumns.map((c) => c.field).sort())
  })
})

describe('pivot: incremental updates match a fresh build and a naive computation', () => {
  const regions = ['N', 'S', 'E', 'W']
  const reps = ['ana', 'bia', 'caio', 'dani']
  const qs: (string | null)[] = ['Q1', 'Q2', 'Q3', null]
  const mk = (id: number, r: () => number): Sale => ({
    id,
    region: regions[Math.floor(r() * regions.length)]!,
    rep: reps[Math.floor(r() * reps.length)]!,
    q: qs[Math.floor(r() * qs.length)]!,
    year: 2022 + Math.floor(r() * 3),
    amount: r() < 0.15 ? null : Math.floor(r() * 100) - 20,
  })

  for (let seed = 1; seed <= 40; seed++) {
    it(`history ${seed}`, () => {
      const r = rng(seed)
      let rows: Sale[] = Array.from({ length: 30 }, (_, i) => mk(i + 1, r))
      let nextId = 100
      const fns: Fn[] = ['sum', 'avg', 'min', 'max', 'count', 'size']
      const fn = fns[seed % fns.length]!
      const groupBy: (keyof Sale)[] = seed % 2 ? ['region'] : ['region', 'rep']
      const cols: (keyof Sale)[] = seed % 3 === 0 ? ['q', 'year'] : seed % 3 === 1 ? ['q'] : []
      const pivot = {
        columns: cols.map((field) => ({ field: field as string })),
        values: [{ field: 'amount', aggFunc: fn }, { field: 'id', aggFunc: 'size' }],
        totals: seed % 4 === 0,
      }
      const run = createPipeline<Sale>()
      let threshold: number | null = null
      const build = () =>
        input({
          rows,
          rowGroupingModel: groupBy as string[],
          pivot,
          // a sort makes the order independent of the history (new groups are otherwise appended)
          sortModel: [{ field: 'region', direction: 'asc' as const }, { field: 'rep', direction: 'asc' as const }],
          filterModel: threshold === null ? { items: [] } : { items: [{ field: 'amount', operator: 'gt', value: threshold }] },
        })

      for (let step = 0; step < 25; step++) {
        const op = r()
        if (op < 0.3) {
          const row = mk(nextId++, r)
          run.patch({ insert: [row] })
          rows = [...rows, row]
        } else if (op < 0.6 && rows.length) {
          const at = Math.floor(r() * rows.length)
          const row = { ...mk(rows[at]!.id, r) }
          run.patch({ update: [row] })
          rows = rows.map((x, i) => (i === at ? row : x))
        } else if (op < 0.8 && rows.length > 3) {
          const at = Math.floor(r() * rows.length)
          run.patch({ remove: [rows[at]!.id] })
          rows = rows.filter((_, i) => i !== at)
        } else {
          threshold = r() < 0.4 ? null : Math.floor(r() * 60)
        }
        const incremental = run(build())
        const fresh = createPipeline<Sale>()(build())
        const keep = (x: Sale) => threshold === null || (x.amount !== null && x.amount > threshold)
        const nv = naive(rows, keep, groupBy, cols, [{ field: 'amount', fn }, { field: 'id', fn: 'size' }])

        // same columns, same numbers as a fresh build
        expect(incremental.pivotColumns.map((c) => [c.field, c.path, c.total])).toEqual(fresh.pivotColumns.map((c) => [c.field, c.path, c.total]))
        expect(incremental.rows.map((x) => [x.id, x.aggregates])).toEqual(fresh.rows.map((x) => [x.id, x.aggregates]))
        expect(incremental.getTotals()).toEqual(fresh.getTotals())

        // and the same as a direct computation
        const expectedCols = [...nv.colKeys]
        const gotKeys = new Set(incremental.pivotColumns.filter((c) => !c.total && c.valueField === 'id').map((c) => c.path.join('|')))
        expect(gotKeys).toEqual(new Set(expectedCols))
        for (const row of incremental.rows) {
          const key = String(row.groupValue)
          // find the naive group by walking up through the row id (group ids encode the path)
          const gpath = row.id.toString().split('/').slice(1).map((p) => p.slice(p.indexOf(':') + 1))
          const list = nv.groups.get(gpath.join('|'))!
          expect(list, key).toBeDefined()
          for (const c of incremental.pivotColumns) {
            const spec = c.valueField === 'id' ? { field: 'id' as const, fn: 'size' as Fn } : { field: 'amount' as const, fn }
            const want = c.total ? nv.compute(list, spec.field, spec.fn) : nv.cellOf(list, c.path.join('|'), spec)
            const got = row.aggregates![c.field]
            if (typeof want === 'number' && typeof got === 'number') expect(got).toBeCloseTo(want, 6)
            else expect(got).toEqual(want)
          }
        }
      }
    })
  }
})

describe('movePivotField', () => {
  const m: PivotModel = {
    rows: ['a', 'b'],
    columns: [{ field: 'c', sort: 'desc' }, { field: 'd' }],
    values: [{ field: 'e', aggFunc: 'avg' }, { field: 'f', aggFunc: 'max' }],
  }
  it('moves within a section, keeping the entry settings', () => {
    expect(movePivotField(m, 'b', 'rows', 'a').rows).toEqual(['b', 'a'])
    expect(movePivotField(m, 'd', 'columns', 'c').columns).toEqual([{ field: 'd' }, { field: 'c', sort: 'desc' }])
    expect(movePivotField(m, 'e', 'values', null).values).toEqual([{ field: 'f', aggFunc: 'max' }, { field: 'e', aggFunc: 'avg' }])
  })
  it('moves between sections: leaves the old one, lands before the target or at the end', () => {
    const r = movePivotField(m, 'c', 'rows', 'b')
    expect(r.rows).toEqual(['a', 'c', 'b'])
    expect(r.columns).toEqual([{ field: 'd' }])
    expect(movePivotField(m, 'a', 'columns').columns.map((c) => c.field)).toEqual(['c', 'd', 'a'])
  })
  it('a new value gets the default function; a field that was a value elsewhere keeps nothing', () => {
    expect(movePivotField(m, 'x', 'values', 'f', () => 'count').values.map((v) => [v.field, v.aggFunc])).toEqual([['e', 'avg'], ['x', 'count'], ['f', 'max']])
    expect(movePivotField(m, 'e', 'rows').values.map((v) => v.field)).toEqual(['f'])
  })
  it('removes with null, ignores an unknown "before", and returns the same object when nothing changes', () => {
    expect(movePivotField(m, 'a', null).rows).toEqual(['b'])
    expect(movePivotField(m, 'a', 'rows', 'ghost').rows).toEqual(['b', 'a']) // unknown target: the end
    expect(movePivotField(m, 'a', 'rows', 'b')).toBe(m) // already right before b
    expect(movePivotField(m, 'b', 'rows')).toBe(m) // already last
    expect(movePivotField(m, 'a', 'rows', 'a')).toBe(m) // dropped on itself
    expect(movePivotField(m, 'nope', null)).toBe(m)
  })
})
