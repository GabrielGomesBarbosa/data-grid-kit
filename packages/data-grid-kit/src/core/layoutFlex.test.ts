import { describe, expect, it } from 'vitest'
import { computeColumnLayout } from './layout'
import type { ColumnDef } from './types'

const state = { columnOrder: [] as string[], columnWidths: {} as Record<string, number>, columnVisibility: {}, pinnedColumns: { left: [] as string[], right: [] as string[] } }
const layout = (columns: ColumnDef[], viewport: number, over: Partial<typeof state> = {}) => computeColumnLayout(columns, { ...state, ...over }, viewport)
const widths = (l: ReturnType<typeof layout>) => l.all.map((c) => l.width(c.field))

describe('flex columns', () => {
  it('share what the fixed columns leave, in proportion to flex', () => {
    const l = layout([{ field: 'id', width: 100 }, { field: 'a', flex: 1 }, { field: 'b', flex: 2 }], 700)
    expect(widths(l)).toEqual([100, 200, 400])
    expect(l.centerWidth).toBe(700)
  })

  it('a column at its maxWidth takes it and the others share the rest', () => {
    const l = layout([{ field: 'a', flex: 1, maxWidth: 150 }, { field: 'b', flex: 1 }], 800)
    expect(widths(l)).toEqual([150, 650])
  })

  it('a column below its minWidth takes it, the rest share what is left', () => {
    const l = layout([{ field: 'a', flex: 1, minWidth: 300 }, { field: 'b', flex: 3 }, { field: 'c', width: 200 }], 800)
    // 600 free: a would get 150 (< 300) so it takes 300 and b gets the other 300
    expect(widths(l)).toEqual([300, 300, 200])
  })

  it('with no room each flex column keeps its floor (100, or its minWidth) and the grid scrolls', () => {
    const l = layout([{ field: 'a', width: 500 }, { field: 'b', flex: 1 }, { field: 'c', flex: 1, minWidth: 80 }], 400)
    expect(widths(l)).toEqual([500, 100, 80])
  })

  it('a column the user resized is fixed, and the other flex columns share the rest', () => {
    const l = layout([{ field: 'a', flex: 1 }, { field: 'b', flex: 1 }], 600, { columnWidths: { a: 200 } })
    expect(widths(l)).toEqual([200, 400])
  })

  it('without flex the viewport is irrelevant, and maxWidth caps any column', () => {
    expect(widths(layout([{ field: 'a', width: 120 }, { field: 'b', width: 500, maxWidth: 300 }], 10))).toEqual([120, 300])
  })

  it('pinned and hidden columns count: a hidden one leaves its share to the others', () => {
    const cols: ColumnDef[] = [{ field: 'a', flex: 1 }, { field: 'b', flex: 1, hidden: true }, { field: 'c', width: 100 }]
    expect(widths(layout(cols, 500, { pinnedColumns: { left: ['c'], right: [] } }))).toEqual([100, 400])
  })
})
