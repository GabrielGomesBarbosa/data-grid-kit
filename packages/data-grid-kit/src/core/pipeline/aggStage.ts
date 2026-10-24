import { accAdd, accFinish, accMerge, accSub, isBuiltinAggregation, newAcc, type AggAcc, type BuiltinAggregation } from '../aggregation'
import { type ColumnDef, type CustomAggregation } from '../types'
import { getCellValue } from '../values'
import { keyEntry } from './pivotStage'
import { type TreeNode } from './nodes'
import { PIVOT_SEP } from './contract'
import { type Engine } from './engine'

export function aggOn<R>(S: Engine<R>) {
return S.aggItems.length > 0 || S.pivot !== undefined
}

export function makeAggItems<R>(S: Engine<R>): AggItem<R>[] {
  const out: AggItem<R>[] = []
  S.pivotKeys = new Map()
  S.pivotValues = []
  S.pivotKeyCols = []
  S.totalIdx = []
  if (S.pivot) {
    for (const v of S.pivot.values) {
      const col = S.byField.get(v.field)
      if (col && col.aggregable !== false && isBuiltinAggregation(v.aggFunc)) S.pivotValues.push({ col, kind: v.aggFunc })
    }
    for (const c of S.pivot.columns) {
      const col = S.byField.get(c.field)
      if (col) S.pivotKeyCols.push(col)
    }
    if (S.pivot.totals) {
      for (let j = 0; j < S.pivotValues.length; j++) {
        const v = S.pivotValues[j]!
        S.totalIdx.push(out.length)
        out.push({ field: `__pt${PIVOT_SEP}${j}${PIVOT_SEP}${v.col.field}`, name: v.kind, kind: v.kind, custom: null, col: v.col })
      }
    }
    return out
  }
  for (const [field, name] of Object.entries(S.input.aggregationModel ?? {})) {
    const col = S.byField.get(field)
    if (!col || col.aggregable === false) continue
    if (isBuiltinAggregation(name)) out.push({ field, name, kind: name, custom: null, col })
    else {
      const custom = S.input.aggregationFunctions?.[name]
      if (custom) out.push({ field, name, kind: null, custom, col })
    }
  }
  return out
}

export function newAccs<R>(S: Engine<R>): AggAcc[] {
return S.aggItems.map(() => newAcc())
}

/** accumulators created before an item existed are shorter than `aggItems`: the missing ones are empty */
  export function fit<R>(S: Engine<R>, accs: AggAcc[]): AggAcc[] {
  for (let j = accs.length; j < S.aggItems.length; j++) accs.push(newAcc())
  return accs
}

/** values of the built-in aggregated columns for one row (undefined for custom items) */
  export function valuesOfRow<R>(S: Engine<R>, row: R): Vals {
  if (S.pivot) {
    const idx = keyEntry(S, row).all
    return { idx, v: idx.map((j) => getCellValue(S.aggItems[j]!.col, row)) }
  }
  return { idx: null, v: S.aggItems.map((it) => (it.kind ? getCellValue(it.col, row) : undefined)) }
}

/** add a child's own row and everything below it to `accs` */
  export function addChildTo<R>(S: Engine<R>, accs: AggAcc[], ch: TreeNode<R>) {
  if (ch.self && ch.row !== undefined) {
    if (S.pivot) {
      const vals = valuesOfRow(S, ch.row)
      fit(S, accs)
      const idx = vals.idx!
      for (let t = 0; t < idx.length; t++) accAdd(accs[idx[t]!]!, S.aggItems[idx[t]!]!.kind!, vals.v[t])
    } else {
      for (let j = 0; j < S.aggItems.length; j++) {
        const it = S.aggItems[j]!
        if (it.kind) accAdd(accs[j]!, it.kind, getCellValue(it.col, ch.row))
      }
    }
  }
  if (ch.children.length) {
    const sub = ensureAccs(S, ch)
    fit(S, accs)
    for (let j = 0; j < S.aggItems.length; j++) {
      const it = S.aggItems[j]!
      if (it.kind && sub[j]!.rows > 0) accMerge(accs[j]!, sub[j]!, it.kind)
    }
  }
}

/** the node's totals; recomputed from its children first if a min/max lost its extreme */
  export function ensureAccs<R>(S: Engine<R>, node: TreeNode<R>): AggAcc[] {
  if (node.acc && !node.accDirty) return fit(S, node.acc)
  const accs = newAccs(S)
  for (const ch of node.children) addChildTo(S, accs, ch)
  node.acc = accs
  node.accDirty = false
  return accs
}

export function ensureRootAccs<R>(S: Engine<R>): AggAcc[] {
  const m = S.model!
  if (m.rootAcc && !m.rootDirty) return fit(S, m.rootAcc)
  const accs = newAccs(S)
  for (const r of m.roots) addChildTo(S, accs, r)
  m.rootAcc = accs
  m.rootDirty = false
  return accs
}

/** a row entered (+1) or left (-1) the totals of every ancestor and of the grand total */
  export function contribute<R>(S: Engine<R>, start: TreeNode<R> | null, vals: Vals, sign: 1 | -1) {
  const m = S.model!
  const idx = vals.idx
  const n = idx ? idx.length : S.aggItems.length
  const apply = (accs: AggAcc[]): boolean => {
    fit(S, accs)
    let stale = false
    for (let t = 0; t < n; t++) {
      const j = idx ? idx[t]! : t
      const kind = S.aggItems[j]!.kind
      if (!kind) continue
      if (sign > 0) accAdd(accs[j]!, kind, vals.v[t])
      else if (accSub(accs[j]!, kind, vals.v[t])) stale = true
    }
    return stale
  }
  for (let a = start; a; a = a.parent) {
    if (apply(a.acc ?? (a.acc = newAccs(S)))) a.accDirty = true
  }
  if (apply(m.rootAcc ?? (m.rootAcc = newAccs(S)))) m.rootDirty = true
}

export function sameVals<R>(S: Engine<R>, a: Vals | null, b: Vals | null) {
  if (!a || !b) return a === b
  if (a.v.length !== b.v.length) return false
  if (a.idx || b.idx) {
    if (!a.idx || !b.idx) return false
    for (let i = 0; i < a.idx.length; i++) if (a.idx[i] !== b.idx[i]) return false
  }
  for (let i = 0; i < a.v.length; i++) if (!Object.is(a.v[i], b.v[i])) return false
  return true
}

/** custom aggregations read every value below a node; cached per data version */
  export function customResults<R>(S: Engine<R>, node: TreeNode<R> | null): Record<string, unknown> {
  const cache = node ? node.cagg : S.customRoot
  if (cache && cache.v === S.version) return cache.out
  const out: Record<string, unknown> = {}
  for (const it of S.aggItems) {
    if (!it.custom) continue
    const values: unknown[] = []
    const rows: R[] = []
    const visit = (nodes: TreeNode<R>[]) => {
      for (const n of nodes) {
        if (n.self && n.row !== undefined) {
          values.push(getCellValue(it.col, n.row))
          rows.push(n.row)
        }
        if (n.kids) visit(n.kids)
      }
    }
    visit(node ? (node.kids ?? []) : S.model!.kidsRoot)
    out[it.field] = it.custom.apply({ values, rows })
  }
  if (node) node.cagg = { v: S.version, out }
  else S.customRoot = { v: S.version, out }
  return out
}

export function finishAccs<R>(S: Engine<R>, accs: AggAcc[], node: TreeNode<R> | null): Record<string, unknown> {
  const rec: Record<string, unknown> = {}
  if (S.pivot) {
    for (let t = 0; t < S.pivotLive.length; t++) {
      const j = S.pivotLive[t]!
      rec[S.aggItems[j]!.field] = accFinish(accs[j]!, S.aggItems[j]!.kind!)
    }
    return rec
  }
  const custom = S.aggItems.some((it) => it.custom) ? customResults(S, node) : undefined
  for (let j = 0; j < S.aggItems.length; j++) {
    const it = S.aggItems[j]!
    rec[it.field] = it.kind ? accFinish(accs[j]!, it.kind) : custom![it.field]
  }
  return rec
}

export function shallowSame<R>(S: Engine<R>, a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined) {
  if (a === b) return true
  if (!a || !b) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  for (const k of ka) if (!Object.is(a[k], b[k])) return false
  return true
}

/* -------- aggregation -------- */

  export interface AggItem<R> {
    field: string
    name: string
    kind: BuiltinAggregation | null
    custom: CustomAggregation<R> | null
    col: ColumnDef<R>
  }

/**
   * What one row contributes. Without a pivot `v[j]` belongs to item j; with one, only the items the row
   * lands in are listed (`idx[t]` is the item of `v[t]`), so a row costs one entry per value, not per column.
   */
  export interface Vals {
    idx: number[] | null
    v: unknown[]
  }
