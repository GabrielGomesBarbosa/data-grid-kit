import { type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { getCellValue, type ColumnDef, type GridInstance, type RenderRow, type RowId } from '../core'

/** What a row event tells you about the row. `row` is `undefined` for group rows and the total row. */
export interface RowEventParams<R> {
  id: RowId
  row: R | undefined
  /** the grid's row, with its type (data, group, footer), aggregates and so on */
  renderRow: RenderRow<R>
}
export interface CellEventParams<R> extends RowEventParams<R> {
  field: string
  /** the cell's value (what `valueGetter` gives), `undefined` on a group row */
  value: unknown
  colDef: ColumnDef<R>
}
export interface HeaderEventParams<R> {
  field: string
  colDef: ColumnDef<R>
}

/**
 * Events from the user. Each handler gets what was hit and the React event; calling `event.preventDefault()` stops what the
 * grid itself would do for that event (select, focus, edit, sort, a keyboard shortcut). They run before the grid's own handling.
 */
export interface GridEventProps<R> {
  onRowClick?: (params: RowEventParams<R>, event: ReactMouseEvent<HTMLElement>) => void
  onRowDoubleClick?: (params: RowEventParams<R>, event: ReactMouseEvent<HTMLElement>) => void
  onCellClick?: (params: CellEventParams<R>, event: ReactMouseEvent<HTMLElement>) => void
  onCellDoubleClick?: (params: CellEventParams<R>, event: ReactMouseEvent<HTMLElement>) => void
  /** a key was pressed with a cell focused (or inside a cell, such as its editor) */
  onCellKeyDown?: (params: CellEventParams<R>, event: ReactKeyboardEvent<HTMLElement>) => void
  onColumnHeaderClick?: (params: HeaderEventParams<R>, event: ReactMouseEvent<HTMLElement>) => void
  onColumnHeaderDoubleClick?: (params: HeaderEventParams<R>, event: ReactMouseEvent<HTMLElement>) => void
}

/** The capture-phase handlers for the scroller; each is `undefined` when nothing listens, so an app that sets none pays nothing. */
export function useGridEvents<R>(grid: GridInstance<R>, props: GridEventProps<R>) {
  const { onRowClick, onRowDoubleClick, onCellClick, onCellDoubleClick, onCellKeyDown, onColumnHeaderClick, onColumnHeaderDoubleClick } = props

  /** the grid row an element is in: body rows by position, pinned rows and the total row by their id */
  const rowOf = (el: Element | null): RenderRow<R> | undefined => {
    const rowEl = el?.closest<HTMLElement>('.gk-row')
    if (!rowEl) return undefined
    if (rowEl.dataset.rowindex !== undefined) return grid.rows[Number(rowEl.dataset.rowindex)]
    const id = rowEl.dataset.rowId
    if (id === undefined) return undefined
    return [...grid.pinnedTop, ...grid.pinnedBottom, ...(grid.footer ? [grid.footer] : [])].find((r) => String(r.id) === id)
  }
  const rowParams = (r: RenderRow<R>): RowEventParams<R> => ({ id: r.id, row: r.row, renderRow: r })
  const cellParams = (r: RenderRow<R>, field: string): CellEventParams<R> | undefined => {
    const colDef = grid.layout.all.find((c) => c.field === field)
    if (!colDef) return undefined
    return { ...rowParams(r), field, colDef, value: r.row !== undefined ? getCellValue(colDef, r.row) : undefined }
  }

  const click = (rowHandler: typeof onRowClick, cellHandler: typeof onCellClick, headerHandler: typeof onColumnHeaderClick) =>
    rowHandler || cellHandler || headerHandler
      ? (e: ReactMouseEvent<HTMLElement>) => {
          const target = e.target as Element
          const headerCell = target.closest<HTMLElement>('.gk-header-cell')
          if (headerCell) {
            const colDef = grid.layout.all.find((c) => c.field === headerCell.dataset.field)
            if (colDef) headerHandler?.({ field: colDef.field, colDef }, e)
            return
          }
          const r = rowOf(target)
          if (!r) return
          rowHandler?.(rowParams(r), e)
          const field = target.closest<HTMLElement>('.gk-cell')?.dataset.field
          if (field) {
            const params = cellParams(r, field)
            if (params) cellHandler?.(params, e)
          }
        }
      : undefined

  const keyDown =
    onCellKeyDown
      ? (e: ReactKeyboardEvent<HTMLElement>) => {
          const target = e.target as Element
          let r = rowOf(target)
          let field = target.closest<HTMLElement>('.gk-cell')?.dataset.field
          if (!r || !field) {
            // the focus is on the grid itself: the focused cell is the one the key is for
            const f = grid.state.focusedCell
            r = f ? grid.rows.find((x) => x.id === f.rowId) : undefined
            field = f?.field
          }
          if (!r || !field) return
          const params = cellParams(r, field)
          if (params) onCellKeyDown(params, e)
        }
      : undefined

  return {
    onClickCapture: click(onRowClick, onCellClick, onColumnHeaderClick),
    onDoubleClickCapture: click(onRowDoubleClick, onCellDoubleClick, onColumnHeaderDoubleClick),
    onKeyDownCapture: keyDown,
  }
}
