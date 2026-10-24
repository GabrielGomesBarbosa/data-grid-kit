import { useMemo, useState } from 'react'
import { type RangeRect } from '../core'
import type { GridCtx } from './ctx'
import { pointerDrag } from './pointerDrag'

export function useCellSelection<R>(c: GridCtx<R>) {
  const { cellSelection, api, state, grid, layout, fillHandle, scrollerRef, gridRef } = c

  /* ---- cell selection, fill ---- */

  const rects = useMemo(
    () => (cellSelection ? api.getCellRects() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cellSelection, state.cellSelection, grid.result, layout],
  )
  const [fillPreview, setFillPreview] = useState<RangeRect | null>(null)
  const lastRect = rects[rects.length - 1]

  const rangeKeyFor = (i: number): string => {
    let key = ''
    for (const r of rects) {
      if (i < r.r0 || i > r.r1) continue
      key += `${key ? ',' : ''}s${r.c0}-${r.c1}${i === r.r0 ? 't' : ''}${i === r.r1 ? 'b' : ''}`
    }
    if (fillPreview && i >= fillPreview.r0 && i <= fillPreview.r1) {
      key += `${key ? ',' : ''}f${fillPreview.c0}-${fillPreview.c1}${i === fillPreview.r0 ? 't' : ''}${i === fillPreview.r1 ? 'b' : ''}`
    }
    return key
  }
  const fillColFor = (i: number): number => (cellSelection && fillHandle && lastRect && i === lastRect.r1 ? lastRect.c1 : -1)

  /**
   * Follow the pointer during a drag: calls `onMove` with its position on every move and every frame (the
   * thing under a still pointer changes while the grid scrolls), and scrolls when it nears an edge.
   * Returns a function that stops the drag without calling `onEnd`.
   */
  /** drag from `start`, scrolling the grid when the pointer nears an edge; `onEnd` runs on release */
  const trackPointer = (
    start: { x: number; y: number },
    onMove: (x: number, y: number) => void,
    onEnd: () => void,
  ): (() => void) =>
    pointerDrag(start, {
      onFrame: (x, y) => {
        const el = scrollerRef.current
        const g = gridRef.current
        if (el) {
          const r = el.getBoundingClientRect()
          const edge = 40
          const pinned = (g.pinnedTop.length + g.pinnedBottom.length + (g.footer ? 1 : 0)) * g.rowHeight
          if (x < r.left + g.layout.leftWidth + edge) el.scrollLeft -= 14
          else if (x > r.right - g.layout.rightWidth - edge) el.scrollLeft += 14
          if (y < r.top + g.headerHeight + edge) el.scrollTop -= 14
          else if (y > r.bottom - pinned - edge) el.scrollTop += 14
        }
        onMove(x, y)
      },
      onMove: (x, y) => onMove(x, y),
      onEnd: (outcome) => {
        if (outcome === 'dropped') onEnd()
      },
    })

  const trackDrag = (
    start: { x: number; y: number },
    onCell: (cell: { row: number; col: number }) => void,
    onEnd: (last: { row: number; col: number } | null) => void,
  ) => {
    let last: { row: number; col: number } | null = null
    trackPointer(
      start,
      (x, y) => {
        const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.gk-cell')
        const rowEl = el?.closest<HTMLElement>('.gk-row[data-rowindex]')
        if (!el || !rowEl) return
        const c = { row: Number(rowEl.dataset.rowindex), col: Number(el.getAttribute('aria-colindex')) - 1 }
        if (!last || last.row !== c.row || last.col !== c.col) {
          last = c
          onCell(c)
        }
      },
      () => onEnd(last),
    )
  }

  return { trackPointer, trackDrag, setFillPreview, rangeKeyFor, fillColFor, rects }
}
