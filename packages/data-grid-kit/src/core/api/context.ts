import type { MutableRefObject } from 'react'
import type { ColumnLayout } from '../layout'
import type { Store } from '../store'
import { DataSourceError, type DataSourceController } from '../dataSource'
import type { ServerTree } from '../serverTree'
import type { createPipeline, PipelineResult } from '../pipeline'
import { resolveRange, type CellPoint, type RangeRect } from '../range'
import type { GridApi } from '../gridTypes'
import type { GridOptions, GridState, PaginationModel, RowId } from '../types'

export const identity = (row: any): RowId => row.id

/** the page goes back to the first one whenever sorting or filtering changes */
export function reset(store: Store<GridState>): PaginationModel {
  return { ...store.getState().paginationModel, page: 0 }
}

/** What `useGrid` owns and the API modules need: refs to the latest values, the store, and a few shared helpers. */
export interface ApiRefs<R> {
  store: Store<GridState>
  optionsRef: MutableRefObject<GridOptions<R>>
  resultRef: MutableRefObject<PipelineResult<R> | undefined>
  layoutRef: MutableRefObject<ColumnLayout<R> | undefined>
  ctrlRef: MutableRefObject<DataSourceController<R> | undefined>
  /** tree data / row grouping on the server: every open level has its own controller */
  treeRef: MutableRefObject<ServerTree<R> | undefined>
  pipelineRef: MutableRefObject<ReturnType<typeof createPipeline<R>> | undefined>
  pinningActiveRef: MutableRefObject<boolean>
  apiRef: MutableRefObject<GridApi<R> | undefined>
  /** re-render after the pipeline was patched outside of render */
  bump: () => void
}

export function createApiContext<R>(refs: ApiRefs<R>) {
  const { store, optionsRef, resultRef, layoutRef, ctrlRef, treeRef, pipelineRef, bump } = refs
  const set = (patch: Partial<GridState> | ((s: GridState) => Partial<GridState>)) => {
    const prev = store.getState()
    store.setState(patch)
    const next = store.getState()
    if (next !== prev) optionsRef.current.onStateChange?.(next, prev)
      }
  const resolveMove = (id: RowId, to: { before: RowId | null } | { after: RowId }) => {
    const res = resultRef.current
    if (!res) return null
    const row = res.getRow(id)
    const from = res.dataIndexOf(id)
    if (row === undefined || from < 0) return null
    let beforeId: RowId | null
    if ('before' in to) beforeId = to.before
    else {
      const i = res.dataIndexOf(to.after)
      if (i < 0) return null
      beforeId = res.dataIdAt(i + 1) ?? null
    }
    if (beforeId === id) return null
    const beforeIndex = beforeId === null ? res.dataCount : res.dataIndexOf(beforeId)
    if (beforeIndex < 0) return null
    const targetIndex = from < beforeIndex ? beforeIndex - 1 : beforeIndex
    return targetIndex === from ? null : { row, from, beforeId, targetIndex }
      }
  const persist = async (next: R, old: R, id: RowId): Promise<R> => {
    const o = optionsRef.current
    if (o.dataSource?.updateRow) {
      const params = { rowId: id, updatedRow: next, previousRow: old }
      try {
    return ((await o.dataSource.updateRow(params)) ?? next) as R
      } catch (cause) {
    const error = new DataSourceError('updateRow', params, cause)
    o.onDataSourceError?.(error)
    throw error
      }
    }
    return o.processRowUpdate ? await o.processRowUpdate(next, old) : next
      }
  const commitRows = (rows: R[]) => {
    const ctrl = ctrlRef.current
    if (ctrl && optionsRef.current.dataSource) {
      for (const c of treeRef.current ? treeRef.current.levels.map((l) => l.ctrl) : [ctrl]) c.replaceRows(rows)
      // the server may have placed the row elsewhere: re-read what is in view, quietly
      if (optionsRef.current.dataSource.updateRow) ctrl.revalidate()
    } else pipelineRef.current!.patch({ update: rows })
    bump()
      }
  const leafIdsOf = (id: RowId) => resultRef.current?.getLeafIds(id) ?? [id]
  const rowIdOf = (row: R) => (optionsRef.current.getRowId ?? identity)(row)
  const rectsNow = (): RangeRect[] => {
    const res = resultRef.current
    const layout = layoutRef.current
    const ranges = store.getState().cellSelection
    if (!res || !layout || !ranges.length) return []
    const colIndex = new Map(layout.all.map((c, i) => [c.field, i]))
    const out: RangeRect[] = []
    for (const range of ranges) {
      const rect = resolveRange(range, (id) => res.indexOf(id), (f) => colIndex.get(f) ?? -1)
      if (rect) out.push(rect)
    }
    return out
      }
  const pointAt = (row: number, col: number): CellPoint | null => {
    const r = resultRef.current?.rows[row]
    const c = layoutRef.current?.all[col]
    return r && c ? { rowId: r.id, field: c.field } : null
      }
  const canEdit = (rowId: RowId, field: string) => {
    const o = optionsRef.current
    const row = resultRef.current?.getRow(rowId)
    const col = o.columns.find((c) => c.field === field)
    if (row === undefined || !col || col.editable !== true) return false
    if (col.valueGetter && !col.valueSetter) return false
    return o.isCellEditable ? o.isCellEditable(row, field) : true
      }
  return { ...refs, set, resolveMove, persist, commitRows, leafIdsOf, rowIdOf, rectsNow, pointAt, canEdit }
}

export type ApiContext<R> = ReturnType<typeof createApiContext<R>>
