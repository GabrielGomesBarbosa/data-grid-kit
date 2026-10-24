import { describe, expect, it } from 'vitest'
import { createPipeline, type PipelineInput } from './pipeline'
import { accAdd, accFinish, accSub, availableAggregations, newAcc } from './aggregation'
import type { ColumnDef, CustomAggregation, RowId } from './types'

interface Sale {
  id: number
  region: string
  rep: string
  amount: number | null
  day: Date
  path: string[]
}

const sales: Sale[] = [
  { id: 1, region: 'N', rep: 'ana', amount: 100, day: new Date(2024, 0, 5), path: ['N'] },
  { id: 2, region: 'N', rep: 'bia', amount: 50, day: new Date(2024, 0, 9), path: ['N', 'bia'] },
  { id: 3, region: 'N', rep: 'caio', amount: null, day: new Date(2024, 1, 1), path: ['N', 'caio'] },
  { id: 4, region: 'S', rep: 'dani', amount: 300, day: new Date(2023, 11, 20), path: ['S', 'dani'] },
  { id: 5, region: 'S', rep: 'edu', amount: 20, day: new Date(2024, 2, 2), path: ['S', 'edu'] },
]

const columns: ColumnDef<Sale>[] = [
  { field: 'id', type: 'number' },
  { field: 'region' },
  { field: 'rep' },
  { field: 'amount', type: 'number' },
  { field: 'day', type: 'date' },
]

const input = (over: Partial<PipelineInput<Sale>> = {}): PipelineInput<Sale> => ({
  rows: sales,
  columns,
  getRowId: (r) => r.id,
  sortModel: [],
  filterModel: { items: [] },
  rowGroupingModel: [],
  expandedIds: new Set<RowId>(),
  expandAllByDefault: false,
  ...over,
})

describe('built-in functions', () => {
  it('sum / avg / min / max / count / size over the whole data set', () => {
    const run = createPipeline<Sale>()
    const totals = (name: string) => run(input({ aggregationModel: { amount: name } })).getTotals()!.amount
    expect(totals('sum')).toBe(470)
    expect(totals('avg')).toBe(117.5) // the null amount is not part of the average
    expect(totals('min')).toBe(20)
    expect(totals('max')).toBe(300)
    expect(totals('count')).toBe(4) // non-empty values
    expect(totals('size')).toBe(5) // rows
  })

  it('min / max work on dates and text', () => {
    const run = createPipeline<Sale>()
    const t = run(input({ aggregationModel: { day: 'min', rep: 'max' } })).getTotals()!
    expect(t.day).toEqual(new Date(2023, 11, 20))
    expect(t.rep).toBe('edu')
  })

  it('empty sets give null for value functions and 0 for counts', () => {
    const run = createPipeline<Sale>()
    const none = { filterModel: { items: [{ field: 'region', operator: 'equals' as const, value: 'zzz' }] } }
    const t = run(input({ ...none, aggregationModel: { amount: 'sum', id: 'size' } })).getTotals()!
    expect(t.amount).toBeNull()
    expect(t.id).toBe(0)
  })

  it('no model means no totals and no aggregates', () => {
    const out = createPipeline<Sale>()(input({ rowGroupingModel: ['region'] }))
    expect(out.getTotals()).toBeUndefined()
    expect(out.rows[0]!.aggregates).toBeUndefined()
  })

  it('ignores unknown functions and unknown fields', () => {
    const out = createPipeline<Sale>()(input({ aggregationModel: { amount: 'nope', ghost: 'sum' } }))
    expect(out.getTotals()).toBeUndefined() // nothing valid to aggregate = same as no model
  })
})

describe('in groups', () => {
  it('group rows carry their own aggregates and respect the filter', () => {
    const run = createPipeline<Sale>()
    const base = input({ rowGroupingModel: ['region'], aggregationModel: { amount: 'sum', id: 'size' } })
    const out = run(base)
    expect(out.rows.map((r) => [r.groupValue, r.aggregates])).toEqual([
      ['N', { amount: 150, id: 3 }],
      ['S', { amount: 320, id: 2 }],
    ])
    const filtered = run({ ...base, filterModel: { items: [{ field: 'amount', operator: 'gt', value: 60 }] } })
    expect(filtered.rows.map((r) => [r.groupValue, r.aggregates])).toEqual([
      ['N', { amount: 100, id: 1 }],
      ['S', { amount: 300, id: 1 }],
    ])
    expect(filtered.getTotals()).toEqual({ amount: 400, id: 2 })
  })

  it('nested groups aggregate their own subtree', () => {
    const out = createPipeline<Sale>()(
      input({ rowGroupingModel: ['region', 'rep'], expandAllByDefault: true, aggregationModel: { amount: 'sum' } }),
    )
    const sum = (v: string) => out.rows.find((r) => r.groupValue === v)!.aggregates!.amount
    expect(sum('N')).toBe(150)
    expect(sum('bia')).toBe(50)
    expect(sum('caio')).toBeNull()
  })

  it('tree parents aggregate their descendants, not their own row', () => {
    const out = createPipeline<Sale>()(
      input({ getTreeDataPath: (r) => r.path, expandAllByDefault: true, aggregationModel: { amount: 'sum' } }),
    )
    const north = out.rows.find((r) => r.id === 1)! // row 1 (amount 100) is the parent of bia and caio
    expect(north.aggregates!.amount).toBe(50)
    expect(out.getTotals()!.amount).toBe(470)
  })
})

describe('staying correct while rows change', () => {
  const base = () =>
    input({ rowGroupingModel: ['region'], aggregationModel: { amount: 'max' }, sortModel: [{ field: 'id', direction: 'asc' }] })

  it('removing or lowering the current maximum recomputes it', () => {
    const run = createPipeline<Sale>()
    run(base())
    run.patch({ remove: [4] }) // the 300 in S
    let out = run(base())
    expect(out.rows.find((r) => r.groupValue === 'S')!.aggregates!.amount).toBe(20)
    expect(out.getTotals()!.amount).toBe(100)
    run.patch({ update: [{ ...sales[0]!, amount: 1 }] }) // the 100 in N drops to 1
    out = run(base())
    expect(out.rows.find((r) => r.groupValue === 'N')!.aggregates!.amount).toBe(50)
    expect(out.getTotals()!.amount).toBe(50)
  })

  it('a group appearing and disappearing keeps totals right', () => {
    const run = createPipeline<Sale>()
    const b = { ...base(), aggregationModel: { amount: 'sum' } }
    run(b)
    run.patch({ insert: [{ id: 9, region: 'W', rep: 'x', amount: 7, day: new Date(), path: ['W'] }] })
    let out = run(b)
    expect(out.rows.map((r) => [r.groupValue, r.aggregates!.amount])).toEqual([['N', 150], ['S', 320], ['W', 7]])
    run.patch({ remove: [9] })
    out = run(b)
    expect(out.rows.map((r) => r.groupValue)).toEqual(['N', 'S'])
    expect(out.getTotals()!.amount).toBe(470)
  })

  it('switching the function recomputes without touching sort or counts', () => {
    const run = createPipeline<Sale>()
    run({ ...base(), aggregationModel: { amount: 'sum' } })
    const out = run({ ...base(), aggregationModel: { amount: 'avg' } })
    expect(out.rows.find((r) => r.groupValue === 'S')!.aggregates!.amount).toBe(160)
  })

  it('a new object with the same values keeps the same row object (no needless re-render)', () => {
    const run = createPipeline<Sale>()
    const b = { ...base(), aggregationModel: { amount: 'sum' } }
    const first = run(b).rows.find((r) => r.groupValue === 'S')!
    run.patch({ update: [{ ...sales[0]!, rep: 'renamed' }] }) // touches group N only, not its sum
    const second = run(b).rows.find((r) => r.groupValue === 'S')!
    expect(second).toBe(first)
  })
})

describe('custom functions', () => {
  const spread: CustomAggregation<Sale> = {
    label: 'spread',
    apply: ({ values }) => {
      const n = values.filter((v): v is number => typeof v === 'number')
      return n.length ? Math.max(...n) - Math.min(...n) : null
    },
  }

  it('receive every value of the group, and the grand total', () => {
    const out = createPipeline<Sale>()(
      input({ rowGroupingModel: ['region'], aggregationModel: { amount: 'spread' }, aggregationFunctions: { spread } }),
    )
    expect(out.rows.map((r) => r.aggregates!.amount)).toEqual([50, 280])
    expect(out.getTotals()!.amount).toBe(280)
  })

  it('follow changes to the data', () => {
    const run = createPipeline<Sale>()
    const b = input({ aggregationModel: { amount: 'spread' }, aggregationFunctions: { spread } })
    run(b)
    run.patch({ update: [{ ...sales[3]!, amount: 1000 }] })
    expect(run(b).getTotals()!.amount).toBe(980)
  })
})

describe('accumulators', () => {
  it('add and subtract are inverses, and an emptied accumulator resets exactly', () => {
    const acc = newAcc()
    for (const v of [0.1, 0.2, 0.3]) accAdd(acc, 'sum', v)
    for (const v of [0.1, 0.2, 0.3]) accSub(acc, 'sum', v)
    expect(acc.s).toBe(0) // not 5.55e-17: reset when the last row leaves
    expect(accFinish(acc, 'sum')).toBeNull()
  })

  it('reports staleness only when min/max lose their extreme', () => {
    const acc = newAcc()
    ;[5, 9, 2].forEach((v) => accAdd(acc, 'max', v))
    expect(accSub(acc, 'max', 5)).toBe(false)
    expect(accSub(acc, 'max', 9)).toBe(true)
  })
})

describe('which functions a column offers', () => {
  it('follows the column type, aggregable and the allow list', () => {
    expect(availableAggregations({ type: 'number' })).toEqual(['sum', 'avg', 'min', 'max', 'count', 'size'])
    expect(availableAggregations({ type: 'date' })).toEqual(['min', 'max', 'count', 'size'])
    expect(availableAggregations({})).toEqual(['count', 'size'])
    expect(availableAggregations({ type: 'number', aggregable: false })).toEqual([])
    expect(availableAggregations({ type: 'number', availableAggregationFunctions: ['sum'] })).toEqual(['sum'])
    const custom = { spread: { label: 's', apply: () => 0, columnTypes: ['number' as const] } }
    expect(availableAggregations({ type: 'number' }, custom)).toContain('spread')
    expect(availableAggregations({ type: 'string' }, custom)).not.toContain('spread')
  })
})
