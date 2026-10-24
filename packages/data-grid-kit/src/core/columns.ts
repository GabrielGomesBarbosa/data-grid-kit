import type { ColumnDef, ColumnType, FilterItem, FilterModel, FilterOperator } from './types'

export interface OperatorInfo {
  value: FilterOperator | (string & Record<never, never>)
  label: string
  /** operators without an operand (isEmpty…) hide the value input */
  needsValue: boolean
}

const op = (value: OperatorInfo['value'], label: string, needsValue = true): OperatorInfo => ({ value, label, needsValue })

const TEXT: OperatorInfo[] = [
  op('contains', 'contains'),
  op('doesNotContain', 'does not contain'),
  op('equals', 'equals'),
  op('notEquals', 'does not equal'),
  op('startsWith', 'starts with'),
  op('endsWith', 'ends with'),
  op('isEmpty', 'is empty', false),
  op('isNotEmpty', 'is not empty', false),
  op('isAnyOf', 'is any of'),
]
const ORDERED: OperatorInfo[] = [
  op('equals', '='),
  op('notEquals', '≠'),
  op('gt', '>'),
  op('gte', '≥'),
  op('lt', '<'),
  op('lte', '≤'),
  op('isEmpty', 'is empty', false),
  op('isNotEmpty', 'is not empty', false),
  op('isAnyOf', 'is any of'),
]
const EQUALITY: OperatorInfo[] = [op('equals', 'is')]
const SELECT: OperatorInfo[] = [op('equals', 'is'), op('notEquals', 'is not'), op('isAnyOf', 'is any of')]

export function getColumnType(col: Pick<ColumnDef, 'type'>): ColumnType {
  return col.type ?? 'string'
}

export function getFilterOperators(col: Pick<ColumnDef, 'type' | 'filterOperators'>): OperatorInfo[] {
  if (col.filterOperators) return col.filterOperators.map((o) => op(o.value, o.label, o.needsValue ?? true))
  switch (getColumnType(col)) {
    case 'number':
    case 'date':
      return ORDERED
    case 'boolean':
      return EQUALITY
    case 'singleSelect':
      return SELECT
    default:
      return TEXT
  }
}

/** whether an operator has an operand (`false` for the built-in "is empty" / "is not empty"; a column's own operators say so themselves) */
export function operatorNeedsValue(operator: FilterItem['operator'], col?: Pick<ColumnDef, 'filterOperators'>): boolean {
  const own = col?.filterOperators?.find((o) => o.value === operator)
  if (own) return own.needsValue ?? true
  return operator !== 'isEmpty' && operator !== 'isNotEmpty'
}

/** Filter rows that actually filter: a row nothing was typed into yet does not count. */
export function activeFilterCount(model: Pick<FilterModel, 'items'>, columns?: Pick<ColumnDef, 'field' | 'filterOperators'>[]): number {
  return model.items.filter((f) => {
    const col = columns?.find((c) => c.field === f.field)
    return !operatorNeedsValue(f.operator, col) || (f.value !== undefined && f.value !== null && f.value !== '')
  }).length
}

/** Whether the filter panel or the quick filter is narrowing the rows down. */
export function isFiltering(model: FilterModel, columns?: Pick<ColumnDef, 'field' | 'filterOperators'>[]): boolean {
  return activeFilterCount(model, columns) > 0 || (model.quickFilter?.trim() ?? '') !== ''
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
