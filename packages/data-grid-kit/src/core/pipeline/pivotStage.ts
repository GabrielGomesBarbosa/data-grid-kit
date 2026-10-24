import { type ColumnDef } from '../types'
import { isNil, compareValues, formatCellValue, getCellValue } from '../values'
import { fullFilter } from './filterStage'
import { fit, ensureRootAccs } from './aggStage'
import { same, groupKey } from './nodes'
import { PIVOT_SEP, type PivotColumn } from './contract'
import { type Engine } from './engine'

export function pivotOn<R>(S: Engine<R>) {
return S.pivot !== undefined
}

export function labelOfValue<R>(S: Engine<R>, col: ColumnDef<R>, row: R): string {
  const text = formatCellValue(col, row)
  return text === '' ? '(No value)' : text
}

export function resetPivot<R>(S: Engine<R>) {
  S.pivotKeys = new Map()
  S.aggItems.length = S.totalIdx.length // keep the total items, drop every column-value item
}

export function keyEntry<R>(S: Engine<R>, row: R): PivotKey {
  let key = ''
  for (let i = 0; i < S.pivotKeyCols.length; i++) {
    const raw = getCellValue(S.pivotKeyCols[i]!, row)
    key += (i ? PIVOT_SEP : '') + (isNil(raw) ? '' : String(groupKey(raw)))
  }
  let e = S.pivotKeys.get(key)
  if (!e) {
    e = {
      key,
      raws: S.pivotKeyCols.map((c) => getCellValue(c, row)),
      labels: S.pivotKeyCols.map((c) => labelOfValue(S, c, row)),
      items: [],
      all: S.totalIdx.slice(),
    }
    for (let j = 0; j < S.pivotValues.length; j++) {
      const v = S.pivotValues[j]!
      e.items.push(S.aggItems.length)
      e.all.push(S.aggItems.length)
      // the position keeps two values of the same field apart
      S.aggItems.push({ field: `__pv${PIVOT_SEP}${key}${PIVOT_SEP}${j}${PIVOT_SEP}${v.col.field}`, name: v.kind, kind: v.kind, custom: null, col: v.col })
    }
    S.pivotKeys.set(key, e)
  }
  return e
}

export function pivotColumnsNow<R>(S: Engine<R>): PivotColumn[] {
  if (!S.pivot) return S.pivotColsCache.length ? (S.pivotColsCache = []) : S.pivotColsCache
  const root = fit(S, ensureRootAccs(S))
  const alive: PivotKey[] = []
  for (const e of S.pivotKeys.values()) if (e.items.length && root[e.items[0]!]!.rows > 0) alive.push(e)
  const dirs = S.pivot.columns.map((c) => (c.sort === 'desc' ? -1 : 1))
  alive.sort((a, b) => {
    for (let i = 0; i < dirs.length; i++) {
      const c = compareValues(a.raws[i], b.raws[i])
      if (c) return c * dirs[i]!
    }
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })
  const out: PivotColumn[] = []
  S.pivotLive = S.totalIdx.slice()
  for (const e of alive) {
    for (const idx of e.items) S.pivotLive.push(idx)
    e.items.forEach((idx, j) => out.push({ field: S.aggItems[idx]!.field, valueField: S.pivotValues[j]!.col.field, aggFunc: S.pivotValues[j]!.kind, path: e.labels, total: false }))
  }
  S.totalIdx.forEach((idx, j) => out.push({ field: S.aggItems[idx]!.field, valueField: S.pivotValues[j]!.col.field, aggFunc: S.pivotValues[j]!.kind, path: [], total: true }))
  // columns that lost their last row leave dead items behind: rebuild them away once they pile up
  if (S.aggItems.length - S.totalIdx.length > 2 * (S.pivotLive.length - S.totalIdx.length) + 64) {
    fullFilter(S)
    return pivotColumnsNow(S)
  }
  const same = out.length === S.pivotColsCache.length && out.every((c, i) => c.field === S.pivotColsCache[i]!.field && c.path.join(PIVOT_SEP) === S.pivotColsCache[i]!.path.join(PIVOT_SEP))
  return same ? S.pivotColsCache : (S.pivotColsCache = out)
}

/* pivot: one item per (column-value combination, value). They are created the first time a row with that
     combination shows up, so accumulators of older nodes may be shorter than `aggItems` (see `fit`). */
  export interface PivotKey {
    key: string
    raws: unknown[]
    labels: string[]
    /** indices into aggItems, one per pivot value */
    items: number[]
    /** the total items followed by this key's items: what a row with this key contributes to */
    all: number[]
  }
