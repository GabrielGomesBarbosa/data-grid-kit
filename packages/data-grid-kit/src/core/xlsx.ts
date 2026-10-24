import { zip, type ZipEntry } from './zip'
import { escapeXml } from './xlsxXml'
import { Styles, type XlsxStyle } from './xlsxStyles'
export type { XlsxStyle } from './xlsxStyles'

/** What a cell can hold. Numbers, booleans and dates are typed cells; everything else is text. */
export type XlsxValue = string | number | boolean | Date | XlsxFormula | null | undefined

/**
 * A formula cell. Only an explicit object is a formula: text that merely starts with `=` stays text. `value` is the
 * result shown until the file is recalculated (Excel recalculates on open); the leading `=` is optional.
 */
export interface XlsxFormula {
  formula: string
  value?: number | string | boolean
}

export interface XlsxColumn {
  /** the title shown in the header row */
  header: string
  /** header groups above the title, outermost first; adjacent columns sharing a prefix are merged */
  group?: string[]
  /** width in characters (Excel units) */
  width?: number
  /** number format code, e.g. `#,##0.00` or `yyyy-mm-dd`. Dates default to `yyyy-mm-dd`. */
  numFmt?: string
  /** look of the column's cells */
  style?: XlsxStyle
  /**
   * A drop-down list of allowed values for the column's data cells. Excel's inline lists hold at most 255 characters
   * and no commas or quotes in an item: a list that does not fit is left out (the cells still hold the values).
   */
  validationList?: string[]
}

export interface XlsxRow {
  cells: XlsxValue[]
  /** outline level (0 = none): group rows can be collapsed in Excel */
  level?: number
  bold?: boolean
}

export interface XlsxSheet {
  name?: string
  columns: XlsxColumn[]
  rows: Iterable<XlsxRow>
  /** write the title row (default true) */
  headers?: boolean
  /** keep the header rows in view while scrolling (default true) */
  freezeHeader?: boolean
  /** filter buttons on the title row (default false; they would sit under merged group headers otherwise) */
  autoFilter?: boolean
  /** look of the title row (default: bold on a light fill) */
  headerStyle?: XlsxStyle
}

export interface XlsxOptions {
  compress?: boolean
  /** rows written between yields to the event loop, so a big export doesn't freeze the page (default 4000) */
  yieldEvery?: number
  signal?: AbortSignal
  /** called with the number of rows written so far */
  onProgress?: (rows: number) => void
}

export const MAX_ROWS = 1_048_576
export const MAX_COLUMNS = 16_384
const MAX_TEXT = 32_767

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const XLSX_MIME = MIME

const enc = new TextEncoder()

/** A1-style column letters: 0 → A, 26 → AA */
export function columnLetters(index: number): string {
  let s = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** days since 1899-12-30, with the time of day as the fraction. Wall-clock time: Excel has no time zones. */
export function excelSerial(d: Date): number {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds())
  const days = (utc - Date.UTC(1899, 11, 30)) / 86_400_000
  // Excel counts a 29 Feb 1900 that never existed: before March 1900 its serials are one lower
  return utc < Date.UTC(1900, 2, 1) ? days - 1 : days
}

const sheetName = (name: string) => escapeXml(name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31).replace(/^'+|'+$/g, '') || 'Sheet1')

/* -------------------------------------------------------------------- sheet */

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

interface WrittenSheet {
  name: string
  chunks: Uint8Array[]
  /** the filter range, when the sheet has one (the workbook declares it) */
  filter: { titleRow: number; lastCol: string; lastRow: number } | null
}

/**
 * One worksheet's XML. Cells are streamed into pieces row by row, so the memory used is the output itself, not an
 * object per cell. Text goes in as inline strings (never evaluated as a formula, so a value like `=1+1` stays text).
 */
async function writeSheet(sheet: XlsxSheet, styles: Styles, options: XlsxOptions): Promise<WrittenSheet> {
  const cols = sheet.columns
  if (cols.length > MAX_COLUMNS) throw new Error(`xlsx supports at most ${MAX_COLUMNS} columns (got ${cols.length})`)
  const letters = cols.map((_, i) => columnLetters(i))
  const colStyle = cols.map((c) => styles.index(c.numFmt, false, false, c.style))
  const colStyleBold = cols.map((c) => styles.index(c.numFmt, true, false, c.style))
  const dateStyle = cols.map((c) => styles.index(c.numFmt ?? 'yyyy-mm-dd', false, false, c.style))
  const dateStyleBold = cols.map((c) => styles.index(c.numFmt ?? 'yyyy-mm-dd', true, false, c.style))
  // text keeps style 0 unless the column has a look of its own
  const textStyle = cols.map((c) => (c.style ? styles.index(undefined, false, false, c.style) : 0))
  const textStyleBold = cols.map((c) => styles.index(undefined, true, false, c.style))
  const headStyle = styles.index(undefined, true, true, sheet.headerStyle)

  const chunks: Uint8Array[] = []
  let buf = ''
  const push = (s: string) => {
    buf += s
    if (buf.length > 64_000) {
      chunks.push(enc.encode(buf))
      buf = ''
    }
  }

  let rowNo = 0
  let maxLevel = 0
  const merges: string[] = []

  // header rows: one per level of column groups, then the titles
  const depth = sheet.headers === false ? 0 : cols.reduce((d, c) => Math.max(d, c.group?.length ?? 0), 0)
  const headerRows = sheet.headers === false ? 0 : depth + 1
  const textCell = (ref: string, text: string, s: number) => {
    const t = text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text
    const pre = /^\s|\s$|\n/.test(t) ? ' xml:space="preserve"' : ''
    return `<c r="${ref}" t="inlineStr"${s ? ` s="${s}"` : ''}><is><t${pre}>${escapeXml(t)}</t></is></c>`
  }
  if (headerRows) {
    for (let lv = 0; lv < depth; lv++) {
      rowNo++
      let xml = `<row r="${rowNo}">`
      let i = 0
      while (i < cols.length) {
        const g = cols[i]!.group
        if (!g || g.length <= lv) {
          xml += `<c r="${letters[i]}${rowNo}" s="${headStyle}"/>`
          i++
          continue
        }
        const key = g.slice(0, lv + 1).join('\u0000')
        let j = i + 1
        while (j < cols.length && cols[j]!.group && cols[j]!.group!.length > lv && cols[j]!.group!.slice(0, lv + 1).join('\u0000') === key) j++
        xml += textCell(`${letters[i]}${rowNo}`, g[lv]!, headStyle)
        for (let k = i + 1; k < j; k++) xml += `<c r="${letters[k]}${rowNo}" s="${headStyle}"/>`
        if (j - i > 1) merges.push(`${letters[i]}${rowNo}:${letters[j - 1]}${rowNo}`)
        i = j
      }
      push(xml + '</row>')
    }
    rowNo++
    push(`<row r="${rowNo}">${cols.map((c, i) => textCell(`${letters[i]}${rowNo}`, c.header, headStyle)).join('')}</row>`)
  }
  const titleRow = headerRows

  let written = 0
  const every = Math.max(1, options.yieldEvery ?? 4000)
  for (const row of sheet.rows) {
    if (rowNo >= MAX_ROWS) throw new Error(`xlsx supports at most ${MAX_ROWS.toLocaleString()} rows: filter the data or export in parts`)
    rowNo++
    const level = Math.min(7, Math.max(0, row.level ?? 0)) // Excel outlines go 7 deep
    if (level > maxLevel) maxLevel = level
    let xml = `<row r="${rowNo}"${level ? ` outlineLevel="${level}"` : ''}>`
    const n = Math.min(row.cells.length, cols.length)
    for (let i = 0; i < n; i++) {
      const v = row.cells[i]
      if (v === null || v === undefined || v === '') continue
      const ref = `${letters[i]}${rowNo}`
      if (typeof v === 'number') {
        if (!Number.isFinite(v)) continue
        const s = row.bold ? colStyleBold[i]! : colStyle[i]!
        xml += `<c r="${ref}"${s ? ` s="${s}"` : ''}><v>${v}</v></c>`
      } else if (typeof v === 'object' && !(v instanceof Date)) {
        xml += formulaCell(ref, v, row.bold ? colStyleBold[i]! : colStyle[i]!)
      } else if (typeof v === 'boolean') {
        xml += `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`
      } else if (v instanceof Date) {
        if (Number.isNaN(v.getTime())) continue
        xml += `<c r="${ref}" s="${row.bold ? dateStyleBold[i]! : dateStyle[i]!}"><v>${excelSerial(v)}</v></c>`
      } else {
        xml += textCell(ref, String(v), row.bold ? textStyleBold[i]! : textStyle[i]!)
      }
    }
    push(xml + '</row>')
    written++
    if (written % every === 0) {
      if (options.signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
      options.onProgress?.(written)
      await tick()
    }
  }
  if (options.signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
  options.onProgress?.(written)

  const lastCol = letters[Math.max(0, cols.length - 1)] ?? 'A'
  const freeze = sheet.freezeHeader !== false && headerRows > 0
  const filter = !!sheet.autoFilter && headerRows > 0 && !depth
  const head =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetPr><outlinePr summaryBelow="0"/></sheetPr>` +
    `<dimension ref="A1:${lastCol}${Math.max(1, rowNo)}"/>` +
    `<sheetViews><sheetView workbookViewId="0">` +
    (freeze ? `<pane ySplit="${headerRows}" topLeftCell="A${headerRows + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>` : '') +
    `</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"${maxLevel ? ` outlineLevelRow="${maxLevel}"` : ''}/>` +
    (cols.some((c) => c.width)
      ? `<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(255, Math.max(2, c.width ?? 10)).toFixed(2)}" customWidth="1"/>`).join('')}</cols>`
      : '') +
    `<sheetData>`
  const tail =
    `</sheetData>` +
    (filter ? `<autoFilter ref="A${titleRow}:${lastCol}${Math.max(titleRow, rowNo)}"/>` : '') +
    (merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '') +
    validations(cols, letters, headerRows + 1, rowNo) +
    `</worksheet>`
  return {
    name: sheetName(sheet.name ?? 'Sheet1'),
    chunks: [enc.encode(head), ...chunks, enc.encode(buf + tail)],
    filter: filter ? { titleRow, lastCol, lastRow: Math.max(titleRow, rowNo) } : null,
  }
}

/** a formula cell: the result is cached next to the formula, so viewers that do not calculate still show it */
function formulaCell(ref: string, v: XlsxFormula, s: number): string {
  if (typeof v.formula !== 'string' || !v.formula.replace(/^=/, '')) return ''
  const f = `<f>${escapeXml(v.formula.replace(/^=/, ''))}</f>`
  const style = s ? ` s="${s}"` : ''
  const r = v.value
  if (typeof r === 'number') return Number.isFinite(r) ? `<c r="${ref}"${style}>${f}<v>${r}</v></c>` : `<c r="${ref}"${style}>${f}</c>`
  if (typeof r === 'boolean') return `<c r="${ref}"${style} t="b">${f}<v>${r ? 1 : 0}</v></c>`
  if (typeof r === 'string') return `<c r="${ref}"${style} t="str">${f}<v>${escapeXml(r.slice(0, MAX_TEXT))}</v></c>`
  return `<c r="${ref}"${style}>${f}</c>`
}

/** drop-down lists for the data cells of the columns that ask for one (see `XlsxColumn.validationList`) */
function validations(cols: XlsxColumn[], letters: string[], first: number, last: number): string {
  if (last < first) return ''
  const items: string[] = []
  cols.forEach((c, i) => {
    const list = c.validationList
    if (!list?.length || list.some((x) => /[",\n\r]/.test(x) || !x) || list.join(',').length > 255) return
    items.push(
      `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${letters[i]}${first}:${letters[i]}${last}"><formula1>"${escapeXml(list.join(','))}"</formula1></dataValidation>`,
    )
  })
  return items.length ? `<dataValidations count="${items.length}">${items.join('')}</dataValidations>` : ''
}

/* ----------------------------------------------------------------- workbook */

/** a sheet name Excel accepts, made unique among the ones before it (names compare ignoring case) */
function uniqueName(name: string, taken: Set<string>): string {
  let out = name
  for (let n = 2; taken.has(out.toLowerCase()); n++) {
    const suffix = ` (${n})`
    out = name.slice(0, 31 - suffix.length) + suffix
  }
  taken.add(out.toLowerCase())
  return out
}

/** Several worksheets in one .xlsx file, in the given order. At least one sheet is needed. */
export async function buildXlsxWorkbook(sheets: XlsxSheet[], options: XlsxOptions = {}): Promise<Uint8Array> {
  if (!sheets.length) throw new Error('A workbook needs at least one sheet')
  const styles = new Styles()
  const written: WrittenSheet[] = []
  const taken = new Set<string>()
  for (const sheet of sheets) {
    const w = await writeSheet(sheet, styles, options)
    written.push({ ...w, name: uniqueName(w.name, taken) })
  }
  const small = (x: string): ZipEntry['chunks'] => [enc.encode(x)]
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const defined = written
    .map((w, i) => (w.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${w.name.replace(/'/g, "''")}'!$A$${w.filter.titleRow}:$${w.filter.lastCol}$${w.filter.lastRow}</definedName>` : ''))
    .join('')
  const entries: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      chunks: small(
        `${header}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          written.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      chunks: small(`${header}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    },
    {
      name: 'xl/workbook.xml',
      chunks: small(
        `${header}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}">` +
          `<sheets>${written.map((w, i) => `<sheet name="${w.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
          (defined ? `<definedNames>${defined}</definedNames>` : '') +
          `</workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      chunks: small(
        `${header}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          written.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
          `<Relationship Id="rId${written.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    { name: 'xl/styles.xml', chunks: small(styles.xml()) },
    ...written.map((w, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, chunks: w.chunks })),
  ]
  return zip(entries, { compress: options.compress })
}

/** One worksheet as an .xlsx file. */
export const buildXlsx = (sheet: XlsxSheet, options: XlsxOptions = {}): Promise<Uint8Array> => buildXlsxWorkbook([sheet], options)
