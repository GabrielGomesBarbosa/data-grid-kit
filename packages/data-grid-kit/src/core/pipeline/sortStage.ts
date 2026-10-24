import { collator, isNil, compareValues, getCellValue } from '../values'
import { NO_ITEMS, type TreeNode } from './nodes'
import { type Engine } from './engine'

/* -------- sort comparators -------- */

  export function itemsFor<R>(S: Engine<R>, node: TreeNode<R>): number[] {
return node.groupField !== undefined ? (S.plan.byGroupField.get(node.groupField) ?? NO_ITEMS) : S.plan.allIdx
}

export function makeCmp<R>(S: Engine<R>, items: number[], ranked: boolean) {
return (a: TreeNode<R>, b: TreeNode<R>) => {
  const ak = (ranked ? a.r : a.k)!
  const bk = (ranked ? b.r : b.k)!
  for (let n = 0; n < items.length; n++) {
    const j = items[n]!
    const av = ak[j]
    const bv = bk[j]
    let c: number
    if (S.plan.fast[j] && typeof av === 'number' && typeof bv === 'number') {
      c = (av - bv) * S.plan.dirs[j]! // plain numbers (and text ranks): no function call, never empty
    } else {
      c = S.plan.cmps[j]!(av, bv)
      if (c !== 0 && isNil(av) === isNil(bv)) c *= S.plan.dirs[j]! // empties stay last in both directions
    }
    if (c !== 0) return c
  }
  // sorted tree siblings with equal keys fall back to their name, so the order never depends on history
  if (items.length && a.seg !== undefined && b.seg !== undefined && a.seg !== b.seg) return a.seg < b.seg ? -1 : 1
  // groups whose values the collator treats as equal ("dev" / "Dev") are told apart by the raw value
  if (items.length && a.groupField !== undefined && b.groupField !== undefined) {
    const x = String(a.groupValue)
    const y = String(b.groupValue)
    if (x !== y) return x < y ? -1 : 1
  }
  return a.seq - b.seq
}
}

export function rawCmp<R>(S: Engine<R>, items: number[]) {
  let f = S.rawCmps.get(items)
  if (!f) S.rawCmps.set(items, (f = makeCmp(S, items, false)))
  return f
}

export function computeKeys<R>(S: Engine<R>, node: TreeNode<R>, row = node.row): unknown[] | undefined {
  const n = S.plan.fields.length
  if (!n) return undefined
  const k = new Array<unknown>(n)
  for (let j = 0; j < n; j++) {
    const field = S.plan.fields[j]!
    if (node.groupField === field) k[j] = node.groupValue
    else if (row !== undefined) k[j] = getCellValue(S.plan.cols[j]!, row)
  }
  return k
}

export function keysEqual<R>(S: Engine<R>, a: unknown[] | undefined, b: unknown[] | undefined) {
  if (!a || !b) return a === b
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}

/* -------- sorted visible lists (binary search; order is total thanks to `seq`) -------- */

  export function listOf<R>(S: Engine<R>, node: TreeNode<R>): TreeNode<R>[] | undefined {
return (node.parent ? node.parent.kids : S.model!.kidsRoot)
}

export function searchPos<R>(S: Engine<R>, list: TreeNode<R>[], node: TreeNode<R>, cmp: (a: TreeNode<R>, b: TreeNode<R>) => number) {
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cmp(list[mid]!, node) < 0) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function detach<R>(S: Engine<R>, node: TreeNode<R>) {
  const list = listOf(S, node)
  if (!list) return
  let i = searchPos(S, list, node, rawCmp(S, itemsFor(S, node)))
  if (list[i] !== node) i = list.indexOf(node)
  if (i >= 0) list.splice(i, 1)
}

export function attach<R>(S: Engine<R>, node: TreeNode<R>) {
  let list = listOf(S, node)
  if (!list) list = node.parent!.kids = []
  list.splice(searchPos(S, list, node, rawCmp(S, itemsFor(S, node))), 0, node)
}

/** Add `delta` to the counts of `start` and every ancestor, attaching/detaching nodes whose visibility flips. */
  export function propagate<R>(S: Engine<R>, start: TreeNode<R> | null, delta: number) {
  if (delta === 0) return
  for (let a = start; a; a = a.parent) {
    const before = a.count
    a.count = before + delta
    const was = before > 0
    const is = a.count > 0
    if (was !== is) {
      if (is) attach(S, a)
      else {
        detach(S, a)
        a.kids = undefined
      }
    }
  }
}

/* -------- full stages -------- */

  export function collect<R>(S: Engine<R>): TreeNode<R>[] {
  const all: TreeNode<R>[] = []
  const stack = [...S.model!.roots]
  while (stack.length) {
    const n = stack.pop()!
    all.push(n)
    for (let i = 0; i < n.children.length; i++) stack.push(n.children[i]!)
  }
  return all
}

export function computeRanks<R>(S: Engine<R>, all: TreeNode<R>[]) {
  const n = S.plan.fields.length
  const ranked: (Map<string, number> | null)[] = new Array(n).fill(null)
  for (let j = 0; j < n; j++) {
    if (S.plan.cmps[j] !== compareValues) continue
    const distinct = new Set<string>()
    let ok = true
    for (let i = 0; i < all.length && ok; i++) {
      const key = all[i]!.k?.[j]
      if (typeof key === 'string' && key !== '') distinct.add(key)
      else if (!isNil(key)) ok = false
    }
    if (!ok) continue
    const sorted = [...distinct].sort(collator.compare)
    const rank = new Map<string, number>()
    let r = -1
    for (let i = 0; i < sorted.length; i++) {
      // strings the collator considers equal ("a" / "A") share a rank, like compareValues would
      if (i === 0 || collator.compare(sorted[i - 1]!, sorted[i]!) !== 0) r++
      rank.set(sorted[i]!, r)
    }
    ranked[j] = rank
  }
  const anyRanked = ranked.some(Boolean)
  for (const node of all) {
    const k = node.k
    if (!k || !anyRanked) {
      node.r = k
      continue
    }
    const r = new Array<unknown>(n)
    for (let j = 0; j < n; j++) {
      const rank = ranked[j]
      const key = k[j]
      r[j] = rank && typeof key === 'string' && key !== '' ? rank.get(key) : key
    }
    node.r = r
  }
}

export function fullSort<R>(S: Engine<R>) {
  const m = S.model!
  const all = collect(S)
  if (!S.keysValid) {
    for (const node of all) node.k = computeKeys(S, node)
    S.keysValid = true
  }
  computeRanks(S, all)
  const ranked = new Map<number[], (a: TreeNode<R>, b: TreeNode<R>) => number>()
  const sortList = (list: TreeNode<R>[]): TreeNode<R>[] => {
    const vis = list.filter((c) => c.count > 0)
    if (vis.length > 1) {
      const items = itemsFor(S, vis[0]!)
      if (items.length) {
        let cmp = ranked.get(items)
        if (!cmp) ranked.set(items, (cmp = makeCmp(S, items, true)))
        vis.sort(cmp)
      }
    }
    return vis
  }
  for (const node of all) node.kids = node.children.length && node.count > 0 ? sortList(node.children) : undefined
  m.kidsRoot = sortList(m.roots)
  for (const node of all) node.r = undefined
}
