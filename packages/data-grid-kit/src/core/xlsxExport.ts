import { optionLabel, optionValue } from './columns'
import { getCellValue } from './values'
import type { XlsxWorkerLike } from './xlsxWorkerClient'
import type { XlsxColumn, XlsxOptions, XlsxRow, XlsxSheet, XlsxValue } from './xlsx'
import type { ColumnDef, RenderRow, RowId } from './types'

export interface XlsxExportOptions extends XlsxOptions {
  /** worksheet name (default "Sheet1") */
  sheetName?: string
  /** write the title row and column group rows (default true) */
  includeHeaders?: boolean
  /** only the selected rows (rows that are not groups) */
  selectedOnly?: boolean
  /** write numbers, dates and booleans as formatted text, like the grid shows them (default false: typed cells) */
  formatted?: boolean
  /** number formats by field, e.g. `{ salary: '$#,##0' }`. Dates default to `yyyy-mm-dd`. */
  numFmts?: Record<string, string>
  /** keep the header rows in view (default true) */
  freezeHeader?: boolean
  /** filter buttons on the title row (default false) */
  autoFilter?: boolean
  /** file name for `exportXlsx` (default "export.xlsx") */
  fileName?: string
  /**
   * Build the file in a web worker, so a big export does not touch the page's main thread. You create the worker:
   * `() => new Worker(new URL('data-grid-kit/xlsx-worker', import.meta.url), { type: 'module' })`.
   */
  worker?: () => XlsxWorkerLike
}

const textOf = <R>(col: ColumnDef<R>, row: R, value: unknown): string => {
  if (col.valueFormatter) return col.valueFormatter(value, row)
  if (value == null) return ''
  if (col.type === 'singleSelect' && col.valueOptions) {
    const hit = col.valueOptions.find((o) => optionValue(o) === value)
    if (hit !== undefined) return String(optionLabel(hit))
  }
  if (value instanceof Date) return value.toLocaleDateString()
  return String(value)
}

/** One cell of a data row: typed for numbers, booleans and dates, formatted text for the rest. */
function dataCell<R>(col: ColumnDef<R>, row: R, formatted: boolean): XlsxValue {
  const value = getCellValue(col, row)
  if (value == null || value === '') return null
  if (!formatted) {
    if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return value
  }
  return textOf(col, row, value)
}

/** One cell of an aggregate (a group row, a tree parent, the total): values come straight from the aggregation. */
function aggregateCell<R>(col: ColumnDef<R>, value: unknown, formatted: boolean): XlsxValue {
  if (value == null || value === '') return null
  if (!formatted && (typeof value === 'number' || value instanceof Date)) return value
  if (col.valueFormatter) {
    try {
      return col.valueFormatter(value, undefined as never)
    } catch {
      /* a formatter that needs the row can't format an aggregate */
    }
  }
  return value instanceof Date ? value.toLocaleDateString() : String(value)
}

/**
 * The worksheet for what the grid shows: `columns` in visual order, one row per node of `rows` (leaves, group rows
 * with their aggregates, tree parents), and a total row when there are totals. Group levels become outline levels.
 */
export function sheetOfGrid<R>(input: {
  columns: ColumnDef<R>[]
  rows: RenderRow<R>[]
  totals?: Record<string, unknown>
  /** how wide a column is on screen, in px */
  widthOf: (field: string) => number
  selection?: ReadonlySet<RowId>
  options: XlsxExportOptions
}): XlsxSheet {
  const { columns, rows, totals, options } = input
  const formatted = !!options.formatted
  const sheetColumns: XlsxColumn[] = columns.map((c) => ({
    header: c.headerName ?? c.field,
    group: c.group,
    width: Math.min(255, Math.max(6, input.widthOf(c.field) / 7.5)), // ~7.5 px per Excel character
    numFmt: options.numFmts?.[c.field],
  }))
  const label = (r: RenderRow<R>) => (r.groupValue == null || r.groupValue === '' ? '(empty)' : r.groupValue instanceof Date ? r.groupValue.toLocaleDateString() : String(r.groupValue))

  function* generate(): Generator<XlsxRow> {
    for (const r of rows) {
      const isGroup = r.type === 'group' && r.row === undefined
      if (input.selection && !isGroup && !input.selection.has(r.id)) continue
      const cells: XlsxValue[] = new Array(columns.length)
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]!
        const agg = r.aggregates
        if (agg && col.field in agg) cells[i] = aggregateCell(col, agg[col.field], formatted)
        else if (isGroup) cells[i] = i === 0 ? label(r) : null
        else if (r.row !== undefined) cells[i] = dataCell(col, r.row, formatted)
        else cells[i] = null
      }
      if (isGroup && cells[0] == null) cells[0] = label(r)
      yield { cells, level: r.depth, bold: isGroup || undefined }
    }
    if (totals && Object.keys(totals).length) {
      yield { cells: columns.map((c, i) => (i === 0 ? 'Total' : aggregateCell(c, totals[c.field], formatted))), bold: true }
    }
  }

  return {
    name: options.sheetName,
    columns: sheetColumns,
    rows: { [Symbol.iterator]: generate },
    headers: options.includeHeaders,
    freezeHeader: options.freezeHeader,
    autoFilter: options.autoFilter,
  }
}
