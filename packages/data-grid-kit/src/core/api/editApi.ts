import { DataSourceError } from '../dataSource'
import type { ApiContext } from './context'
import type { GridApi } from '../gridTypes'
import type { ColumnDef, EditStopReason, RowId } from '../types'

type EditApi<R> = Pick<
  GridApi<R>,
  'isCellEditable' | 'startEdit' | 'cancelEdit' | 'commitEdit' | 'startRowEdit' | 'setEditValue' | 'commitRowEdit' | 'cancelRowEdit'
>

/** Editing one cell at a time (`editMode: 'cell'`) or a whole row (`'row'`), with events and validation. */
export function editApi<R>(c: ApiContext<R>): EditApi<R> {
  const { canEdit, set, store, optionsRef, resultRef, persist, commitRows } = c
  const rowMode = () => optionsRef.current.editMode === 'row'
  const columnOf = (field: string) => optionsRef.current.columns.find((col) => col.field === field)
  const clearEditing = () => set({ editingCell: null, editingRow: null, editDraft: {}, editErrors: {} })

  /** the message `validate` gives for a value, or undefined when it is fine (a `validate` that throws refuses with the error's message) */
  const check = async (col: ColumnDef<R> | undefined, row: R, value: unknown): Promise<string | undefined> => {
    if (!col?.validate) return undefined
    try {
      const result = await col.validate({ value, row, field: col.field })
      return typeof result === 'string' && result !== '' ? result : undefined
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }
  const setError = (field: string, message: string | undefined) =>
    set((s) => {
      if (message !== undefined) return s.editErrors[field] === message ? {} : { editErrors: { ...s.editErrors, [field]: message } }
      if (!(field in s.editErrors)) return {}
      const { [field]: _gone, ...rest } = s.editErrors
      return { editErrors: rest }
    })

  /** the value `field` has now: what was typed in row mode, else what the row holds */
  const rawOf = (row: R, field: string) => {
    const col = columnOf(field)
    return col?.valueGetter ? col.valueGetter(row) : (row as Record<string, unknown>)[field]
  }
  /** `row` with `value` written into `field` the way the column says */
  const withValue = (row: R, col: ColumnDef<R>, value: unknown): R => (col.valueSetter ? col.valueSetter(value, row) : ({ ...row, [col.field]: value } as R))
  const same = (a: R, b: R) => a === b || Object.keys(a as object).every((k) => Object.is((a as any)[k], (b as any)[k]))

  /** save `next` in place of `old`; false when the app refused it */
  const save = async (next: R, old: R, id: RowId): Promise<boolean> => {
    try {
      const kept = await persist(next, old, id)
      commitRows([kept])
      return true
    } catch (error) {
      if (!(error instanceof DataSourceError)) optionsRef.current.onProcessRowUpdateError?.(error)
      return false
    }
  }

  const lastCheck = new Map<string, number>() // the newest check of a field wins, whatever order the answers come in

  const api: EditApi<R> = {
    isCellEditable: canEdit,

    startEdit(rowId, field, seed) {
      if (!canEdit(rowId, field)) return false
      if (rowMode()) {
        if (!api.startRowEdit(rowId, field)) return false
        set({ editingCell: { rowId, field, seed } })
        return true
      }
      const row = resultRef.current?.getRow(rowId)
      if (row !== undefined && optionsRef.current.onCellEditStart?.({ id: rowId, field, row }) === false) return false
      set({ editingCell: { rowId, field, seed }, focusedCell: { rowId, field }, editDraft: {}, editErrors: {} })
      return true
    },

    startRowEdit(rowId, field) {
      const row = resultRef.current?.getRow(rowId)
      if (row === undefined) return false
      const editable = optionsRef.current.columns.filter((col) => canEdit(rowId, col.field))
      if (editable.length === 0) return false
      if (optionsRef.current.onRowEditStart?.({ id: rowId, row }) === false) return false
      const focus = editable.find((col) => col.field === field)?.field ?? editable[0]!.field
      set({ editingRow: rowId, editingCell: { rowId, field: focus }, focusedCell: { rowId, field: focus }, editDraft: {}, editErrors: {} })
      return true
    },

    setEditValue(field, value) {
      const s = store.getState()
      const id = s.editingRow ?? s.editingCell?.rowId
      if (id === undefined || id === null) return
      if (s.editingRow !== null) set((cur) => ({ editDraft: { ...cur.editDraft, [field]: value } }))
      const row = resultRef.current?.getRow(id)
      if (row === undefined) return
      const n = (lastCheck.get(field) ?? 0) + 1
      lastCheck.set(field, n)
      void check(columnOf(field), row, value).then((message) => {
        const now = store.getState()
        if (lastCheck.get(field) === n && (now.editingRow ?? now.editingCell?.rowId) === id) setError(field, message)
      })
    },

    cancelEdit(reason = 'api') {
      const s = store.getState()
      if (s.editingRow !== null) return api.cancelRowEdit(reason)
      const cell = s.editingCell
      const row = cell ? resultRef.current?.getRow(cell.rowId) : undefined
      if (cell && row !== undefined && optionsRef.current.onCellEditStop?.({ id: cell.rowId, field: cell.field, row, reason, cancelled: true }) === false) return
      clearEditing()
    },

    cancelRowEdit(reason = 'api') {
      const id = store.getState().editingRow
      if (id === null) return
      const row = resultRef.current?.getRow(id)
      if (row !== undefined && optionsRef.current.onRowEditStop?.({ id, row, reason, cancelled: true }) === false) return
      clearEditing()
    },

    async commitEdit(value, reason = 'api') {
      const s = store.getState()
      const cell = s.editingCell
      if (s.editingRow !== null) {
        // in a row, what the cell holds joins the rest and the row is saved
        if (cell && value !== undefined) set((cur) => ({ editDraft: { ...cur.editDraft, [cell.field]: value } }))
        return api.commitRowEdit(reason)
      }
      const oldRow = cell ? resultRef.current?.getRow(cell.rowId) : undefined
      const col = cell ? columnOf(cell.field) : undefined
      if (!cell || oldRow === undefined || !col) {
        clearEditing()
        return false
      }
      if (optionsRef.current.onCellEditStop?.({ id: cell.rowId, field: cell.field, row: oldRow, reason, cancelled: false }) === false) return false
      const problem = await check(col, oldRow, value)
      if (problem !== undefined) {
        setError(col.field, problem)
        return false
      }
      const newRow = withValue(oldRow, col, value)
      if (same(newRow, oldRow)) {
        clearEditing()
        return true
      }
      if (!(await save(newRow, oldRow, cell.rowId))) return false
      const now = store.getState().editingCell
      if (now && now.rowId === cell.rowId && now.field === cell.field) clearEditing()
      return true
    },

    async commitRowEdit(reason: EditStopReason = 'api') {
      const s = store.getState()
      const id = s.editingRow
      if (id === null) return false
      const oldRow = resultRef.current?.getRow(id)
      if (oldRow === undefined) {
        clearEditing()
        return false
      }
      if (optionsRef.current.onRowEditStop?.({ id, row: oldRow, reason, cancelled: false }) === false) return false
      const editable = optionsRef.current.columns.filter((col) => canEdit(id, col.field))
      // every editable cell is checked, typed in or not: a row that was already wrong cannot be saved as it is
      const errors: Record<string, string> = {}
      for (const col of editable) {
        const message = await check(col, oldRow, col.field in s.editDraft ? s.editDraft[col.field] : rawOf(oldRow, col.field))
        if (message !== undefined) errors[col.field] = message
      }
      if (Object.keys(errors).length > 0) {
        set({ editErrors: errors })
        return false
      }
      let next: R = oldRow
      for (const col of editable) if (col.field in store.getState().editDraft) next = withValue(next, col, store.getState().editDraft[col.field])
      if (same(next, oldRow)) {
        clearEditing()
        return true
      }
      if (!(await save(next, oldRow, id))) return false
      if (store.getState().editingRow === id) clearEditing()
      return true
    },
  }
  return api
}
