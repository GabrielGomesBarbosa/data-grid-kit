import type { ApiContext } from './context'
import type { GridApi } from '../gridTypes'
import type { GridState } from '../types'

/**
 * The parts of the state worth saving and bringing back: how the grid is arranged (sorting, filters, page, columns, grouping,
 * aggregation, pivot, density, what is expanded and pinned). Not what only matters for a moment: the viewport, the scroll
 * position, the focus, an edit in progress, a cell range, the selection.
 */
export const PERSISTED_STATE_KEYS = [
  'sortModel',
  'filterModel',
  'paginationModel',
  'columnOrder',
  'columnWidths',
  'columnVisibility',
  'pinnedColumns',
  'rowGroupingModel',
  'expandedIds',
  'expandAllByDefault',
  'pinnedRows',
  'aggregationModel',
  'pivotMode',
  'pivotModel',
  'density',
] as const satisfies readonly (keyof GridState)[]

export function stateApi<R>(c: ApiContext<R>): Pick<GridApi<R>, 'exportState' | 'restoreState'> {
  const { store, set } = c
  return {
    exportState() {
      const s = store.getState()
      return Object.fromEntries(PERSISTED_STATE_KEYS.map((k) => [k, s[k]])) as Partial<GridState>
    },
    restoreState(state) {
      // only what `exportState` gives back: anything else in it (a stale or foreign key) is left alone
      const patch: Record<string, unknown> = {}
      for (const k of PERSISTED_STATE_KEYS) if (state[k] !== undefined) patch[k] = state[k]
      if (Object.keys(patch).length > 0) set(patch as Partial<GridState>)
    },
  }
}
