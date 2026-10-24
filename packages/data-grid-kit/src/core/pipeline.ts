export { compareValues, formatCellValue, getCellValue } from './values'
export { createRowFilter } from './pipeline/filter'
export type { TreeNode, RowChanges, UpdateKind } from './pipeline/nodes'
export { PIVOT_SEP } from './pipeline/contract'
export type { PipelineResult, PivotColumn, PivotInput, PipelineInput, Pipeline } from './pipeline/contract'
import { type RowId } from './types'
import { getCellValue } from './values'
import { fullSort } from './pipeline/sortStage'
import { fullFilter } from './pipeline/filterStage'
import { makeAggItems } from './pipeline/aggStage'
import { buildModel } from './pipeline/build'
import { place, applyOps, opCount, maxIncremental } from './pipeline/rowOps'
import { reorderRoots } from './pipeline/moveOps'
import { diffRows } from './pipeline/diff'
import { flatten } from './pipeline/flatten'
import { createRowFilter } from './pipeline/filter'
import { makePlan, same, type RowChanges, type UpdateKind } from './pipeline/nodes'
import { type PipelineResult, type PipelineInput, type Pipeline } from './pipeline/contract'
import { createEngine } from './pipeline/engine'

/**
 * Stateful pipeline over a persistent row hierarchy.
 *
 * - Changing the sort or filter recomputes only that stage (the hierarchy is kept).
 * - Expanding, collapsing and paging only re-flatten.
 * - A new `rows` array is diffed against the current rows by id; when the change is small
 *   (updates anywhere, removals anywhere, new rows appended at the end) it is applied
 *   incrementally instead of rebuilding everything.
 *
 * Incremental updates keep rows in the order they were created: new rows and new groups go to
 * the end. With a sort model the order is fully determined, so results match a fresh build.
 */
export function createPipeline<R>(): Pipeline<R> {
  const S = createEngine<R>()
  const run = ((inp: PipelineInput<R>): PipelineResult<R> => {
    S.input = inp
    const cols = inp.columns
    if (cols !== S.lastColumns) {
      S.lastColumns = cols
      S.byField = new Map(cols.map((c) => [c.field, c]))
      S.getters = new Map(cols.map((c) => [c.field, (row: R) => getCellValue(c, row)]))
    }

    let changed = false
    let kind: UpdateKind = 'none'
    // models are compared by content, so passing a fresh literal on every render costs nothing
    const nextStruct = [!!inp.getTreeDataPath, inp.rowGroupingModel.join('\u0000'), cols]
    let rebuild = !S.model || !same(S.structDeps, nextStruct)

    // new `rows` from the owner wins over anything done imperatively
    const propsChanged = S.model !== null && inp.rows !== S.model.rowsProp
    if (propsChanged) {
      S.overlay.upsert.clear()
      S.overlay.remove.clear()
      S.overlay.moved = false
      S.queue = []
    }

    // queued patches are recorded first, so they survive even a rebuild in this same run. They are applied
    // one after the other, in the order they arrived: "move X to the end" then "insert Y" must stay that way.
    let queued: RowChanges<R>[] = []
    if (S.queue.length) {
      queued = S.queue
      for (const q of S.queue) {
        if (q.move?.length) S.overlay.moved = true
        for (const id of q.remove ?? []) {
          S.overlay.remove.add(id)
          S.overlay.upsert.delete(id)
        }
        for (const row of [...(q.update ?? []), ...(q.insert ?? [])]) {
          const id = inp.getRowId(row)
          // a removal stays recorded even if the row is added back: replayed in order, the row then
          // lands at the end instead of in its old place, like it did the first time
          S.overlay.upsert.set(id, row)
        }
      }
      S.queue = []
    }

    let opsList: RowChanges<R>[] = []
    let carryOrder: RowId[] | null = null
    if (!rebuild) {
      if (propsChanged) {
        const diff = diffRows(S, inp.rows)
        if (!diff) rebuild = true
        else {
          opsList = [diff]
          S.model!.rowsProp = inp.rows
          S.model!.patched = false
        }
      } else if (queued.length) {
        opsList = queued
        S.model!.patched = true
      }
    }

    if (rebuild) {
      S.structDeps = nextStruct
      S.queue = []
      // rows moved by hand: remember their order before the old hierarchy is thrown away
      if (S.overlay.moved && !propsChanged && S.model && S.model.mode === 'flat') carryOrder = S.model.roots.map((n) => n.id)
      S.model = buildModel(S)
      S.derivedOk = false
      S.keysValid = false
      changed = true
      kind = 'rebuild'
      opsList = []
      if (S.overlay.upsert.size || S.overlay.remove.size) {
        // rebuilt for a structural reason while edits exist: put them back on the fresh hierarchy
        opsList = [{ remove: [...S.overlay.remove], update: [...S.overlay.upsert.values()], insert: [] }]
        S.model.patched = true
      }
    }

    // the aggregation plan must be current before rows are patched, so deltas use the right columns
    const nextAggDeps = [JSON.stringify(inp.pivot ?? inp.aggregationModel ?? {}), inp.pivot !== undefined, inp.aggregationFunctions, cols]
    const aggDirty = !same(S.aggDeps, nextAggDeps)
    if (aggDirty) {
      S.pivot = inp.pivot
      S.aggItems = makeAggItems(S)
      S.aggDeps = nextAggDeps
    }

    const nextFilterDeps = [JSON.stringify(inp.filterModel), cols, !!inp.ignoreDiacritics, inp.quickFilter?.parser, inp.quickFilter?.logic, !!inp.quickFilter?.includeHidden]
    const filterDirty = !S.derivedOk || !same(S.filterDeps, nextFilterDeps)
    const nextSortDeps = [inp.sortModel.map((x) => `${x.field}:${x.direction}`).join('|'), cols]
    const sortDirty = filterDirty || !same(S.sortDeps, nextSortDeps)

    const totalOps = opsList.reduce((n, o) => n + opCount(S, o), 0)
    if (totalOps > 0 || carryOrder) {
      const derived = !filterDirty && !sortDirty && !aggDirty && totalOps <= maxIncremental(S)
      try {
        for (const o of opsList) applyOps(S, o, derived)
        if (carryOrder) reorderRoots(S, carryOrder)
      } catch (e) {
        S.model = null // a partial update is not trustworthy: rebuild on the next run
        S.structDeps = []
        S.overlay.upsert.clear() // and don't replay the change that failed
        S.overlay.remove.clear()
        S.overlay.moved = false
        throw e
      }
      if (!derived) {
        S.derivedOk = false
        S.keysValid = false
      }
      changed = true
      if (kind === 'none') kind = 'incremental'
    }

    if (!S.derivedOk || filterDirty) {
      S.filterDeps = nextFilterDeps
      S.passes = createRowFilter(inp.filterModel, cols, inp.ignoreDiacritics, inp.quickFilter)
      if (!same(S.sortDeps, nextSortDeps)) S.keysValid = false
      S.plan = makePlan(inp.sortModel, S.byField)
      S.rawCmps.clear()
      fullFilter(S)
      fullSort(S)
      S.sortDeps = nextSortDeps
      S.derivedOk = true
      changed = true
    } else if (sortDirty) {
      S.keysValid = false
      S.plan = makePlan(inp.sortModel, S.byField)
      S.rawCmps.clear()
      fullSort(S)
      S.sortDeps = nextSortDeps
      changed = true
    } else if (aggDirty) {
      fullFilter(S) // counts and kids are unchanged; this only rebuilds the totals
      changed = true
    }

    if (changed) S.version++
    const nextFlat = [S.version, inp.expandedIds, inp.expandAllByDefault, inp.pagination?.page, inp.pagination?.pageSize, inp.hiddenIds, inp.detailIds, inp.aggSort?.field, inp.aggSort?.direction]
    if (!S.result || !same(S.flatDeps, nextFlat)) {
      S.flatDeps = nextFlat
      S.result = flatten(S)
    }
    S.lastUpdate = kind
    return S.result
  }) as Pipeline<R>

  run.patch = (changes) => {
    S.queue.push(changes)
  }

  Object.defineProperty(run, 'lastUpdate', { get: () => S.lastUpdate })

  return run
}
