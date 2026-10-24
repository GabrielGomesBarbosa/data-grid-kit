import { type RowId } from '../types'
import { computeKeys, keysEqual, detach, attach, propagate } from './sortStage'
import { aggOn, valuesOfRow, contribute, sameVals } from './aggStage'
import { getValueOf } from './build'
import { moveRow } from './moveOps'
import { groupKey, mk, type TreeNode, type RowChanges } from './nodes'
import { type Engine } from './engine'

/* -------- incremental row operations -------- */

  export function ensurePathMap<R>(S: Engine<R>) {
  const m = S.model!
  if (m.pathMap) return
  const map = new Map<string, TreeNode<R>>()
  const walk = (nodes: TreeNode<R>[], parentKey: string | null) => {
    for (const n of nodes) {
      const key = parentKey === null ? JSON.stringify(n.seg) : `${parentKey},${JSON.stringify(n.seg)}`
      n.pk = key
      map.set(key, n)
      walk(n.children, key)
    }
  }
  walk(m.roots, null)
  m.pathMap = map
}

export function pathKeyOf<R>(S: Engine<R>, path: string[]) {
return path.map((s) => JSON.stringify(s)).join(',')
}

export function syntheticIdOf<R>(S: Engine<R>, node: TreeNode<R>) {
  const path: string[] = []
  for (let n: TreeNode<R> | null = node; n; n = n.parent) path.push(n.seg!)
  return `tree:${JSON.stringify(path.reverse())}`
}

export function insertBySeq<R>(S: Engine<R>, list: TreeNode<R>[], node: TreeNode<R>) {
  const last = list[list.length - 1]
  if (!last || last.seq < node.seq) return void list.push(node)
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (list[mid]!.seq < node.seq) lo = mid + 1
    else hi = mid
  }
  list.splice(lo, 0, node)
}

export function removeFromChildren<R>(S: Engine<R>, node: TreeNode<R>) {
  const list = node.parent ? node.parent.children : S.model!.roots
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (list[mid]!.seq < node.seq) lo = mid + 1
    else hi = mid
  }
  const i = list[lo] === node ? lo : list.indexOf(node)
  if (i >= 0) list.splice(i, 1)
}

/** Structural placement of a row. Creates missing ancestors; returns the node that will hold the row. */
  export function place<R>(S: Engine<R>, row: R, id: RowId, keep: { seq: number; pos: number } | undefined, derived: boolean): { node: TreeNode<R>; existing: boolean } {
  const m = S.model!
  const newAncestor = (n: TreeNode<R>) => {
    if (derived) n.k = computeKeys(S, n)
  }
  if (m.mode === 'flat') {
    const node = mk<R>(id, 'leaf', null, keep?.seq ?? m.seq++)
    insertBySeq(S, m.roots, node)
    m.byId.set(id, node)
    return { node, existing: false }
  }
  if (m.mode === 'group') {
    let parent: TreeNode<R> | null = null
    let parentId = 'group'
    for (const field of m.groupFields) {
      const raw = getValueOf(S, field, row)
      const gid = `${parentId}/${field}:${String(groupKey(raw))}`
      let g = m.byId.get(gid)
      if (!g) {
        g = mk<R>(gid, 'group', parent, m.seq++)
        g.groupField = field
        g.groupValue = raw
        ;(parent ? parent.children : m.roots).push(g)
        m.byId.set(gid, g)
        newAncestor(g)
      }
      parent = g
      parentId = gid
    }
    const node = mk<R>(id, 'leaf', parent, keep?.seq ?? m.seq++)
    insertBySeq(S, parent!.children, node)
    m.byId.set(id, node)
    return { node, existing: false }
  }
  ensurePathMap(S)
  const path = S.input.getTreeDataPath!(row)
  let parent: TreeNode<R> | null = null
  let key = ''
  let node: TreeNode<R> | undefined
  let existing = false
  for (let depth = 0; depth < path.length; depth++) {
    const seg = path[depth]!
    key = depth === 0 ? JSON.stringify(seg) : `${key},${JSON.stringify(seg)}`
    node = m.pathMap!.get(key)
    const last = depth === path.length - 1
    if (!node) {
      node = mk<R>('', 'group', parent, last && keep ? keep.seq : m.seq++)
      node.seg = seg
      node.pk = key
      node.id = last ? id : `tree:${JSON.stringify(path.slice(0, depth + 1))}`
      insertBySeq(S, parent ? parent.children : m.roots, node)
      m.byId.set(node.id, node)
      m.pathMap!.set(key, node)
      newAncestor(node)
    } else if (last) {
      if (node.row !== undefined) {
        throw new Error(
          `data-grid-kit: rows "${String(node.id)}" and "${String(id)}" share the tree path ${JSON.stringify(path)}`,
        )
      }
      existing = true
    }
    parent = node
  }
  return { node: node!, existing }
}

export function insertRow<R>(S: Engine<R>, row: R, derived: boolean, keep?: { seq: number; pos: number }) {
  const m = S.model!
  const id = S.input.getRowId(row)
  if (m.mode === 'tree' && !S.input.getTreeDataPath!(row).length) return // pathless rows are not shown
  const { node, existing } = place(S, row, id, keep, derived)
  const wasIn = derived && existing && node.count > 0
  if (wasIn) detach(S, node) // its keys change below
  if (node.id !== id) {
    m.byId.delete(node.id)
    node.id = id
    m.byId.set(id, node)
  }
  node.row = row
  node.pos = keep?.pos ?? m.pos++
  m.dataCount++
  if (!derived) return
  node.k = computeKeys(S, node)
  const self = !S.passes || S.passes(row) ? 1 : 0
  node.self = self as 0 | 1
  node.count += self
  m.total += self
  if (self && aggOn(S)) contribute(S, node.parent, valuesOfRow(S, row), 1)
  if (node.count > 0) attach(S, node)
  propagate(S, node.parent, self)
}

export function removeRow<R>(S: Engine<R>, id: RowId, derived: boolean) {
  const m = S.model!
  const node = m.byId.get(id)
  if (!node || node.row === undefined) return
  if (m.mode === 'tree' && node.children.length) {
    // a tree row with descendants stays in the hierarchy as a plain group
    const wasIn = derived && node.count > 0
    if (wasIn) detach(S, node)
    const oldSelf = node.self
    if (derived && oldSelf && aggOn(S)) contribute(S, node.parent, valuesOfRow(S, node.row), -1)
    node.row = undefined
    m.byId.delete(id)
    node.id = syntheticIdOf(S, node)
    m.byId.set(node.id, node)
    m.dataCount--
    if (derived) {
      node.k = computeKeys(S, node)
      node.self = 0
      node.count -= oldSelf
      m.total -= oldSelf
      if (node.count > 0) attach(S, node)
      propagate(S, node.parent, -oldSelf)
    }
    return
  }
  if (derived) {
    const s = node.self
    if (s && aggOn(S)) contribute(S, node.parent, valuesOfRow(S, node.row), -1)
    if (node.count > 0) detach(S, node)
    node.count = 0
    node.self = 0
    m.total -= s
    propagate(S, node.parent, -s)
  }
  removeFromChildren(S, node)
  m.byId.delete(node.id)
  m.pathMap?.delete(node.pk ?? '')
  m.dataCount--
  // drop groups / synthetic ancestors that became empty
  for (let p = node.parent; p && p.row === undefined && p.children.length === 0; p = p.parent) {
    removeFromChildren(S, p)
    m.byId.delete(p.id)
    m.pathMap?.delete(p.pk ?? '')
  }
}

export function sameStructure<R>(S: Engine<R>, node: TreeNode<R>, row: R): boolean {
  const m = S.model!
  if (m.mode === 'flat') return true
  if (m.mode === 'group') {
    let parentId = 'group'
    for (const field of m.groupFields) parentId = `${parentId}/${field}:${String(groupKey(getValueOf(S, field, row)))}`
    return node.parent?.id === parentId
  }
  return node.pk === pathKeyOf(S, S.input.getTreeDataPath!(row))
}

export function updateRow<R>(S: Engine<R>, node: TreeNode<R>, row: R, derived: boolean) {
  const m = S.model!
  if (!sameStructure(S, node, row)) {
    const keep = { seq: node.seq, pos: node.pos }
    removeRow(S, node.id, derived)
    insertRow(S, row, derived, keep)
    return
  }
  if (!derived) {
    node.row = row
    return
  }
  const k = computeKeys(S, node, row)
  const self = (!S.passes || S.passes(row) ? 1 : 0) as 0 | 1
  if (aggOn(S)) {
    // aggregated values can change even when nothing else the views depend on did
    const before = node.self ? valuesOfRow(S, node.row!) : null
    const after = self ? valuesOfRow(S, row) : null
    if (!sameVals(S, before, after)) {
      if (before) contribute(S, node.parent, before, -1)
      if (after) contribute(S, node.parent, after, 1)
    }
  }
  if (self === node.self && keysEqual(S, node.k, k)) {
    node.row = row // nothing the views depend on changed: O(1)
    return
  }
  const wasIn = node.count > 0
  if (wasIn) detach(S, node)
  node.row = row
  node.k = k
  const delta = self - node.self
  node.self = self
  node.count += delta
  m.total += delta
  if (node.count > 0) attach(S, node)
  propagate(S, node.parent, delta)
}

export function applyOps<R>(S: Engine<R>, ops: RowChanges<R>, derived: boolean) {
  const m = S.model!
  if (m.mode === 'tree') ensurePathMap(S)
  for (const id of ops.remove ?? []) removeRow(S, id, derived)
  const upsert = (row: R) => {
    const node = m.byId.get(S.input.getRowId(row))
    if (node && node.row !== undefined) updateRow(S, node, row, derived)
    else insertRow(S, row, derived)
  }
  for (const row of ops.update ?? []) upsert(row)
  for (const row of ops.insert ?? []) upsert(row)
  for (const mv of ops.move ?? []) moveRow(S, mv.id, mv.before, derived)
}

export function opCount<R>(S: Engine<R>, ops: RowChanges<R>) {
return (ops.remove?.length ?? 0) + (ops.update?.length ?? 0) + (ops.insert?.length ?? 0) + (ops.move?.length ?? 0)
}

export function maxIncremental<R>(S: Engine<R>) {
return Math.max(64, S.model!.dataCount >> 6)
}
