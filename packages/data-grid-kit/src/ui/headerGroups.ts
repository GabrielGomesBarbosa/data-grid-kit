import type { ColumnDef } from '../core'

/** A header cell above several columns that share a group path. `start` / `end` index the columns of one section. */
export interface GroupSpan {
  start: number
  end: number
  label: string
  key: string
}

/** Spans of adjacent columns that share a group path, one list per level of column groups. */
export function headerGroupSpans(columns: ColumnDef[], depth: number): GroupSpan[][] {
  const levels: GroupSpan[][] = []
  for (let lv = 0; lv < depth; lv++) {
    const out: GroupSpan[] = []
    let cur: GroupSpan | null = null
    columns.forEach((c, i) => {
      const g = c.group
      if (!g || g.length <= lv) {
        cur = null
        return
      }
      const key = g.slice(0, lv + 1).join('␟')
      if (cur && cur.key === key) cur.end = i + 1
      else out.push((cur = { start: i, end: i + 1, label: g[lv]!, key }))
    })
    levels.push(out)
  }
  return levels
}
