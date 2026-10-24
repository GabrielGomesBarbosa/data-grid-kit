import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGrid } from './useGrid'
import { movePivotField } from './pivot'
import { addPivotValue, moveValueEntry, removePivotValue, setPivotHidden, setValueFunc, visiblePivot } from './pivotModel'
import type { ColumnDef, GridOptions, PivotModel } from './types'

const base: PivotModel = {
  rows: ['region', 'rep'],
  columns: [{ field: 'year' }],
  values: [
    { field: 'amount', aggFunc: 'sum' },
    { field: 'units', aggFunc: 'sum' },
  ],
}

describe('pivot model: hiding entries', () => {
  it('visiblePivot drops what is switched off and keeps the same arrays when nothing is', () => {
    expect(visiblePivot(base).rows).toBe(base.rows)
    const m = setPivotHidden(setPivotHidden(setPivotHidden(base, { section: 'rows', field: 'rep' }, true), { section: 'columns', field: 'year' }, true), { section: 'values', index: 1 }, true)
    const v = visiblePivot(m)
    expect(v.rows).toEqual(['region'])
    expect(v.columns).toEqual([])
    expect(v.values.map((x) => x.field)).toEqual(['amount'])
    expect(m.rows).toEqual(['region', 'rep']) // still in the model
  })

  it('switching back on, or switching what is already so, returns the same object', () => {
    const off = setPivotHidden(base, { section: 'values', index: 0 }, true)
    expect(setPivotHidden(off, { section: 'values', index: 0 }, true)).toBe(off)
    const on = setPivotHidden(off, { section: 'values', index: 0 }, false)
    expect(on.values[0]!.hidden).toBeUndefined()
    expect(setPivotHidden(base, { section: 'rows', field: 'region' }, false)).toBe(base)
    expect(setPivotHidden(base, { section: 'rows', field: 'nope' }, true)).toBe(base)
  })

  it('a hidden row stays hidden when it is reordered, and is forgotten when it leaves rows', () => {
    const m = setPivotHidden(base, { section: 'rows', field: 'rep' }, true)
    expect(movePivotField(m, 'rep', 'rows', 'region').hiddenRows).toEqual(['rep'])
    expect(movePivotField(m, 'rep', 'columns').hiddenRows).toBeUndefined()
    expect(movePivotField(m, 'rep', null).hiddenRows).toBeUndefined()
  })

  it('a hidden column or value keeps its flag when reordered', () => {
    const m = setPivotHidden(base, { section: 'values', index: 1 }, true)
    const moved = movePivotField(m, 'units', 'values', 'amount')
    expect(moved.values.map((v) => [v.field, !!v.hidden])).toEqual([['units', true], ['amount', false]])
  })
})

describe('pivot model: the same field more than once', () => {
  it('adds an entry with another function right after the first, once per function', () => {
    const m = addPivotValue(base, 'amount', 'avg')
    expect(m.values.map((v) => `${v.field}:${v.aggFunc}`)).toEqual(['amount:sum', 'amount:avg', 'units:sum'])
    expect(addPivotValue(m, 'amount', 'avg')).toBe(m)
    expect(addPivotValue(base, 'region', 'count')).toBe(base) // not a value
  })

  it('removes one entry, not the field', () => {
    const m = addPivotValue(base, 'amount', 'avg')
    expect(removePivotValue(m, 0).values.map((v) => `${v.field}:${v.aggFunc}`)).toEqual(['amount:avg', 'units:sum'])
  })

  it('changes the function of one entry, refusing a pair that exists', () => {
    const m = addPivotValue(base, 'amount', 'avg')
    expect(setValueFunc(m, 1, 'max').values[1]!.aggFunc).toBe('max')
    expect(setValueFunc(m, 1, 'sum')).toBe(m)
  })

  it('moves one entry by index', () => {
    const m = addPivotValue(base, 'amount', 'avg') // amount:sum, amount:avg, units:sum
    expect(moveValueEntry(m, 2, 0).values.map((v) => v.field + ':' + v.aggFunc)).toEqual(['units:sum', 'amount:sum', 'amount:avg'])
    expect(moveValueEntry(m, 0, 3).values.map((v) => v.field + ':' + v.aggFunc)).toEqual(['amount:avg', 'units:sum', 'amount:sum'])
    expect(moveValueEntry(m, 1, 2)).toBe(m)
  })

  it('moving a field inside values moves one entry; moving it elsewhere takes all its entries', () => {
    const m = addPivotValue(base, 'amount', 'avg')
    expect(movePivotField(m, 'units', 'values', 'amount').values.map((v) => v.field)).toEqual(['units', 'amount', 'amount'])
    expect(movePivotField(m, 'amount', 'columns').values.map((v) => v.field)).toEqual(['units'])
  })
})

interface Sale {
  id: number
  region: string
  rep: string
  year: number
  amount: number
}
const rows: Sale[] = [
  { id: 1, region: 'N', rep: 'a', year: 2023, amount: 10 },
  { id: 2, region: 'N', rep: 'b', year: 2024, amount: 30 },
  { id: 3, region: 'S', rep: 'c', year: 2024, amount: 50 },
]
const columns: ColumnDef<Sale>[] = [{ field: 'region' }, { field: 'rep' }, { field: 'year', type: 'number' }, { field: 'amount', type: 'number' }]
const opts = (pivotModel: PivotModel): GridOptions<Sale> => ({
  rows,
  columns,
  getRowId: (r) => r.id,
  pivoting: true,
  pagination: false,
  initialState: { pivotMode: true, pivotModel, expandAllByDefault: true },
})
const model: PivotModel = { rows: ['region', 'rep'], columns: [{ field: 'year' }], values: [{ field: 'amount', aggFunc: 'sum' }] }

describe('pivot grid with hidden and repeated entries', () => {
  it('hiding a row level removes it from the grouping, and showing it brings it back', () => {
    const { result } = renderHook(() => useGrid<Sale>(opts(model)))
    expect(result.current.result.rows.map((r) => r.depth)).toEqual([0, 1, 1, 0, 1])
    act(() => result.current.api.setPivotModel((m) => setPivotHidden(m, { section: 'rows', field: 'rep' }, true)))
    expect(result.current.result.rows.map((r) => r.groupValue)).toEqual(['N', 'S'])
    act(() => result.current.api.setPivotModel((m) => setPivotHidden(m, { section: 'rows', field: 'rep' }, false)))
    expect(result.current.result.rows).toHaveLength(5)
  })

  it('hiding the column field collapses the year columns into one', () => {
    const { result } = renderHook(() => useGrid<Sale>(opts(model)))
    const before = result.current.layout.all.filter((c) => c.pivot && !c.pivot.total).length
    expect(before).toBe(2) // 2023, 2024
    act(() => result.current.api.setPivotModel((m) => setPivotHidden(m, { section: 'columns', field: 'year' }, true)))
    expect(result.current.layout.all.filter((c) => c.pivot && !c.pivot.total).length).toBe(1)
  })

  it('the same field with two functions gives two sets of columns, one per function', () => {
    const two: PivotModel = { ...model, columns: [], values: [{ field: 'amount', aggFunc: 'sum' }, { field: 'amount', aggFunc: 'avg' }] }
    const { result } = renderHook(() => useGrid<Sale>(opts(two)))
    const cols = result.current.layout.all.filter((c) => c.pivot)
    expect(cols.map((c) => c.headerName)).toEqual(['amount (sum)', 'amount (avg)'])
    const top = result.current.result.rows[0]!
    expect(top.groupValue).toBe('N')
    expect(top.aggregates![cols[0]!.field]).toBe(40)
    expect(top.aggregates![cols[1]!.field]).toBe(20)
  })

  it('hiding every value empties the table columns', () => {
    const { result } = renderHook(() => useGrid<Sale>(opts(model)))
    act(() => result.current.api.setPivotModel((m) => setPivotHidden(m, { section: 'values', index: 0 }, true)))
    expect(result.current.layout.all.filter((c) => c.pivot)).toHaveLength(0)
  })
})
