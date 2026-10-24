import { formatDateInput, getColumnType, optionLabel, optionValue, parseDateInput } from './columns'
import { getCellValue } from './values'
import type { ColumnDef } from './types'

/** Cells that contain a tab, a line break or a quote are quoted, like spreadsheets do. */
export function toTsv(matrix: string[][]): string {
  const cell = (s: string) => (/[\t\r\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return matrix.map((row) => row.map(cell).join('\t')).join('\n')
}

/** Parse text copied from a spreadsheet: tabs between cells, line breaks between rows, "quoted" cells. */
export function parseTsv(text: string): string[][] {
  if (text === '') return []
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let i = 0
  const endCell = () => {
    row.push(cell)
    cell = ''
  }
  const endRow = () => {
    endCell()
    rows.push(row)
    row = []
  }
  while (i < text.length) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        quoted = false
      } else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === '\t') endCell()
    else if (ch === '\r') {
      if (text[i + 1] === '\n') i++
      endRow()
    } else if (ch === '\n') endRow()
    else cell += ch
    i++
  }
  // a final line break ends the last row; without one, the pending cell is still a row
  if (cell !== '' || row.length > 0 || text[text.length - 1] === '\t') endRow()
  return rows
}

/** What a cell puts on the clipboard: raw values, so a paste elsewhere can read them back. */
export function cellToText<R>(col: ColumnDef<R>, row: R): string {
  const value = getCellValue(col, row)
  if (value == null) return ''
  if (value instanceof Date) return getColumnType(col) === 'date' ? formatDateInput(value) : value.toISOString()
  return String(value)
}

export type ParsedCell = { ok: true; value: unknown } | { ok: false }

/** Turn pasted text into the value a column stores. `valueParser` on the column wins. */
export function parseCellText<R>(col: ColumnDef<R>, text: string, row: R): ParsedCell {
  if (col.valueParser) {
    try {
      return { ok: true, value: col.valueParser(text, row) }
    } catch {
      return { ok: false }
    }
  }
  const t = text.trim()
  switch (getColumnType(col)) {
    case 'number': {
      if (t === '') return { ok: true, value: null }
      const n = Number(t)
      return Number.isNaN(n) ? { ok: false } : { ok: true, value: n }
    }
    case 'date': {
      if (t === '') return { ok: true, value: null }
      const d = parseDateInput(t) ?? new Date(t)
      return Number.isNaN(d.getTime()) ? { ok: false } : { ok: true, value: d }
    }
    case 'boolean': {
      if (t === '') return { ok: true, value: null }
      if (/^(true|1|yes|y|sim)$/i.test(t)) return { ok: true, value: true }
      if (/^(false|0|no|n|nao|não)$/i.test(t)) return { ok: true, value: false }
      return { ok: false }
    }
    case 'singleSelect': {
      if (t === '') return { ok: true, value: null }
      const match = (col.valueOptions ?? []).find(
        (o) => String(optionValue(o)).toLowerCase() === t.toLowerCase() || optionLabel(o).toLowerCase() === t.toLowerCase(),
      )
      return match === undefined ? { ok: false } : { ok: true, value: optionValue(match) }
    }
    default:
      return { ok: true, value: text }
  }
}

/** The value Delete / cut leaves behind. */
export function emptyValueFor<R>(col: ColumnDef<R>): unknown {
  return getColumnType(col) === 'string' ? '' : null
}
