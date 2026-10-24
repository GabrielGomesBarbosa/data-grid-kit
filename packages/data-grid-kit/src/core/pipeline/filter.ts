import { coerceFilterValue } from '../columns'
import { type ColumnDef, type FilterItem, type FilterModel } from '../types'
import { isNil, compareValues, formatCellValue, getCellValue } from '../values'

/* ------------------------------------------------------------------ filter */

export function matchesItem<R>(item: FilterItem, col: ColumnDef<R>, row: R): boolean {
  const raw = getCellValue(col, row)
  const { operator } = item
  const value = coerceFilterValue(col, item.value)
  if (operator === 'isEmpty') return isNil(raw)
  if (operator === 'isNotEmpty') return !isNil(raw)
  if (isNil(value)) return true // incomplete filter: ignore
  if (operator === 'gt' || operator === 'gte' || operator === 'lt' || operator === 'lte') {
    if (isNil(raw)) return false
    const cmp = compareValues(raw, value)
    return operator === 'gt' ? cmp > 0 : operator === 'gte' ? cmp >= 0 : operator === 'lt' ? cmp < 0 : cmp <= 0
  }
  if (operator === 'equals' && (typeof value === 'number' || value instanceof Date)) {
    return !isNil(raw) && compareValues(raw, value) === 0
  }
  const text = String(raw ?? '').toLowerCase()
  const needle = String(value).toLowerCase()
  switch (operator) {
    case 'contains':
      return text.includes(needle)
    case 'equals':
      return text === needle
    case 'startsWith':
      return text.startsWith(needle)
    case 'endsWith':
      return text.endsWith(needle)
  }
}

export function createRowFilter<R>(
  model: FilterModel,
  columns: ColumnDef<R>[],
): ((row: R) => boolean) | null {
  const byField = new Map(columns.map((c) => [c.field, c]))
  const items = model.items.filter((i) => byField.has(i.field))
  const quick = model.quickFilter?.trim().toLowerCase()
  if (items.length === 0 && !quick) return null
  const terms = quick ? quick.split(/\s+/) : []
  const searchable = columns.filter((c) => !c.hidden)
  return (row) => {
    if (items.length) {
      const test = (i: FilterItem) => matchesItem(i, byField.get(i.field)!, row)
      if (!(model.logic === 'or' ? items.some(test) : items.every(test))) return false
    }
    if (terms.length) {
      // build the searchable text once per row, then test every term against it
      let haystack = ''
      for (const c of searchable) haystack += formatCellValue(c, row).toLowerCase() + '\u0000'
      for (const t of terms) if (!haystack.includes(t)) return false
    }
    return true
  }
}
