import { coerceFilterValue } from '../columns'
import { type ColumnDef, type FilterItem, type FilterModel } from '../types'
import { isNil, compareValues, formatCellValue, getCellValue } from '../values'

/* ------------------------------------------------------------------ filter */

/** letters without their accents ("café" → "cafe"), for `ignoreDiacritics` */
export const foldDiacritics = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** the values of an "is any of" filter: an array, or text with commas */
function listOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return typeof value === 'string' ? value.split(',').map((x) => x.trim()).filter((x) => x !== '') : value == null ? [] : [value]
}

export function matchesItem<R>(item: FilterItem, col: ColumnDef<R>, row: R, ignoreDiacritics = false): boolean {
  const raw = getCellValue(col, row)
  const { operator } = item
  // an operator of the column's own: its function decides (one without a function falls back to the built-in logic of its value)
  const own = col.filterOperators?.find((o) => o.value === operator)
  if (own?.getApplyFilterFn) {
    const fn = own.getApplyFilterFn(item, col)
    return fn ? fn(raw, row) : true // null: not complete yet, no filtering
  }
  if (operator === 'isEmpty') return isNil(raw)
  if (operator === 'isNotEmpty') return !isNil(raw)
  const fold = (t: string) => (ignoreDiacritics ? foldDiacritics(t) : t)
  if (operator === 'isAnyOf') {
    const wanted = listOf(item.value).map((v) => coerceFilterValue(col, v)).filter((v) => !isNil(v))
    if (wanted.length === 0) return true // incomplete filter: ignore
    if (isNil(raw)) return false
    const text = fold(String(raw).toLowerCase())
    return wanted.some((v) => (typeof v === 'number' || v instanceof Date ? compareValues(raw, v) === 0 : fold(String(v).toLowerCase()) === text))
  }
  const value = coerceFilterValue(col, item.value)
  if (isNil(value)) return true // incomplete filter: ignore
  if (operator === 'gt' || operator === 'gte' || operator === 'lt' || operator === 'lte') {
    if (isNil(raw)) return false
    const cmp = compareValues(raw, value)
    return operator === 'gt' ? cmp > 0 : operator === 'gte' ? cmp >= 0 : operator === 'lt' ? cmp < 0 : cmp <= 0
  }
  if ((operator === 'equals' || operator === 'notEquals') && (typeof value === 'number' || value instanceof Date)) {
    const same = !isNil(raw) && compareValues(raw, value) === 0
    return operator === 'equals' ? same : !same
  }
  const text = fold(String(raw ?? '').toLowerCase())
  const needle = fold(String(value).toLowerCase())
  switch (operator) {
    case 'contains':
      return text.includes(needle)
    case 'doesNotContain':
      return !text.includes(needle)
    case 'equals':
      return text === needle
    case 'notEquals':
      return text !== needle
    case 'startsWith':
      return text.startsWith(needle)
    case 'endsWith':
      return text.endsWith(needle)
    default:
      return true // an operator nothing here knows: ignore, like an incomplete filter
  }
}

/** how the quick filter reads its input and which columns it looks at (see `GridOptions`) */
export interface QuickFilterOptions {
  /** turns what was typed into the terms to look for (default: split on spaces) */
  parser?: (input: string) => string[]
  /** `'or'`: a row needs one of the terms (default `'and'`: all of them) */
  logic?: 'and' | 'or'
  /** also look in columns that start hidden (default false) */
  includeHidden?: boolean
}

export function createRowFilter<R>(
  model: FilterModel,
  columns: ColumnDef<R>[],
  ignoreDiacritics = false,
  quickOptions?: QuickFilterOptions,
): ((row: R) => boolean) | null {
  const byField = new Map(columns.map((c) => [c.field, c]))
  const items = model.items.filter((i) => byField.has(i.field))
  const fold = (t: string) => (ignoreDiacritics ? foldDiacritics(t) : t)
  const typed = model.quickFilter?.trim()
  const terms = typed ? (quickOptions?.parser ? quickOptions.parser(typed) : typed.split(/\s+/)).map((t) => fold(t.trim().toLowerCase())).filter((t) => t !== '') : []
  if (items.length === 0 && terms.length === 0) return null
  const any = quickOptions?.logic === 'or'
  // a column leaves the search with `quickFilter: false`; one with its own function is asked per term instead of read as text
  const searchable = columns.filter((c) => c.quickFilter !== false && typeof c.quickFilter !== 'function' && (quickOptions?.includeHidden || !c.hidden))
  const custom = columns.flatMap((c) => (typeof c.quickFilter === 'function' && (quickOptions?.includeHidden || !c.hidden) ? [{ col: c, fn: c.quickFilter }] : []))
  return (row) => {
    if (items.length) {
      const test = (i: FilterItem) => matchesItem(i, byField.get(i.field)!, row, ignoreDiacritics)
      if (!(model.logic === 'or' ? items.some(test) : items.every(test))) return false
    }
    if (terms.length) {
      // build the searchable text once per row, then test every term against it
      let haystack = ''
      for (const c of searchable) haystack += fold(formatCellValue(c, row).toLowerCase()) + '\u0000'
      const has = (t: string) =>
        haystack.includes(t) || custom.some(({ col, fn }) => fn({ term: t, value: getCellValue(col, row), row }) === true)
      return any ? terms.some(has) : terms.every(has)
    }
    return true
  }
}
