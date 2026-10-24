import { useCallback, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { isPrintableKey, navigate, scrollToCell } from '../core'
import { type EditMove } from './Editors'
import type { GridCtx } from './ctx'

export function useKeyboard<R>(c: GridCtx<R>) {
  const { gridRef, scrollerRef, api, hasHierarchy, hierarchyField, cellSelection, selectAllCells, announceMove, hasDetail, checkboxSelection, rows } = c

  /* ---- focus + keyboard ---- */

  const focusAt = useCallback(
    (rowIndex: number, colIndex: number) => {
      const g = gridRef.current
      const r = g.rows[rowIndex]
      const c = g.layout.all[colIndex]
      const el = scrollerRef.current
      if (!c || !el) return
      if (!r) {
        // a row of server data that has not loaded: scroll to it so it does, the focus can follow on the next key
        if (rowIndex >= 0 && rowIndex < g.rows.length) {
          const top = g.geometry.topOf(rowIndex)
          const bodyHeight = el.clientHeight - g.headerHeight
          if (top < el.scrollTop) el.scrollTop = top
          else if (top + g.geometry.heightOf(rowIndex) > el.scrollTop + bodyHeight) el.scrollTop = top + g.geometry.heightOf(rowIndex) - bodyHeight
        }
        return
      }
      g.api.focusCell({ rowId: r.id, field: c.field })
      const next = scrollToCell(
        g.layout,
        c.field,
        rowIndex,
        { top: el.scrollTop, left: el.scrollLeft },
        { width: el.clientWidth, height: el.clientHeight },
        g.geometry.heightOf(rowIndex),
        g.headerHeight,
        (g.pinnedTop.length + g.pinnedBottom.length + (g.footer ? 1 : 0)) * g.rowHeight,
        g.geometry.topOf(rowIndex),
      )
      if (next.top !== el.scrollTop) el.scrollTop = next.top
      if (next.left !== el.scrollLeft) el.scrollLeft = next.left
    },
    [gridRef, scrollerRef],
  )

  const focusPosition = () => {
    const g = gridRef.current
    const cell = g.state.focusedCell
    if (!cell) return null
    const row = g.result.indexOf(cell.rowId)
    const col = g.layout.all.findIndex((c) => c.field === cell.field)
    return row < 0 || col < 0 ? null : { row, col, cell }
  }

  const finishEdit = useCallback(
    async (value: unknown, move?: EditMove) => {
      const g = gridRef.current
      const at = focusPosition()
      const ok = await g.api.commitEdit(value)
      if (!ok) return false
      scrollerRef.current?.focus({ preventScroll: true })
      if (move && at) {
        const key = move === 'down' ? 'ArrowDown' : 'Tab'
        const next = navigate({
          key,
          shift: move === 'left',
          row: at.row,
          col: at.col,
          rowCount: g.rows.length,
          colCount: g.layout.all.length,
          pageRows: 1,
        })
        if (next) focusAt(next.row, next.col)
      }
      return true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focusAt],
  )
  const cancelEdit = useCallback(() => {
    api.cancelEdit()
    scrollerRef.current?.focus({ preventScroll: true })
  }, [api, scrollerRef])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // keys typed into editors, buttons and inputs belong to them
    if (e.target !== e.currentTarget) return
    const g = gridRef.current
    const at = focusPosition()

    if (!at) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageDown', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        focusAt(g.rowRange.start, 0)
      }
      return
    }
    const row = g.rows[at.row]!
    const col = g.layout.all[at.col]!
    const onHierarchyCell = hasHierarchy && col.field === hierarchyField && row.expandable

    if (cellSelection) {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        return selectAllCells()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
        e.preventDefault()
        void g.api.clearSelectedCells()
        return
      }
      if (e.key === 'Escape' && g.state.cellSelection.length) return g.api.clearCellSelection()
    }

    if (e.key === 'ArrowRight' && onHierarchyCell && !row.expanded) {
      e.preventDefault()
      return g.api.toggleExpanded(row.id)
    }
    if (e.key === 'ArrowLeft' && onHierarchyCell && row.expanded) {
      e.preventDefault()
      return g.api.toggleExpanded(row.id)
    }
    // Alt+Shift+↑/↓ moves the focused row (the keyboard way to reorder); Alt+↓/↑ opens/closes its detail panel
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      if (e.shiftKey) {
        const neighbour = g.rows[at.row + (e.key === 'ArrowDown' ? 1 : -1)]
        if (g.reorderAllowed && row.row !== undefined && neighbour?.row !== undefined) {
          const to = e.key === 'ArrowDown' ? { after: neighbour.id } : { before: neighbour.id }
          if (g.api.moveRow(row.id, to)) {
            announceMove(row.id)
            // keep the row in view once it has been re-rendered in its new place
            setTimeout(() => {
              const cur = gridRef.current
              const i = cur.result.indexOf(row.id)
              if (i >= 0) focusAt(i, cur.layout.all.findIndex((c) => c.field === col.field))
            }, 0)
          }
        }
      } else if (hasDetail(row)) {
        g.api.toggleDetailPanel(row.id, e.key === 'ArrowDown')
      }
      return
    }
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault()
      if (g.api.startEdit(row.id, col.field)) return
      if (row.expandable) g.api.toggleExpanded(row.id)
      else if (hasDetail(row)) g.api.toggleDetailPanel(row.id)
      return
    }
    if (e.key === ' ') {
      e.preventDefault()
      if (checkboxSelection) g.api.toggleSelection(row.id)
      return
    }
    if (e.key === 'Escape') return g.api.focusCell(null)
    if (isPrintableKey(e) && g.api.isCellEditable(row.id, col.field)) {
      e.preventDefault()
      g.api.startEdit(row.id, col.field, e.key)
      return
    }
    const next = navigate({
      key: e.key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      row: at.row,
      col: at.col,
      rowCount: g.rows.length,
      colCount: g.layout.all.length,
      pageRows: Math.floor((g.state.viewport.height - g.headerHeight - (g.pinnedTop.length + g.pinnedBottom.length + (g.footer ? 1 : 0)) * g.rowHeight) / g.rowHeight),
    })
    if (next) {
      e.preventDefault()
      if (cellSelection) {
        const dest = g.rows[next.row]
        const destCol = g.layout.all[next.col]
        if (e.shiftKey && e.key !== 'Tab' && dest && destCol) g.api.extendCellSelection({ rowId: dest.id, field: destCol.field })
        else g.api.clearCellSelection() // moving without Shift collapses the selection to the cursor
      }
      focusAt(next.row, next.col)
    }
  }

  const onBodyClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const cell = (e.target as Element).closest<HTMLElement>('.gk-cell')
    const rowEl = cell?.closest<HTMLElement>('.gk-row')
    if (!cell || !rowEl) return
    const r = rows[Number(rowEl.dataset.rowindex)]
    const field = cell.dataset.field
    if (!r || !field) return
    api.focusCell({ rowId: r.id, field })
    const tag = (e.target as Element).tagName
    if (tag !== 'INPUT' && tag !== 'SELECT') scrollerRef.current?.focus({ preventScroll: true })
  }
  const onBodyDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const cell = (e.target as Element).closest<HTMLElement>('.gk-cell')
    const rowEl = cell?.closest<HTMLElement>('.gk-row')
    if (!cell || !rowEl) return
    const r = rows[Number(rowEl.dataset.rowindex)]
    if (r && cell.dataset.field) api.startEdit(r.id, cell.dataset.field)
  }

  return { finishEdit, cancelEdit, onKeyDown, onBodyClick, onBodyDoubleClick }
}
