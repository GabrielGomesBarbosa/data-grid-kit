import { formatDate, formatDateTime } from './localeText'
import type { ColumnDef } from './types'

/* ------------------------------------------------------------------ values */

export function getCellValue<R>(col: ColumnDef<R>, row: R): unknown {
  return col.valueGetter ? col.valueGetter(row) : (row as Record<string, unknown>)[col.field]
}

export function formatCellValue<R>(col: ColumnDef<R>, row: R, locale?: string): string {
  const value = getCellValue(col, row)
  if (col.valueFormatter) return col.valueFormatter(value, row)
  if (value == null) return ''
  if (value instanceof Date) return col.type === 'dateTime' ? formatDateTime(value, locale) : formatDate(value, locale)
  return String(value)
}

export const isNil = (v: unknown) => v == null || v === ''

// one collator for the whole module: String#localeCompare re-resolves locale data on every call
export const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function compareValues(a: unknown, b: unknown): number {
  const aNil = isNil(a)
  const bNil = isNil(b)
  if (aNil || bNil) return aNil && bNil ? 0 : aNil ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return collator.compare(String(a), String(b))
}

