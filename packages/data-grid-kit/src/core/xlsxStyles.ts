import { escapeXml } from './xlsxXml'

/** What a column's cells (or the header) can look like. Colours are `#rrggbb`. */
export interface XlsxStyle {
  bold?: boolean
  italic?: boolean
  /** text colour */
  color?: string
  /** background colour */
  fill?: string
  align?: 'left' | 'center' | 'right'
  wrap?: boolean
}

const hex = (c: string | undefined): string | undefined => {
  const m = c && /^#?([0-9a-f]{6})$/i.exec(c)
  return m ? m[1]!.toUpperCase() : undefined
}

interface Xf {
  numFmtId: number
  fontId: number
  fillId: number
  header: boolean
  align?: string
}

/** Cell formats are registered as they are met; `index` is what a cell's `s` attribute refers to. */
export class Styles {
  private numFmts: string[] = []
  private fonts = ['<font><sz val="11"/><name val="Calibri"/></font>', '<font><b/><sz val="11"/><name val="Calibri"/></font>']
  private fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEFF1F5"/><bgColor indexed="64"/></patternFill></fill>',
  ]
  private xfs: Xf[] = [{ numFmtId: 0, fontId: 0, fillId: 0, header: false }]
  private lookup = new Map<string, number>([['0|0|0|0|', 0]])

  private fmtId(code: string | undefined): number {
    if (!code) return 0
    if (code === 'yyyy-mm-dd') return 165 // custom, registered below; keeps one code path
    let i = this.numFmts.indexOf(code)
    if (i < 0) i = this.numFmts.push(code) - 1
    return 170 + i
  }

  private register(list: string[], xml: string): number {
    const i = list.indexOf(xml)
    return i < 0 ? list.push(xml) - 1 : i
  }

  index(numFmt: string | undefined, bold = false, header = false, style?: XlsxStyle): number {
    const isBold = bold || !!style?.bold
    const color = hex(style?.color)
    const font = style?.italic || color ? this.register(this.fonts, `<font>${isBold ? '<b/>' : ''}${style?.italic ? '<i/>' : ''}<sz val="11"/>${color ? `<color rgb="FF${color}"/>` : ''}<name val="Calibri"/></font>`) : isBold ? 1 : 0
    const bg = hex(style?.fill)
    const fill = bg ? this.register(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${bg}"/><bgColor indexed="64"/></patternFill></fill>`) : header ? 2 : 0
    const align = style?.align || style?.wrap || header ? `<alignment${style?.align ? ` horizontal="${style.align}"` : ''}${header ? ' vertical="center"' : ''}${style?.wrap ? ' wrapText="1"' : ''}/>` : undefined
    const id = this.fmtId(numFmt)
    const key = `${id}|${font}|${fill}|${header ? 1 : 0}|${align ?? ''}`
    let at = this.lookup.get(key)
    if (at === undefined) {
      at = this.xfs.push({ numFmtId: id, fontId: font, fillId: fill, header, align }) - 1
      this.lookup.set(key, at)
    }
    return at
  }

  xml(): string {
    const fmts = [`<numFmt numFmtId="165" formatCode="yyyy-mm-dd"/>`, ...this.numFmts.map((c, i) => `<numFmt numFmtId="${170 + i}" formatCode="${escapeXml(c)}"/>`)]
    const xfs = this.xfs
      .map((x) => {
        const attrs =
          `numFmtId="${x.numFmtId}" fontId="${x.fontId}" fillId="${x.fillId}" borderId="${x.header ? 1 : 0}" xfId="0"` +
          `${x.numFmtId ? ' applyNumberFormat="1"' : ''}${x.fontId ? ' applyFont="1"' : ''}${x.fillId ? ' applyFill="1"' : ''}${x.header ? ' applyBorder="1"' : ''}`
        return x.align ? `<xf ${attrs} applyAlignment="1">${x.align}</xf>` : `<xf ${attrs}/>`
      })
      .join('')
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<numFmts count="${fmts.length}">${fmts.join('')}</numFmts>` +
      `<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join('')}</fills>` +
      `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>` +
      `<border><left/><right/><top/><bottom style="thin"><color rgb="FFC9CED8"/></bottom><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="${this.xfs.length}">${xfs}</cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`
    )
  }
}
