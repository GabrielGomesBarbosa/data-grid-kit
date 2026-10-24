import { describe, expect, it } from 'vitest'
import { createRowFilter } from './pipeline'
import { getFilterOperators, isFiltering, activeFilterCount } from './columns'
import type { ColumnDef, FilterItem } from './types'

interface R {
  name: string
  age: number | null
  team: string
  day: Date
}
const cols: ColumnDef<R>[] = [
  { field: 'name', type: 'string' },
  { field: 'age', type: 'number' },
  { field: 'team', type: 'singleSelect', valueOptions: ['Data', 'Design'] },
  { field: 'day', type: 'date' },
]
const rows: R[] = [
  { name: 'José', age: 30, team: 'Data', day: new Date(2024, 0, 5) },
  { name: 'Jose Silva', age: 41, team: 'Design', day: new Date(2024, 0, 6) },
  { name: 'Ana', age: null, team: 'Data', day: new Date(2024, 1, 1) },
]
const pass = (item: FilterItem, ignoreDiacritics = false) => {
  const f = createRowFilter({ items: [item] }, cols, ignoreDiacritics)!
  return rows.filter(f).map((r) => r.name)
}

describe('more operators', () => {
  it('doesNotContain and notEquals on text', () => {
    expect(pass({ field: 'name', operator: 'doesNotContain', value: 'jos' })).toEqual(['Ana'])
    expect(pass({ field: 'name', operator: 'notEquals', value: 'ana' })).toEqual(['José', 'Jose Silva'])
  })

  it('notEquals on numbers keeps the empty ones; on a pick-one column it excludes the choice', () => {
    expect(pass({ field: 'age', operator: 'notEquals', value: '30' })).toEqual(['Jose Silva', 'Ana'])
    expect(pass({ field: 'team', operator: 'notEquals', value: 'Data' })).toEqual(['Jose Silva'])
  })

  it('isAnyOf takes an array or text with commas, by the column type', () => {
    expect(pass({ field: 'name', operator: 'isAnyOf', value: 'ana, JOSÉ' })).toEqual(['José', 'Ana'])
    expect(pass({ field: 'age', operator: 'isAnyOf', value: [30, 41] })).toEqual(['José', 'Jose Silva'])
    expect(pass({ field: 'age', operator: 'isAnyOf', value: '41,99' })).toEqual(['Jose Silva'])
    expect(pass({ field: 'day', operator: 'isAnyOf', value: '2024-01-05, 2024-02-01' })).toEqual(['José', 'Ana'])
    expect(pass({ field: 'team', operator: 'isAnyOf', value: 'Design' })).toEqual(['Jose Silva'])
  })

  it('an empty list filters nothing (the filter is not complete yet)', () => {
    expect(pass({ field: 'name', operator: 'isAnyOf', value: ' , ' })).toHaveLength(3)
    expect(pass({ field: 'name', operator: 'isAnyOf', value: '' })).toHaveLength(3)
  })

  it('the panel offers them by type', () => {
    expect(getFilterOperators({ type: 'string' }).map((o) => o.value)).toEqual(['contains', 'doesNotContain', 'equals', 'notEquals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty', 'isAnyOf'])
    expect(getFilterOperators({ type: 'singleSelect' }).map((o) => o.value)).toEqual(['equals', 'notEquals', 'isAnyOf'])
    expect(getFilterOperators({ type: 'boolean' }).map((o) => o.value)).toEqual(['equals'])
  })
})

describe('ignoreDiacritics', () => {
  it('makes accented and plain letters match, in item filters and the quick filter', () => {
    expect(pass({ field: 'name', operator: 'contains', value: 'jose' })).toEqual(['Jose Silva'])
    expect(pass({ field: 'name', operator: 'contains', value: 'jose' }, true)).toEqual(['José', 'Jose Silva'])
    expect(pass({ field: 'name', operator: 'startsWith', value: 'JOSÉ' }, true)).toEqual(['José', 'Jose Silva'])
    const quick = createRowFilter({ items: [], quickFilter: 'josé' }, cols, true)!
    expect(rows.filter(quick).map((r) => r.name)).toEqual(['José', 'Jose Silva'])
    const strict = createRowFilter({ items: [], quickFilter: 'josé' }, cols)!
    expect(rows.filter(strict).map((r) => r.name)).toEqual(['José'])
  })
})

describe('a column\'s own operators', () => {
  const between: ColumnDef<R> = {
    field: 'age',
    type: 'number',
    filterOperators: [
      ...getFilterOperators({ type: 'number' }).filter((o) => o.value === 'equals'),
      {
        value: 'between',
        label: 'between',
        getApplyFilterFn: (item) => {
          const [lo, hi] = (item.value as [number, number] | undefined) ?? []
          return lo === undefined || hi === undefined ? null : (value) => typeof value === 'number' && value >= lo && value <= hi
        },
      },
      { value: 'anything', label: 'anything', needsValue: false, getApplyFilterFn: () => () => true },
    ],
  }
  const run = (item: FilterItem) => rows.filter(createRowFilter({ items: [item] }, [between])!).map((r) => r.name)

  it('replace the built-in list in the panel', () => {
    expect(getFilterOperators(between).map((o) => o.value)).toEqual(['equals', 'between', 'anything'])
  })

  it('use their function for the cell value and the row; null means not complete', () => {
    expect(run({ field: 'age', operator: 'between', value: [35, 50] })).toEqual(['Jose Silva'])
    expect(run({ field: 'age', operator: 'between', value: [35] })).toHaveLength(3)
  })

  it('an operator without a function keeps the built-in logic of its value', () => {
    expect(run({ field: 'age', operator: 'equals', value: '30' })).toEqual(['José'])
  })

  it('count as active only when complete: operators with no operand always do', () => {
    expect(activeFilterCount({ items: [{ field: 'age', operator: 'anything' }] }, [between])).toBe(1)
    expect(activeFilterCount({ items: [{ field: 'age', operator: 'between', value: '' }] }, [between])).toBe(0)
    expect(isFiltering({ items: [{ field: 'age', operator: 'anything' }] }, [between])).toBe(true)
  })
})
