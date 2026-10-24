import { type RenderRow, type RowId } from '../types'
import { compareValues, isNil } from '../values'
import { aggOn, ensureAccs, ensureRootAccs, finishAccs, shallowSame } from './aggStage'
import { pivotColumnsNow } from './pivotStage'
import { same, type TreeNode } from './nodes'
import { type PipelineResult } from './contract'
import { type Engine } from './engine'

/* -------- flatten -------- */

/**
 * A pivot table can order its groups by a value column. This works on the visible lists at flatten time: it reads the
 * aggregates that are shown anyway (computed once per node here), so no incremental structure has to follow them.
 */
function aggSorter<R>(S: Engine<R>) {
  const sort = S.input.aggSort
  const records = new Map<TreeNode<R>, Record<string, unknown> | undefined>()
  const aggregatesOf = (n: TreeNode<R>) => {
    if (!records.has(n)) records.set(n, n.kids && n.kids.length > 0 && aggOn(S) ? finishAccs(S, ensureAccs(S, n), n) : undefined)
    return records.get(n)
  }
  const dir = sort?.direction === 'desc' ? -1 : 1
  const order = (nodes: TreeNode<R>[]): TreeNode<R>[] => {
    if (!sort || !S.pivot || nodes.length < 2) return nodes
    return nodes
      .map((n, i) => ({ n, i, v: aggregatesOf(n)?.[sort.field] }))
      .sort((a, b) => {
        const an = isNil(a.v)
        const bn = isNil(b.v)
        if (an || bn) return an === bn ? a.i - b.i : an ? 1 : -1 // empty values last, in both directions
        return compareValues(a.v, b.v) * dir || a.i - b.i
      })
      .map((x) => x.n)
  }
  return { order, aggregatesOf }
}

  export function flatten<R>(S: Engine<R>): PipelineResult<R> {
  const m = S.model!
  const hidden = S.input.hiddenIds
  const agg = aggSorter(S)
  let roots = agg.order(m.kidsRoot)
  let hiddenPassing = 0
  if (hidden && hidden.size) {
    roots = roots.filter((n) => !hidden.has(n.id))
    for (const id of hidden) if (m.byId.get(id)?.self) hiddenPassing++
  }
  let pageRoots = roots
  if (S.input.pagination) {
    const { page, pageSize } = S.input.pagination
    pageRoots = roots.slice(page * pageSize, page * pageSize + pageSize)
  }
  const expanded = S.input.expandedIds
  const all = S.input.expandAllByDefault
  const rows: RenderRow<R>[] = []
  const detailIds = S.input.detailIds
  const detailRows: { id: RowId; index: number }[] = []
  const pivotColumns = pivotColumnsNow(S) // before the walk: it decides which aggregates are reported
  // a pivot table shows the groups only: the deepest group level is where the rows end
  const lastLevel = m.groupFields.length - 1
  const walk = (nodes: TreeNode<R>[], depth: number) => {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!
      const children = n.kids
      const hasKids = !!children && children.length > 0
      const expandable = hasKids && !(S.pivot && depth >= lastLevel)
      const open = expandable && (all ? !expanded.has(n.id) : expanded.has(n.id))
      const childCount = n.count - n.self
      let aggregates = hasKids && aggOn(S) ? agg.aggregatesOf(n) : undefined
      let rr = n.rr
      if (rr && shallowSame(S, rr.aggregates, aggregates)) aggregates = rr.aggregates // keep identity while values are unchanged
      // RenderRows are immutable: a new object only when something the UI shows has changed
      if (
        !rr ||
        rr.row !== n.row ||
        rr.depth !== depth ||
        rr.expanded !== open ||
        rr.expandable !== expandable ||
        rr.childCount !== childCount ||
        rr.aggregates !== aggregates
      ) {
        rr = n.rr = {
          id: n.id,
          type: n.type,
          depth,
          row: n.row,
          childCount,
          expandable,
          expanded: open,
          groupField: n.groupField,
          groupValue: n.groupValue,
          aggregates,
        }
      }
      if (detailIds && detailIds.size && n.row !== undefined && detailIds.has(n.id)) {
        detailRows.push({ id: n.id, index: rows.length })
      }
      rows.push(rr)
      if (open) walk(agg.order(children!), depth + 1)
    }
  }
  walk(S.pivot && lastLevel < 0 ? [] : pageRoots, 0)

  let positions: Map<RowId, number> | null = null
  let expandableIds: RowId[] | null = null
  return {
    rows,
    rootCount: roots.length,
    filteredCount: m.total - hiddenPassing,
    get expandableIds() {
      if (!expandableIds) {
        expandableIds = []
        for (const n of m.byId.values()) if (n.kids?.length) expandableIds.push(n.id)
      }
      return expandableIds
    },
    getRow: (id) => m.byId.get(id)?.row,
    indexOf(id) {
      if (!positions) positions = new Map(rows.map((r, i) => [r.id, i]))
      return positions.get(id) ?? -1
    },
    getVisibleDataRows() {
      const out: R[] = []
      const visit = (nodes: TreeNode<R>[]) => {
        for (const n of nodes) {
          if (n.self && n.row !== undefined) out.push(n.row)
          if (n.kids) visit(n.kids)
        }
      }
      visit(m.kidsRoot)
      return out
    },
    getExportRows() {
      const out: RenderRow<R>[] = []
      const visit = (nodes: TreeNode<R>[], depth: number) => {
        for (const n of nodes) {
          const kids = n.kids
          const hasKids = !!kids && kids.length > 0
          const stop = !!S.pivot && depth >= lastLevel // the pivot's rows end at the deepest group level
          if (S.pivot && lastLevel < 0) return
          if (!S.pivot || hasKids) {
            out.push({
              id: n.id,
              type: n.type,
              depth,
              row: n.row,
              childCount: n.count - n.self,
              expandable: hasKids && !stop,
              expanded: true,
              groupField: n.groupField,
              groupValue: n.groupValue,
              aggregates: hasKids && aggOn(S) ? agg.aggregatesOf(n) : undefined,
            })
          }
          if (hasKids && !stop) visit(agg.order(kids!), depth + 1)
        }
      }
      visit(agg.order(m.kidsRoot), 0)
      return out
    },
    detailRows,
    dataIdAt: (index) => (m.mode === 'flat' ? m.roots[index]?.id : undefined),
    dataCount: m.mode === 'flat' ? m.roots.length : 0,
    dataIndexOf(id) {
      const node = m.byId.get(id)
      if (!node || m.mode !== 'flat') return -1
      let lo = 0
      let hi = m.roots.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (m.roots[mid]!.seq < node.seq) lo = mid + 1
        else hi = mid
      }
      return m.roots[lo] === node ? lo : m.roots.indexOf(node)
    },
    pivotColumns,
    getTotals() {
      if (!aggOn(S)) return undefined
      const next = finishAccs(S, ensureRootAccs(S), null)
      // same values: hand back the same object, so memoised rows showing the totals don't re-render
      if (S.lastTotals && shallowSame(S, S.lastTotals, next)) return S.lastTotals
      return (S.lastTotals = next)
    },
    getLeafIds(id) {
      const start = m.byId.get(id)
      if (!start) return []
      const out: RowId[] = []
      const stack = [start]
      while (stack.length) {
        const n = stack.pop()!
        if (n.self) out.push(n.id)
        if (n.kids) for (const k of n.kids) stack.push(k)
      }
      return out
    },
  }
}
