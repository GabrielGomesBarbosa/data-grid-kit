import { type RowId } from '../types'
import { maxIncremental } from './rowOps'
import { type RowChanges } from './nodes'
import { type Engine } from './engine'

/**
   * Cheap diff for the common case: the new array is the old one with some objects replaced, a few
   * removed and/or new ones appended. It walks both arrays in step comparing object identity, so
   * unchanged rows cost one `===` (no id, no Map lookup). Returns null whenever the arrays don't
   * line up that way and the id-based diff (or a rebuild) should decide.
   */
  export function alignedDiff<R>(S: Engine<R>, next: R[]): RowChanges<R> | null {
  const m = S.model!
  if (m.patched) return null // node rows may differ from the previous array: compare by id instead
  const prev = m.rowsProp as R[]
  const limit = maxIncremental(S)
  const update: R[] = []
  const remove: RowId[] = []
  let i = 0
  let j = 0
  while (i < prev.length && j < next.length) {
    const a = prev[i]!
    const b = next[j]!
    if (a === b) {
      i++
      j++
      continue
    }
    if (S.input.getRowId(a) === S.input.getRowId(b)) {
      update.push(b)
      i++
      j++
    } else {
      remove.push(S.input.getRowId(a)) // assume `a` was removed; verified below
      i++
    }
    if (update.length + remove.length > limit) return null
  }
  for (; i < prev.length; i++) remove.push(S.input.getRowId(prev[i]!))
  const insert: R[] = []
  const fresh = new Set<RowId>()
  const gone = new Set(remove)
  for (; j < next.length; j++) {
    const row = next[j]!
    const id = S.input.getRowId(row)
    // an "insert" whose id is still present means rows were reordered or inserted in the middle
    if (fresh.has(id) || (m.byId.get(id)?.row !== undefined && !gone.has(id))) return null
    fresh.add(id)
    insert.push(row)
    if (update.length + remove.length + insert.length > limit) return null
  }
  // a removed id that shows up again among the updates would mean a reorder
  if (remove.length && update.some((r) => gone.has(S.input.getRowId(r)))) return null
  return { remove, update, insert }
}

/** Compare a new `rows` array with the current rows; null when a rebuild is the better answer. */
  export function diffRows<R>(S: Engine<R>, next: R[]): RowChanges<R> | null {
  const quick = alignedDiff(S, next)
  if (quick) return quick
  return idDiff(S, next)
}

export function idDiff<R>(S: Engine<R>, next: R[]): RowChanges<R> | null {
  const m = S.model!
  const stamp = ++S.stampCounter
  const limit = maxIncremental(S)
  const update: R[] = []
  const insert: R[] = []
  let newIds: Set<RowId> | null = null
  let prevPos = -1
  let seen = 0
  for (let i = 0; i < next.length; i++) {
    const row = next[i]!
    const id = S.input.getRowId(row)
    const node = m.byId.get(id)
    if (node && node.row !== undefined) {
      // duplicate id, an insert before an existing row, or rows reordered: not worth patching
      if (node.mark === stamp || insert.length || node.pos < prevPos) return null
      prevPos = node.pos
      node.mark = stamp
      seen++
      if (node.row !== row) {
        update.push(row)
        if (update.length > limit) return null
      }
    } else {
      if (!newIds) newIds = new Set()
      if (newIds.has(id)) return null
      newIds.add(id)
      insert.push(row)
      if (insert.length > limit) return null
    }
  }
  const remove: RowId[] = []
  if (seen < m.dataCount) {
    for (const n of m.byId.values()) {
      if (n.row !== undefined && n.mark !== stamp) {
        remove.push(n.id)
        if (remove.length > limit) return null
      }
    }
  }
  if (update.length + insert.length + remove.length > limit) return null
  return { remove, update, insert }
}
