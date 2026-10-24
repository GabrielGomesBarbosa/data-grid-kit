import { describe, expect, it } from 'vitest'
import { createRowGeometry } from './geometry'

describe('row geometry without panels', () => {
  const g = createRowGeometry(36, 1000)
  it('is plain arithmetic', () => {
    expect(g.topOf(0)).toBe(0)
    expect(g.topOf(10)).toBe(360)
    expect(g.totalHeight).toBe(36000)
    expect(g.indexAt(0)).toBe(0)
    expect(g.indexAt(35.9)).toBe(0)
    expect(g.indexAt(36)).toBe(1)
    expect(g.indexAt(999999)).toBe(999) // clamped
    expect(g.indexAt(-50)).toBe(0)
    expect(g.slotsBefore(500)).toBe(0)
  })
  it('windows rows and finds no panels', () => {
    expect(g.window(0, 100)).toEqual({ start: 0, end: 3, slotStart: 0, slotEnd: 0 })
    expect(g.window(35990, 99999)).toEqual({ start: 999, end: 1000, slotStart: 0, slotEnd: 0 })
  })
  it('handles an empty grid', () => {
    const e = createRowGeometry(36, 0)
    expect(e.window(0, 500)).toEqual({ start: 0, end: 0, slotStart: 0, slotEnd: 0 })
    expect(e.totalHeight).toBe(0)
    expect(e.indexAt(10)).toBe(0)
  })
})

describe('row geometry with panels', () => {
  // rows are 10 high; row 2 owns a 100 panel, row 5 owns a 40 panel
  const g = createRowGeometry(10, 8, [{ index: 2, height: 100 }, { index: 5, height: 40 }])

  it('pushes the rows below a panel down by its height', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => g.topOf(i))).toEqual([0, 10, 20, 130, 140, 150, 200, 210])
    expect(g.totalHeight).toBe(8 * 10 + 140)
  })

  it('places each panel directly under its row', () => {
    expect(g.slotTop(0)).toBe(30) // row 2 is at 20..30, then its panel
    expect(g.slotTop(1)).toBe(160) // row 5 is at 150..160
  })

  it('finds the row owning a y, panel included', () => {
    expect(g.indexAt(5)).toBe(0)
    expect(g.indexAt(25)).toBe(2)
    expect(g.indexAt(60)).toBe(2) // inside row 2's panel
    expect(g.indexAt(129.9)).toBe(2)
    expect(g.indexAt(130)).toBe(3)
    expect(g.indexAt(170)).toBe(5) // inside row 5's panel
    expect(g.indexAt(200)).toBe(6)
  })

  it('counts panels above a row (for aria-rowindex)', () => {
    expect([0, 2, 3, 5, 6, 8].map((i) => g.slotsBefore(i))).toEqual([0, 0, 1, 1, 2, 2])
  })

  it('windows rows and the panels that touch the span', () => {
    // 100..135 shows the end of row 2's panel and row 3
    expect(g.window(100, 135)).toEqual({ start: 2, end: 4, slotStart: 0, slotEnd: 1 })
    // a span fully inside a tall panel renders that panel even though its row is above
    expect(g.window(60, 80)).toEqual({ start: 2, end: 3, slotStart: 0, slotEnd: 1 })
    // far below both panels: none
    expect(g.window(205, 300)).toEqual({ start: 6, end: 8, slotStart: 2, slotEnd: 2 })
    // both panels in view
    expect(g.window(0, 400)).toEqual({ start: 0, end: 8, slotStart: 0, slotEnd: 2 })
  })

  it('agrees with a brute-force layout for random panels', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let round = 0; round < 50; round++) {
      const count = 20 + Math.floor(rand() * 60)
      const slots = Array.from(new Set(Array.from({ length: Math.floor(rand() * 8) }, () => Math.floor(rand() * count))))
        .sort((a, b) => a - b)
        .map((index) => ({ index, height: 5 + Math.floor(rand() * 90) }))
      const geo = createRowGeometry(12, count, slots)
      // brute force: lay the rows and panels out one after another
      const tops: number[] = []
      const panelTops: number[] = []
      let y = 0
      for (let i = 0; i < count; i++) {
        tops.push(y)
        y += 12
        const s = slots.findIndex((x) => x.index === i)
        if (s >= 0) {
          panelTops[s] = y
          y += slots[s]!.height
        }
      }
      expect(geo.totalHeight).toBe(y)
      for (let i = 0; i < count; i++) expect(geo.topOf(i)).toBe(tops[i])
      slots.forEach((_, s) => expect(geo.slotTop(s)).toBe(panelTops[s]))
      for (let probe = 0; probe < 40; probe++) {
        const at = rand() * y
        let owner = 0
        for (let i = 0; i < count; i++) if (tops[i]! <= at) owner = i
        expect(geo.indexAt(at), `y=${at}`).toBe(owner)
      }
    }
  })
})

describe('rows with heights of their own', () => {
  // rows: 30, 50, 20, 40
  const heights = [30, 50, 20, 40]
  const g = createRowGeometry(36, 4, [], heights)

  it('positions are the sums of the heights above', () => {
    expect([0, 1, 2, 3].map(g.topOf)).toEqual([0, 30, 80, 100])
    expect([0, 1, 2, 3].map(g.heightOf)).toEqual(heights)
    expect(g.totalHeight).toBe(140)
  })

  it('finds the row at a y, on and between the edges, clamped at the ends', () => {
    expect(g.indexAt(0)).toBe(0)
    expect(g.indexAt(29.9)).toBe(0)
    expect(g.indexAt(30)).toBe(1)
    expect(g.indexAt(79)).toBe(1)
    expect(g.indexAt(80)).toBe(2)
    expect(g.indexAt(139)).toBe(3)
    expect(g.indexAt(9999)).toBe(3)
    expect(g.indexAt(-5)).toBe(0)
  })

  it('windows the rows that touch the span', () => {
    expect(g.window(35, 85)).toEqual({ start: 1, end: 3, slotStart: 0, slotEnd: 0 })
  })

  it('without heights, heightOf is the fixed height', () => {
    expect(createRowGeometry(36, 4).heightOf(2)).toBe(36)
  })

  it('combines with detail panels: a panel sits right under its own, taller or shorter, row', () => {
    const both = createRowGeometry(36, 4, [{ index: 1, height: 100 }], heights)
    expect(both.topOf(1)).toBe(30)
    expect(both.slotTop(0)).toBe(80) // under row 1 (30 + 50)
    expect(both.topOf(2)).toBe(180) // row 2 starts under the panel
    expect(both.topOf(3)).toBe(200)
    expect(both.totalHeight).toBe(240)
    expect(both.indexAt(100)).toBe(1) // inside the panel: still row 1's band
    expect(both.indexAt(180)).toBe(2)
    expect(both.window(90, 170)).toEqual({ start: 1, end: 2, slotStart: 0, slotEnd: 1 })
  })

  it('agrees with a brute-force scan for random heights and panels', () => {
    let seed = 7
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32
    for (let round = 0; round < 40; round++) {
      const n = 1 + Math.floor(rnd() * 60)
      const hs = Array.from({ length: n }, () => 10 + Math.floor(rnd() * 90))
      const slots = Array.from({ length: n }, (_, i) => i)
        .filter(() => rnd() < 0.2)
        .map((index) => ({ index, height: 20 + Math.floor(rnd() * 100) }))
      const geo = createRowGeometry(36, n, slots, hs)
      let y = 0
      for (let i = 0; i < n; i++) {
        expect(geo.topOf(i)).toBe(y)
        const band = hs[i]! + (slots.find((s) => s.index === i)?.height ?? 0)
        for (const at of [y, y + band - 1]) expect(geo.indexAt(at)).toBe(i)
        y += band
      }
      expect(geo.totalHeight).toBe(y)
    }
  })
})
