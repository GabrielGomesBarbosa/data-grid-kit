
import type { ApiContext } from './context'
import type { GridApi } from '../gridTypes'

export function rowsApi<R>(c: ApiContext<R>): Pick<GridApi<R>, 'toggleDetailPanel' | 'setDetailPanelExpanded' | 'setDetailPanelHeight' | 'canMoveRow' | 'moveRow' | 'pinRow' | 'toggleSelection' | 'clearSelection' | 'updateRows' | 'refreshData' | 'getDataSourceState'> {
  const { set, resolveMove, pipelineRef, bump, optionsRef, leafIdsOf, ctrlRef } = c
  return {
    toggleDetailPanel(id, open) {
      set((s) => {
        const has = s.detailPanelExpanded.includes(id)
        const on = open ?? !has
        if (on === has) return {}
        return { detailPanelExpanded: on ? [...s.detailPanelExpanded, id] : s.detailPanelExpanded.filter((x) => x !== id) }
      })
    },
    setDetailPanelExpanded: (detailPanelExpanded) => set({ detailPanelExpanded }),
    setDetailPanelHeight(id, height) {
      set((s) => (Math.abs((s.detailHeights[id] ?? -1) - height) < 1 ? {} : { detailHeights: { ...s.detailHeights, [id]: height } }))
    },
    canMoveRow: (id, to) => resolveMove(id, to) !== null,
    moveRow(id, to) {
      const move = resolveMove(id, to)
      if (!move) return false
      pipelineRef.current!.patch({ move: [{ id, before: move.beforeId }] })
      bump()
      optionsRef.current.onRowOrderChange?.({ rowId: id, row: move.row, oldIndex: move.from, targetIndex: move.targetIndex })
      return true
    },
    pinRow(id, side) {
      set((s) => {
        const top = s.pinnedRows.top.filter((x) => x !== id)
        const bottom = s.pinnedRows.bottom.filter((x) => x !== id)
        if (side === 'top') top.push(id)
        if (side === 'bottom') bottom.push(id)
        return { pinnedRows: { top, bottom } }
      })
    },
    toggleSelection(id, selected) {
      const ids = leafIdsOf(id)
      set((s) => {
        const current = new Set(s.selection)
        const all = ids.every((x) => current.has(x))
        const on = selected ?? !all
        for (const x of ids) on ? current.add(x) : current.delete(x)
        return { selection: [...current] }
      })
    },
    clearSelection: () => set({ selection: [] }),
    updateRows(changes) {
      if (optionsRef.current.dataSource) {
        // the server owns which rows exist: only replacing rows that are loaded makes sense
        ctrlRef.current?.replaceRows([...(changes.update ?? []), ...(changes.insert ?? [])])
        bump()
        return
      }
      pipelineRef.current!.patch(changes)
      bump()
    },
    refreshData: () => ctrlRef.current?.refresh(),
    getDataSourceState: () => (optionsRef.current.dataSource ? (ctrlRef.current?.snapshot() ?? null) : null),
  }
}
