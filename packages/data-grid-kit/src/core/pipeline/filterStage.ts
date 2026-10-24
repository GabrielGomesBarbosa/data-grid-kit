import { aggOn, newAccs, addChildTo } from './aggStage'
import { resetPivot } from './pivotStage'
import { type TreeNode } from './nodes'
import { type Engine } from './engine'

export function fullFilter<R>(S: Engine<R>) {
  const m = S.model!
  let total = 0
  const agg = aggOn(S)
  if (S.pivot) resetPivot(S) // columns are rediscovered from the rows that pass the filter
  const visit = (n: TreeNode<R>): number => {
    let c = 0
    for (let i = 0; i < n.children.length; i++) c += visit(n.children[i]!)
    n.self = n.row !== undefined && (!S.passes || S.passes(n.row)) ? 1 : 0
    total += n.self
    n.count = c + n.self
    if (agg && n.children.length) {
      const accs = newAccs(S)
      for (let i = 0; i < n.children.length; i++) addChildTo(S, accs, n.children[i]!)
      n.acc = accs
      n.accDirty = false
    } else if (n.acc) {
      n.acc = undefined
      n.accDirty = false
    }
    return n.count
  }
  for (let i = 0; i < m.roots.length; i++) visit(m.roots[i]!)
  m.total = total
  if (agg) {
    const accs = newAccs(S)
    for (let i = 0; i < m.roots.length; i++) addChildTo(S, accs, m.roots[i]!)
    m.rootAcc = accs
  } else m.rootAcc = null
  m.rootDirty = false
}
