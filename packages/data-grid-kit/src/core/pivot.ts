import { aggregationLabel, isBuiltinAggregation } from './aggregation'
import type { PivotColumn, PivotInput } from './pipeline'
import { isPivotValueField } from './pipeline/contract'
import type { ColumnDef, PivotModel } from './types'
import { moveValueEntry, visiblePivot } from './pivotModel'
import type { GridLocaleText } from './localeText'

/** field of the column that carries the row group labels in pivot mode */
export const PIVOT_ROWS_FIELD = '__gk_pivot_rows__'

const title = (c: ColumnDef) => c.headerName ?? c.field

/**
 * Columns a date column offers to the pivot panel: its year and its quarter. They are ordinary columns with a
 * getter, so they can be rows, columns or values like any other.
 */
export function defaultPivotDerived<R>(col: ColumnDef<R>, text?: Pick<GridLocaleText, 'pivotYear' | 'pivotQuarter' | 'pivotQuarterValue'>): ColumnDef<R>[] | undefined {
  if (col.type !== 'date') return undefined
  const date = (row: R) => {
    const v = col.valueGetter ? col.valueGetter(row) : (row as Record<string, unknown>)[col.field]
    const d = v instanceof Date ? v : v == null || v === '' ? null : new Date(v as string | number)
    return d && !Number.isNaN(d.getTime()) ? d : null
  }
  return [
    { field: `${col.field}-year`, headerName: text ? text.pivotYear(title(col)) : `${title(col)} (year)`, valueGetter: (row) => date(row)?.getFullYear() ?? null },
    { field: `${col.field}-quarter`, headerName: text ? text.pivotQuarter(title(col)) : `${title(col)} (quarter)`, valueGetter: (row) => { const d = date(row); if (!d) return null; const q = Math.floor(d.getMonth() / 3) + 1; return text ? text.pivotQuarterValue(q) : `Q${q}` } },
  ]
}

/** the columns plus whatever `derive` makes of them, skipping a derived field that already exists */
export function withDerivedColumns<R>(
  columns: ColumnDef<R>[],
  derive: false | ((col: ColumnDef<R>) => ColumnDef<R>[] | undefined) | undefined,
  text?: Pick<GridLocaleText, 'pivotYear' | 'pivotQuarter' | 'pivotQuarterValue'>,
): ColumnDef<R>[] {
  if (derive === false) return columns
  const fn = derive ?? ((col: ColumnDef<R>) => defaultPivotDerived(col, text))
  const have = new Set(columns.map((c) => c.field))
  const out = columns.slice()
  for (const c of columns) {
    for (const d of fn(c) ?? []) {
      if (have.has(d.field)) continue
      have.add(d.field)
      out.push({ ...d, hidden: true })
    }
  }
  return out
}

/** What the pipeline needs to know about a pivot model: fields that don't exist or can't be aggregated are dropped there. */
export function pivotInputOf(model: PivotModel, totals: boolean): PivotInput {
  const { columns, values } = visiblePivot(model)
  return {
    columns: columns.map((c) => ({ field: c.field, sort: c.sort })),
    values: values.filter((v) => isBuiltinAggregation(v.aggFunc)).map((v) => ({ field: v.field, aggFunc: v.aggFunc })),
    totals,
  }
}

/** The columns a pivot table shows: the row-label column, then one column per `PivotColumn`, grouped by header. */
export function buildPivotColumns<R>(
  pivotColumns: PivotColumn[],
  source: ColumnDef<R>[],
  model: PivotModel,
  overrides?: (field: string, path: string[]) => Partial<ColumnDef<R>> | undefined,
  text?: Pick<GridLocaleText, 'pivotRowsHeader' | 'pivotTotalGroup' | 'aggregationSum' | 'aggregationAvg' | 'aggregationMin' | 'aggregationMax' | 'aggregationCount' | 'aggregationSize'>,
): ColumnDef<R>[] {
  const byField = new Map(source.map((c) => [c.field, c]))
  const rowsTitle = visiblePivot(model).rows.map((f) => (byField.has(f) ? title(byField.get(f)!) : f)).join(' / ')
  const out: ColumnDef<R>[] = [
    {
      field: PIVOT_ROWS_FIELD,
      headerName: rowsTitle || (text?.pivotRowsHeader ?? 'Rows'),
      width: 220,
      filterable: false,
      editable: false,
      aggregable: false,
      pinnable: true,
      reorderable: false,
      valueGetter: () => undefined,
    },
  ]
  for (const pc of pivotColumns) {
    const orig = byField.get(pc.valueField)
    if (!orig) continue
    out.push({
      field: pc.field,
      headerName: `${title(orig)} (${text ? aggregationLabel(pc.aggFunc, undefined, text) : pc.aggFunc})`,
      group: pc.total ? [text?.pivotTotalGroup ?? 'Total'] : pc.path,
      type: 'number',
      width: Math.max(orig.width ?? 0, 130),
      minWidth: orig.minWidth,
      valueFormatter: orig.valueFormatter,
      sortable: true, // orders the groups by this column's aggregate
      filterable: false,
      editable: false,
      aggregable: false,
      reorderable: false,
      pinnable: false,
      pivot: { valueField: pc.valueField, aggFunc: pc.aggFunc, total: pc.total },
      ...overrides?.(pc.valueField, pc.path),
    } as ColumnDef<R>)
  }
  return out
}

/** The sort the pipeline gets: clicking the row-label column sorts every row level the same way. */
export function pivotSortOf(sortModel: { field: string; direction: 'asc' | 'desc' }[], rows: string[]) {
  const s = sortModel.find((x) => x.field === PIVOT_ROWS_FIELD)
  const direction = s?.direction ?? 'asc'
  return rows.map((field) => ({ field, direction }))
}

/** Clicking a value column's header orders the groups of every level by its aggregate: the first such sort wins. */
export function pivotAggSortOf(sortModel: { field: string; direction: 'asc' | 'desc' }[]) {
  const s = sortModel.find((x) => isPivotValueField(x.field))
  return s ? { field: s.field, direction: s.direction } : undefined
}

export type PivotSection = 'rows' | 'columns' | 'values'

/**
 * Move a field to a section of the pivot model, before another field of that section (or at the end), or out of the
 * model with `to = null`. A field is in at most one of rows / columns / values, so it leaves the one it was in; values
 * may hold it several times (one entry per function), and moving a field inside `values` moves its first entry only.
 * Moving inside a section keeps the entry's own settings (a column's sort, a value's function, hidden); entering
 * `values` gets `defaultFunc(field)`. Returns the same object when nothing would change.
 */
export function movePivotField(
  model: PivotModel,
  field: string,
  to: PivotSection | null,
  before: string | null = null,
  defaultFunc: (field: string) => string = () => 'sum',
): PivotModel {
  if (before === field) return model // dropped on itself
  if (to === 'values') {
    const from = model.values.findIndex((v) => v.field === field)
    if (from >= 0) {
      const target = before === null ? -1 : model.values.findIndex((v) => v.field === before)
      return moveValueEntry(model, from, target < 0 ? null : target)
    }
  }
  const keptColumn = model.columns.find((c) => c.field === field)
  const keptValue = model.values.find((v) => v.field === field)
  const rows = model.rows.filter((f) => f !== field)
  const columns = model.columns.filter((c) => c.field !== field)
  const values = model.values.filter((v) => v.field !== field)
  const hiddenRows = (model.hiddenRows ?? []).filter((f) => f !== field || (to === 'rows' && model.rows.includes(field)))
  const at = <T>(list: T[], key: (x: T) => string): number => {
    const i = before && before !== field ? list.findIndex((x) => key(x) === before) : -1
    return i < 0 ? list.length : i
  }
  if (to === 'rows') rows.splice(at(rows, (f) => f), 0, field)
  else if (to === 'columns') columns.splice(at(columns, (c) => c.field), 0, keptColumn ?? { field })
  else if (to === 'values') values.splice(at(values, (v) => v.field), 0, keptValue ?? { field, aggFunc: defaultFunc(field) })
  const old = model.hiddenRows ?? []
  const same =
    rows.length === model.rows.length &&
    rows.every((f, i) => f === model.rows[i]) &&
    columns.length === model.columns.length &&
    columns.every((c, i) => c === model.columns[i]) &&
    values.length === model.values.length &&
    values.every((v, i) => v === model.values[i]) &&
    hiddenRows.length === old.length
  return same ? model : { rows, columns, values, ...(hiddenRows.length ? { hiddenRows } : {}) }
}
