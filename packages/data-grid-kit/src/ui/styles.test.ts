// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain ESM script without types
import { STRUCTURE, splitCss } from '../../scripts/css-split.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const inline = (file: string): string =>
  readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => {
      const m = /^@import\s+'([^']+)';\s*$/.exec(line)
      return m ? inline(resolve(dirname(file), m[1]!)) : line
    })
    .join('\n')
const all = inline(resolve(here, 'styles/index.css'))
const props = (css: string, withKeyframes = true) => {
  const out: string[] = []
  postcss.parse(css).walkDecls((d) => {
    const frame = d.parent?.parent?.type === 'atrule' && /keyframes$/.test((d.parent.parent as postcss.AtRule).name)
    if (withKeyframes || !frame) out.push(d.prop)
  })
  return out
}

describe('structure.css / theme.css', () => {
  const { structure, theme } = splitCss(all) as { structure: string; theme: string }

  it('every declaration is in exactly one of them', () => {
    const total = props(all).length
    expect(props(structure).length + props(theme).length).toBe(total)
    expect(props(structure).every((p) => STRUCTURE.has(p))).toBe(true)
    expect(props(theme, false).some((p) => STRUCTURE.has(p))).toBe(false) // animation frames excepted: they stay whole
  })

  it('structure has no colors, borders, shadows, fonts or spacing: it can be styled from scratch', () => {
    const looks = /^(color|background.*|border.*|box-shadow|font.*|padding.*|margin.*|gap|opacity|outline.*|cursor|letter-spacing|text-transform|line-height|animation|transition|--gk-.*)$/
    expect(props(structure).filter((p) => looks.test(p))).toEqual([])
  })

  it('structure keeps what makes the grid work', () => {
    for (const needle of ['position: sticky', 'overflow: auto', 'position: absolute', 'contain: layout style']) expect(structure).toContain(needle)
    expect(theme).toContain('--gk-accent')
    expect(theme).toContain('@keyframes')
  })

  it('the selectors survive the split (nothing lost, nothing renamed)', () => {
    const selectors = (css: string) => {
      const s = new Set<string>()
      postcss.parse(css).walkRules((r) => void s.add(r.selector))
      return s
    }
    const merged = new Set([...selectors(structure), ...selectors(theme)])
    for (const sel of selectors(all)) expect(merged.has(sel), sel).toBe(true)
  })

  // a host page may style every <button> and every element: the header must not pick that up
  describe('looks that do not depend on the host page', () => {
    const rule = (selector: string) => {
      let found: Record<string, string> | undefined
      postcss.parse(all).walkRules((r) => {
        if (r.selector === selector) found = Object.fromEntries((r.nodes ?? []).filter((n) => n.type === 'decl').map((d) => [(d as postcss.Declaration).prop, (d as postcss.Declaration).value]))
      })
      return found
    }
    it('the header title is a plain button: no box, no fill, not faded when it cannot sort', () => {
      expect(rule('.gk-header-title')).toMatchObject({ border: '0', background: 'transparent', padding: '0' })
      expect(rule('.gk-header-title:disabled')).toMatchObject({ opacity: '1' })
      expect(rule('.gk-header-title:hover:not(:disabled),\n.gk-header-title:active:not(:disabled)')).toMatchObject({ background: 'transparent' })
    })
    it('the column dividers are always drawn (a line inside the resize handle)', () => {
      expect(rule('.gk-resizer::after')).toMatchObject({ content: "''", width: '1px' })
    })
  })
})
