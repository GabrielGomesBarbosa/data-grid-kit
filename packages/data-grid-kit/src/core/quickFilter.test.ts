import { describe, expect, it } from 'vitest'
import { createRowFilter } from './pipeline'
import type { ColumnDef } from './types'

interface R {
  name: string
  city: string
  secret: string
  code: string
}
const rows: R[] = [
  { name: 'Ana Maria', city: 'New York', secret: 'alpha', code: 'x-1' },
  { name: 'Bia', city: 'Rio', secret: 'beta', code: 'y-2' },
  { name: 'Caio', city: 'New Delhi', secret: 'gamma', code: 'z-3' },
]
const cols: ColumnDef<R>[] = [{ field: 'name' }, { field: 'city' }, { field: 'secret', hidden: true }, { field: 'code' }]
const find = (quickFilter: string, columns = cols, options?: Parameters<typeof createRowFilter<R>>[3]) =>
  rows.filter(createRowFilter({ items: [], quickFilter }, columns, false, options)!).map((r) => r.name)

describe('quick filter options', () => {
  it('by default every term must match, anywhere in the visible columns', () => {
    expect(find('new maria')).toEqual(['Ana Maria'])
    expect(find('new rio')).toEqual([])
    expect(find('alpha')).toEqual([]) // hidden column
  })

  it("logic 'or': one term is enough", () => {
    expect(find('rio caio', cols, { logic: 'or' })).toEqual(['Bia', 'Caio'])
  })

  it('includeHidden also looks in the columns that start hidden', () => {
    expect(find('alpha', cols, { includeHidden: true })).toEqual(['Ana Maria'])
  })

  it('a parser decides the terms: commas keep a term with a space whole', () => {
    const parser = (input: string) => input.split(',')
    expect(find('new york, ana', cols, { parser })).toEqual(['Ana Maria'])
    expect(find('new york', cols)).toEqual(['Ana Maria']) // the default splits it: new + york, both in the row
    expect(find('york new', cols, { parser })).toEqual([]) // as one term it is not in any cell
  })

  it('a column can leave the search, or decide for itself', () => {
    expect(find('x-1', [...cols.slice(0, 3), { field: 'code', quickFilter: false }])).toEqual([])
    const codes: ColumnDef<R>[] = [...cols.slice(0, 3), { field: 'code', quickFilter: ({ term, value }) => String(value).startsWith(`${term[0]}-`) || String(value).replace('-', '') === term }]
    expect(find('y2', codes)).toEqual(['Bia'])
    expect(find('3', codes)).toEqual([]) // a function replaces the text search for that column: 'z-3' contains it, but the function says no
  })

  it('terms are matched without accents when asked', () => {
    const accents = createRowFilter({ items: [], quickFilter: 'JOSE' }, [{ field: 'name' }], true)!
    expect([{ name: 'José' }, { name: 'Ana' }].filter(accents)).toEqual([{ name: 'José' }])
  })
})
