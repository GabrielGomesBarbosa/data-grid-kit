import { zip, type ZipEntry } from './zip'

/** What a cell can hold. Numbers, booleans and dates are typed cells; everything else is text. */
export type XlsxValue = string | number | boolean | Date | null | undefined

export interface XlsxColumn {
  /** the title shown in the header row */
  header: string
  /** header groups above the title, outermost first; adjacent columns sharing a prefix are merged */
  group?: string[]
  /** width in characters (Excel units) */
  width?: number
  /** number format code, e.g. `#,##0.00` or `yyyy-mm-dd`. Dates default to `yyyy-mm-dd`. */
  numFmt?: string
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

// characters XML 1.0 cannot carry (control characters, lone surrogates, U+FFFE/FFFF)
const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g
const escapeXml = (s: string) => s.replace(ILLEGAL, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** days since 1899-12-30, with the time of day as the fraction. Wall-clock time: Excel has no time zones. */
export function excelSerial(d: Date): number {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds())
  const days = (utc - Date.UTC(1899, 11, 30)) / 86_400_000
  // Excel counts a 29 Feb 1900 that never existed: before March 1900 its serials are one lower
  return utc < Date.UTC(1900, 2, 1) ? days - 1 : days
}

const sheetName = (name: string) => escapeXml(name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31).replace(/^'+|'+$/g, '') || 'Sheet1')

/* ------------------------------------------------------------------ styles */

/** Cell formats are registered as they are met; `index` is what a cell's `s` attribute refers to. */
class Styles {
  private numFmts: string[] = []
  private xfs: { numFmtId: number; bold: boolean; header: boolean }[] = [{ numFmtId: 0, bold: false, header: false }]
  private lookup = new Map<string, number>([['0|0|0', 0]])

  private fmtId(code: string | undefined): number {
    if (!code) return 0
    if (code === 'yyyy-mm-dd') return 165 // custom, registered below; keeps one code path
    let i = this.numFmts.indexOf(code)
    if (i < 0) i = this.numFmts.push(code) - 1
    return 170 + i
  }

  index(numFmt: string | undefined, bold = false, header = false): number {
    const id = this.fmtId(numFmt)
    const key = `${id}|${bold ? 1 : 0}|${header ? 1 : 0}`
    let at = this.lookup.get(key)
    if (at === undefined) {
      at = this.xfs.push({ numFmtId: id, bold, header }) - 1
      this.lookup.set(key, at)
    }
    return at
  }

  xml(): string {
    const fmts = [`<numFmt numFmtId="165" formatCode="yyyy-mm-dd"/>`, ...this.numFmts.map((c, i) => `<numFmt numFmtId="${170 + i}" formatCode="${escapeXml(c)}"/>`)]
    const xfs = this.xfs
      .map((x) => {
        const attrs = `numFmtId="${x.numFmtId}" fontId="${x.bold ? 1 : 0}" fillId="${x.header ? 2 : 0}" borderId="${x.header ? 1 : 0}" xfId="0"${x.numFmtId ? ' applyNumberFormat="1"' : ''}${x.bold ? ' applyFont="1"' : ''}${x.header ? ' applyFill="1" applyBorder="1"' : ''}`
        return x.header ? `<xf ${attrs} applyAlignment="1"><alignment vertical="center"/></xf>` : `<xf ${attrs}/>`
      })
      .join('')
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<numFmts count="${fmts.length}">${fmts.join('')}</numFmts>` +
      `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
      `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
      `<fill><patternFill patternType="solid"><fgColor rgb="FFEFF1F5"/><bgColor indexed="64"/></patternFill></fill></fills>` +
      `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>` +
      `<border><left/><right/><top/><bottom style="thin"><color rgb="FFC9CED8"/></bottom><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="${this.xfs.length}">${xfs}</cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`
    )
  }
}

/* -------------------------------------------------------------------- sheet */

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

/**
 * Write one worksheet as an .xlsx file. Cells are streamed into XML pieces row by row, so the memory used is the
 * output itself, not an object per cell. Text goes in as inline strings (never evaluated as a formula, so a value
 * like `=1+1` stays text).
 */
export async function buildXlsx(sheet: XlsxSheet, options: XlsxOptions = {}): Promise<Uint8Array> {
  const cols = sheet.columns
  if (cols.length > MAX_COLUMNS) throw new Error(`xlsx supports at most ${MAX_COLUMNS} columns (got ${cols.length})`)
  const styles = new Styles()
  const letters = cols.map((_, i) => columnLetters(i))
  const colStyle = cols.map((c) => styles.index(c.numFmt))
  const colStyleBold = cols.map((c) => styles.index(c.numFmt, true))
  const dateStyle = cols.map((c) => styles.index(c.numFmt ?? 'yyyy-mm-dd'))
  const dateStyleBold = cols.map((c) => styles.index(c.numFmt ?? 'yyyy-mm-dd', true))
  const headStyle = styles.index(undefined, true, true)

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
      } else if (typeof v === 'boolean') {
        xml += `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`
      } else if (v instanceof Date) {
        if (Number.isNaN(v.getTime())) continue
        xml += `<c r="${ref}" s="${row.bold ? dateStyleBold[i]! : dateStyle[i]!}"><v>${excelSerial(v)}</v></c>`
      } else {
        xml += textCell(ref, String(v), row.bold ? colStyleBold[i]! : 0)
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
    `</worksheet>`
  const sheetChunks = [enc.encode(head), ...chunks, enc.encode(buf + tail)]

  const name = sheetName(sheet.name ?? 'Sheet1')
  const small = (s: string): ZipEntry['chunks'] => [enc.encode(s)]
  const entries: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      chunks: small(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      chunks: small(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: 'xl/workbook.xml',
      chunks: small(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets>` +
          (filter ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${name.replace(/'/g, "''")}'!$A$${titleRow}:$${lastCol}$${Math.max(titleRow, rowNo)}</definedName></definedNames>` : '') +
          `</workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      chunks: small(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
          `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    { name: 'xl/styles.xml', chunks: small(styles.xml()) },
    { name: 'xl/worksheets/sheet1.xml', chunks: sheetChunks },
  ]
  return zip(entries, { compress: options.compress })
}
