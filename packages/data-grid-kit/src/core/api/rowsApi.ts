
import type { ApiContext } from './context'
import type { GridApi } from '../gridTypes'
import type { RowId } from '../types'

export function rowsApi<R>(c: ApiContext<R>): Pick<GridApi<R>, 'toggleDetailPanel' | 'setDetailPanelExpanded' | 'setDetailPanelHeight' | 'canMoveRow' | 'moveRow' | 'pinRow' | 'toggleSelection' | 'setSelection' | 'selectAll' | 'isRowSelectable' | 'clearSelection' | 'updateRows' | 'refreshData' | 'getDataSourceState'> {
  const { set, resolveMove, pipelineRef, bump, optionsRef, leafIdsOf, ctrlRef, treeRef, resultRef, rowIdOf } = c
  /** a row `isRowSelectable` accepts; anything it cannot look at (a group, a row not loaded) is allowed */
  const selectable = (id: RowId) => {
    const test = optionsRef.current.isRowSelectable
    if (!test) return true
    const row = resultRef.current?.getRow(id)
    return row === undefined || test({ id, row })
  }
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
    isRowSelectable: (id) => selectable(id),
    toggleSelection(id, selected) {
      const ids = leafIdsOf(id).filter(selectable)
      if (ids.length === 0) return
      set((s) => {
        const current = new Set(s.selection)
        const all = ids.every((x) => current.has(x))
        const on = selected ?? !all
        if (on && optionsRef.current.multipleRowSelection === false) return { selection: [ids[0]!] }
        for (const x of ids) on ? current.add(x) : current.delete(x)
        return { selection: [...current] }
      })
    },
    setSelection(ids) {
      const ok = ids.filter(selectable)
      set({ selection: optionsRef.current.multipleRowSelection === false ? ok.slice(0, 1) : ok })
    },
    selectAll() {
      const res = pipelineRef.current && resultRef.current
      if (!res || optionsRef.current.multipleRowSelection === false) return
      set({ selection: res.getVisibleDataRows().map(rowIdOf).filter(selectable) })
    },
    clearSelection: () => set({ selection: [] }),
    updateRows(changes) {
      if (optionsRef.current.dataSource) {
        // the server owns which rows exist: only replacing rows that are loaded makes sense
        const rows = [...(changes.update ?? []), ...(changes.insert ?? [])]
        for (const level of treeRef.current ? treeRef.current.levels.map((l) => l.ctrl) : [ctrlRef.current]) level?.replaceRows(rows)
        bump()
        return
      }
      pipelineRef.current!.patch(changes)
      bump()
    },
    refreshData: () => (treeRef.current ? treeRef.current.refresh() : ctrlRef.current?.refresh()),
    getDataSourceState: () => (optionsRef.current.dataSource ? ((treeRef.current ?? ctrlRef.current)?.snapshot() ?? null) : null),
  }
}
