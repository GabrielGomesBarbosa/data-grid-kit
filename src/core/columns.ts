import type { ColumnDef, ColumnType, FilterItem, FilterOperator } from './types'

export interface OperatorInfo {
  value: FilterOperator
  label: string
  /** operators without an operand (isEmpty…) hide the value input */
  needsValue: boolean
}

const op = (value: FilterOperator, label: string, needsValue = true): OperatorInfo => ({ value, label, needsValue })

const TEXT: OperatorInfo[] = [
  op('contains', 'contains'),
  op('equals', 'equals'),
  op('startsWith', 'starts with'),
  op('endsWith', 'ends with'),
  op('isEmpty', 'is empty', false),
  op('isNotEmpty', 'is not empty', false),
]
const ORDERED: OperatorInfo[] = [
  op('equals', '='),
  op('gt', '>'),
  op('gte', '≥'),
  op('lt', '<'),
  op('lte', '≤'),
  op('isEmpty', 'is empty', false),
  op('isNotEmpty', 'is not empty', false),
]
const EQUALITY: OperatorInfo[] = [op('equals', 'is')]

export function getColumnType(col: Pick<ColumnDef, 'type'>): ColumnType {
  return col.type ?? 'string'
}

export function getFilterOperators(col: Pick<ColumnDef, 'type'>): OperatorInfo[] {
  switch (getColumnType(col)) {
    case 'number':
    case 'date':
      return ORDERED
    case 'boolean':
    case 'singleSelect':
      return EQUALITY
    default:
      return TEXT
  }
}

export function operatorNeedsValue(operator: FilterOperator): boolean {
  return operator !== 'isEmpty' && operator !== 'isNotEmpty'
}

/** Parse `yyyy-mm-dd` as a local date (new Date('2020-01-01') would be UTC and shift a day). */
export function parseDateInput(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDateInput(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

/** Turn what a filter input produced (always text) into the type the column compares. */
export function coerceFilterValue(col: Pick<ColumnDef, 'type'>, value: unknown): unknown {
  if (value == null || value === '') return value
  switch (getColumnType(col)) {
    case 'number': {
      const n = Number(value)
      return Number.isNaN(n) ? undefined : n
    }
    case 'date':
      return value instanceof Date ? value : (parseDateInput(String(value)) ?? undefined)
    default:
      return value
  }
}

export function defaultFilterItem(col: ColumnDef): FilterItem {
  return { field: col.field, operator: getFilterOperators(col)[0]!.value, value: '' }
}

export function defaultAlign(col: Pick<ColumnDef, 'type' | 'align'>): 'left' | 'right' | 'center' {
  if (col.align) return col.align
  const t = getColumnType(col)
  return t === 'number' ? 'right' : t === 'boolean' ? 'center' : 'left'
}

export function optionValue(o: string | number | { value: string | number; label: string }) {
  return typeof o === 'object' ? o.value : o
}
export function optionLabel(o: string | number | { value: string | number; label: string }) {
  return typeof o === 'object' ? o.label : String(o)
}
