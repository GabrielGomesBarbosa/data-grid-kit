import { DataSourceError } from '../dataSource'
import type { ApiContext } from './context'
import type { GridApi } from '../gridTypes'

export function editApi<R>(c: ApiContext<R>): Pick<GridApi<R>, 'isCellEditable' | 'startEdit' | 'cancelEdit' | 'commitEdit'> {
  const { canEdit, set, store, optionsRef, resultRef, persist, commitRows } = c
  return {
    isCellEditable: canEdit,
    startEdit(rowId, field, seed) {
      if (!canEdit(rowId, field)) return false
      set({ editingCell: { rowId, field, seed }, focusedCell: { rowId, field } })
      return true
    },
    cancelEdit: () => set({ editingCell: null }),
    async commitEdit(value) {
      const cell = store.getState().editingCell
      const o = optionsRef.current
      const oldRow = cell ? resultRef.current?.getRow(cell.rowId) : undefined
      const col = cell ? o.columns.find((c) => c.field === cell.field) : undefined
      if (!cell || oldRow === undefined || !col) {
        set({ editingCell: null })
        return false
      }
      const newRow = col.valueSetter
        ? col.valueSetter(value, oldRow)
        : ({ ...oldRow, [col.field]: value } as R)
      const unchanged =
        newRow === oldRow ||
        Object.keys(newRow as object).every((k) => Object.is((newRow as any)[k], (oldRow as any)[k]))
      if (unchanged) {
        set({ editingCell: null })
        return true
      }
      try {
        const kept = await persist(newRow, oldRow, cell.rowId)
        commitRows([kept])
        const now = store.getState().editingCell
        if (now && now.rowId === cell.rowId && now.field === cell.field) set({ editingCell: null })
        return true
      } catch (error) {
        if (!(error instanceof DataSourceError)) o.onProcessRowUpdateError?.(error)
        return false
      }
    },
  }
}
