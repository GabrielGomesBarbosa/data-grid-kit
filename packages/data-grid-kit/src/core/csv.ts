import { getCellValue } from './pipeline'
import { formatDateTimeInput, getColumnType } from './columns'
import type { ColumnDef } from './types'

export interface CsvOptions {
  delimiter?: string
  includeHeaders?: boolean
  /** UTF-8 byte-order mark so Excel opens accents correctly (default true) */
  bom?: boolean
  /**
   * Prefix text cells that start with = + - @ so spreadsheets don't run them as formulas
   * (CSV injection). Numbers are never touched. Default true.
   */
  escapeFormulas?: boolean
  /** use formatted text (valueFormatter) instead of raw values (default false) */
  formatted?: boolean
}

const FORMULA_START = /^[=+\-@\t\r]/

function cellText<R>(col: ColumnDef<R>, row: R, opts: CsvOptions): { text: string; numeric: boolean } {
  const value = getCellValue(col, row)
  if (opts.formatted && col.valueFormatter) return { text: col.valueFormatter(value, row), numeric: false }
  if (value == null) return { text: '', numeric: false }
  if (value instanceof Date) {
    const type = getColumnType(col)
    // a date-time is written as it is on screen (local time), with seconds: `2024-03-07T18:45:00`
    if (type === 'dateTime') return { text: `${formatDateTimeInput(value)}:${String(value.getSeconds()).padStart(2, '0')}`, numeric: false }
    return { text: value.toISOString().slice(0, type === 'date' ? 10 : 19), numeric: false }
  }
  if (typeof value === 'number' || typeof value === 'boolean') return { text: String(value), numeric: true }
  return { text: String(value), numeric: false }
}

function quote(text: string, delimiter: string): string {
  return text.includes(delimiter) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv<R>(columns: ColumnDef<R>[], rows: R[], options: CsvOptions = {}): string {
  const delimiter = options.delimiter ?? ','
  const lines: string[] = []
  if (options.includeHeaders !== false) {
    lines.push(columns.map((c) => quote(c.headerName ?? c.field, delimiter)).join(delimiter))
  }
  const guard = options.escapeFormulas !== false
  for (const row of rows) {
    const cells = columns.map((col) => {
      let { text, numeric } = cellText(col, row, options)
      if (guard && !numeric && FORMULA_START.test(text)) text = `'${text}`
      return quote(text, delimiter)
    })
    lines.push(cells.join(delimiter))
  }
  const body = lines.join('\r\n')
  return options.bom === false ? body : `﻿${body}`
}
