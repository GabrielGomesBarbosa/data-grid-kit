import { compareValues, isNil } from './values'
import type { ColumnDef, ColumnType, CustomAggregation } from './types'

export type BuiltinAggregation = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'size'

interface BuiltinInfo {
  label: string
  /** column types it applies to; null = any */
  types: ColumnType[] | null
}

export const BUILTIN_AGGREGATIONS: Record<BuiltinAggregation, BuiltinInfo> = {
  sum: { label: 'sum', types: ['number'] },
  avg: { label: 'avg', types: ['number'] },
  min: { label: 'min', types: ['number', 'date'] },
  max: { label: 'max', types: ['number', 'date'] },
  count: { label: 'count', types: null }, // non-empty values
  size: { label: 'size', types: null }, // rows
}

export const isBuiltinAggregation = (name: string): name is BuiltinAggregation => name in BUILTIN_AGGREGATIONS

export function aggregationLabel(name: string, custom?: Record<string, CustomAggregation>): string {
  if (isBuiltinAggregation(name)) return BUILTIN_AGGREGATIONS[name].label
  return custom?.[name]?.label ?? name
}

/** Functions that make sense for a column, honouring `aggregable` and `availableAggregationFunctions`. */
export function availableAggregations(
  col: Pick<ColumnDef, 'type' | 'aggregable' | 'availableAggregationFunctions'>,
  custom?: Record<string, CustomAggregation>,
): string[] {
  if (col.aggregable === false) return []
  const type = col.type ?? 'string'
  const out: string[] = []
  for (const name of Object.keys(BUILTIN_AGGREGATIONS) as BuiltinAggregation[]) {
    const types = BUILTIN_AGGREGATIONS[name].types
    if (!types || types.includes(type)) out.push(name)
  }
  for (const [name, fn] of Object.entries(custom ?? {})) {
    if (!fn.columnTypes || fn.columnTypes.includes(type)) out.push(name)
  }
  return col.availableAggregationFunctions ? out.filter((n) => col.availableAggregationFunctions!.includes(n)) : out
}

/**
 * Running totals for one column over a set of rows. One shape serves every built-in function, so
 * accumulators can be added to, subtracted from and merged without knowing which function reads them.
 */
export interface AggAcc {
  rows: number
  /** non-empty values */
  n: number
  /** finite numeric values */
  nn: number
  /** sum of the numeric values */
  s: number
  /** current min or max (whichever the function asks for) */
  v: unknown
}

export const newAcc = (): AggAcc => ({ rows: 0, n: 0, nn: 0, s: 0, v: undefined })

const isMinMax = (kind: BuiltinAggregation) => kind === 'min' || kind === 'max'
const better = (kind: BuiltinAggregation, a: unknown, than: unknown) =>
  kind === 'min' ? compareValues(a, than) < 0 : compareValues(a, than) > 0

export function accAdd(acc: AggAcc, kind: BuiltinAggregation, value: unknown): void {
  acc.rows++
  if (isNil(value)) return
  acc.n++
  if (typeof value === 'number' && Number.isFinite(value)) {
    acc.nn++
    acc.s += value
  }
  if (isMinMax(kind) && (acc.v === undefined || better(kind, value, acc.v))) acc.v = value
}

/** Take a value out. Returns true when the accumulator can no longer be trusted (min/max lost its extreme). */
export function accSub(acc: AggAcc, kind: BuiltinAggregation, value: unknown): boolean {
  acc.rows--
  if (acc.rows <= 0) {
    // nothing left: reset exactly, so float error from earlier add/sub pairs cannot linger
    acc.rows = acc.n = acc.nn = 0
    acc.s = 0
    acc.v = undefined
    return false
  }
  if (isNil(value)) return false
  acc.n--
  if (typeof value === 'number' && Number.isFinite(value)) {
    acc.nn--
    acc.s -= value
  }
  return isMinMax(kind) && acc.v !== undefined && compareValues(value, acc.v) === 0
}

export function accMerge(into: AggAcc, from: AggAcc, kind: BuiltinAggregation): void {
  into.rows += from.rows
  into.n += from.n
  into.nn += from.nn
  into.s += from.s
  if (isMinMax(kind) && from.v !== undefined && (into.v === undefined || better(kind, from.v, into.v))) into.v = from.v
}

export function accFinish(acc: AggAcc, kind: BuiltinAggregation): unknown {
  switch (kind) {
    case 'sum':
      return acc.nn > 0 ? acc.s : null
    case 'avg':
      return acc.nn > 0 ? acc.s / acc.nn : null
    case 'min':
    case 'max':
      return acc.v ?? null
    case 'count':
      return acc.n
    case 'size':
      return acc.rows
  }
}

/** Text for an aggregated value: counts as integers, otherwise through the column's formatter. */
export function formatAggregateValue(col: ColumnDef, name: string, value: unknown): string {
  if (value == null || value === '') return ''
  if (name === 'count' || name === 'size') return Number(value).toLocaleString()
  if (col.valueFormatter) {
    try {
      // aggregates have no row: formatters that only read the value work as they are
      return col.valueFormatter(value, undefined as never)
    } catch {
      /* a formatter that needs the row cannot format an aggregate: fall through */
    }
  }
  if (value instanceof Date) return value.toLocaleDateString()
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return String(value)
}
