import { type RowId } from '../types'
import { detach, attach } from './sortStage'
import { insertBySeq, removeFromChildren } from './rowOps'
import { same } from './nodes'
import { type Engine } from './engine'

/** Give every root a whole-number seq/pos again (after repeated moves between the same neighbours). */
  export function renumberRoots<R>(S: Engine<R>) {
  const m = S.model!
  m.roots.forEach((n, i) => {
    n.seq = i
    n.pos = i
  })
  m.seq = m.roots.length
  m.pos = m.roots.length
}

/** Order the flat rows like `order` (rows not listed keep their relative order, after the listed ones). */
  export function reorderRoots<R>(S: Engine<R>, order: RowId[]) {
  const m = S.model!
  if (m.mode !== 'flat') return
  const rank = new Map(order.map((id, i) => [id, i]))
  const listed = m.roots.filter((n) => rank.has(n.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
  const rest = m.roots.filter((n) => !rank.has(n.id))
  m.roots = [...listed, ...rest]
  renumberRoots(S)
}

/**
   * Put a row right before another (or last). Order among siblings is `seq`, so the row gets a seq between its
   * new neighbours (a fraction when needed), and `pos` follows so a later `rows` array in the new order is
   * recognised as "nothing changed".
   */
  export function moveRow<R>(S: Engine<R>, id: RowId, beforeId: RowId | null, derived: boolean) {
  const m = S.model!
  if (m.mode !== 'flat') return
  const node = m.byId.get(id)
  if (!node || node.row === undefined) return
  const target = beforeId === null ? null : m.byId.get(beforeId)
  if (target === node || (beforeId !== null && (!target || target.row === undefined))) return

  for (let attempt = 0; attempt < 2; attempt++) {
    const others = m.roots // sorted by seq; `node` is in it, so skip it when looking at neighbours
    const at = target ? others.indexOf(target) : others.length
    let prev = at > 0 ? others[at - 1] : undefined
    if (prev === node) prev = at > 1 ? others[at - 2] : undefined
    if (!target && others[others.length - 1] === node) return // already last
    if (target && others[at - 1] === node) return // already right before the target
    const nextSeq = target ? target.seq : (prev ? prev.seq : 0) + 2
    const nextPos = target ? target.pos : (prev ? prev.pos : 0) + 2
    const seq = prev ? (prev.seq + nextSeq) / 2 : nextSeq - 1
    const pos = prev ? (prev.pos + nextPos) / 2 : nextPos - 1
    if (prev && (seq <= prev.seq || seq >= nextSeq || pos <= prev.pos || pos >= nextPos)) {
      renumberRoots(S) // no room left between these two: spread everything out and try again
      continue
    }
    const wasIn = derived && node.count > 0
    if (wasIn) detach(S, node) // by its old seq (the comparator breaks ties with it)
    removeFromChildren(S, node)
    node.seq = seq
    node.pos = pos
    // new rows take m.seq++ / m.pos++: keep the counters above every value in use, or a row added after
    // a move-to-end would land in the middle
    m.seq = Math.max(m.seq, Math.floor(seq) + 1)
    m.pos = Math.max(m.pos, Math.floor(pos) + 1)
    insertBySeq(S, m.roots, node)
    if (wasIn) attach(S, node)
    return
  }
}
