import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { fillTarget, formatCellValue, type DropPlacement, type RenderRow } from '../core'
import { Row } from './Row'
import type { GridCtx, RowDrop } from './ctx'

export function useRowDrag<R>(c: GridCtx<R>) {
  const { gridRef, trackPointer, cellSelection, trackDrag, setFillPreview } = c

  /* ---- row drag & drop ---- */

  const [rowDrag, setRowDrag] = useState<{ id: RenderRow['id']; label: string; x: number; y: number; drop: RowDrop | null } | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const announceMove = (id: RenderRow['id']) =>
    setTimeout(() => {
      const res = gridRef.current.result
      setAnnouncement(`Row moved to position ${res.dataIndexOf(id) + 1} of ${res.dataCount}`)
    }, 0)

  const startRowDrag = (id: RenderRow['id'], e: ReactPointerEvent<HTMLElement>) => {
    const g = gridRef.current
    if (!g.reorderAllowed || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const source = g.rows.find((r) => r?.id === id)
    const first = g.layout.all[0]
    const label = source?.row !== undefined && first ? formatCellValue(first, source.row) || String(id) : String(id)
    let drop: RowDrop | null = null
    const dropAt = (x: number, y: number): RowDrop | null => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.gk-body .gk-row[data-rowindex]')
      const over = el ? gridRef.current.rows[Number(el.dataset.rowindex)] : undefined
      if (!el || !over || over.row === undefined || over.id === id) return null
      const rect = el.getBoundingClientRect()
      const placement: DropPlacement = y < rect.top + rect.height / 2 ? 'before' : 'after'
      const to = placement === 'before' ? { before: over.id } : { after: over.id }
      // a drop that would leave the row where it is gets no marker
      return gridRef.current.api.canMoveRow(id, to) ? { target: over.id, placement, rect } : null
    }
    const cleanup = () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.classList.remove('gk-col-dragging')
      setRowDrag(null)
    }
    const stop = trackPointer(
      { x: e.clientX, y: e.clientY },
      (x, y) => {
        drop = dropAt(x, y)
        setRowDrag({ id, label, x, y, drop })
      },
      () => {
        const d = drop
        cleanup()
        if (!d) return
        const to = d.placement === 'before' ? { before: d.target } : { after: d.target }
        if (gridRef.current.api.moveRow(id, to)) announceMove(id)
      },
    )
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      ev.stopPropagation()
      drop = null
      stop()
      cleanup()
    }
    window.addEventListener('keydown', onKey, true)
    document.body.classList.add('gk-col-dragging')
  }
  const startRowDragRef = useRef(startRowDrag)
  startRowDragRef.current = startRowDrag
  const onRowDragStart = useCallback((id: RenderRow['id'], e: ReactPointerEvent<HTMLElement>) => startRowDragRef.current(id, e), [])

  const onBodyPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!cellSelection || e.button !== 0) return
    const target = e.target as Element
    if (target.closest('input, select, textarea, button, .gk-fill-handle')) return
    const cellEl = target.closest<HTMLElement>('.gk-cell')
    const rowEl = cellEl?.closest<HTMLElement>('.gk-row')
    if (!cellEl || !rowEl) return
    const g = gridRef.current
    const r = g.rows[Number(rowEl.dataset.rowindex)]
    const field = cellEl.dataset.field
    if (!r || !field || r.row === undefined) return
    const point = { rowId: r.id, field }
    if (e.shiftKey && (g.state.cellSelection.length || g.state.focusedCell)) {
      g.api.extendCellSelection(point) // before moving the focus: the focused cell is the anchor when there is no range
      g.api.focusCell(point)
    } else {
      g.api.focusCell(point)
      g.api.selectCells({ anchor: point, focus: point }, { add: e.ctrlKey || e.metaKey })
    }
    trackDrag(
      { x: e.clientX, y: e.clientY, pointerType: e.pointerType },
      (c) => {
        const cur = gridRef.current
        const rr = cur.rows[c.row]
        const cc = cur.layout.all[c.col]
        if (rr && cc && rr.row !== undefined) cur.api.extendCellSelection({ rowId: rr.id, field: cc.field })
      },
      () => {},
    )
  }

  const startFill = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const g = gridRef.current
    const all = g.api.getCellRects()
    const source = all[all.length - 1]
    if (!source) return
    trackDrag(
      { x: e.clientX, y: e.clientY },
      (c) => setFillPreview(fillTarget(source, c.row, c.col)),
      (last) => {
        setFillPreview(null)
        if (last && fillTarget(source, last.row, last.col)) void g.api.fillCells(source, { row: last.row, col: last.col })
      },
    )
  }
  const startFillRef = useRef(startFill)
  startFillRef.current = startFill
  const onFillStart = useCallback((e: ReactPointerEvent<HTMLElement>) => startFillRef.current(e), [])

  const selectAllCells = () => {
    const g = gridRef.current
    const first = g.rows.findIndex((r) => r?.row !== undefined)
    let last = -1
    for (let i = g.rows.length - 1; i >= 0; i--) {
      if (g.rows[i]?.row !== undefined) {
        last = i
        break
      }
    }
    const a = g.layout.all[0]
    const b = g.layout.all[g.layout.all.length - 1]
    if (first < 0 || !a || !b) return
    g.api.selectCells({ anchor: { rowId: g.rows[first]!.id, field: a.field }, focus: { rowId: g.rows[last]!.id, field: b.field } })
  }

  return { selectAllCells, announceMove, onFillStart, onRowDragStart, rowDrag, onBodyPointerDown, announcement }
}
