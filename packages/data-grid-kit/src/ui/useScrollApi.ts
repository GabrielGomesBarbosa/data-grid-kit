import { useEffect, type MutableRefObject, type RefObject } from 'react'
import type { GridApi, GridInstance, ScrollHandler } from '../core'

/**
 * Registers how this grid scrolls to a row or a column, and puts the scroll position given in `initialState.scroll` on the
 * element (the rows drawn follow the state, so the element must be where the state says).
 */
export function useScrollApi<R>(api: GridApi<R>, scrollerRef: RefObject<HTMLDivElement>, gridRef: MutableRefObject<GridInstance<R>>) {
  useEffect(() => {
    const handler: ScrollHandler = ({ rowIndex, colIndex, align }) => {
      const el = scrollerRef.current
      const g = gridRef.current
      if (!el) return
      let { scrollTop: top, scrollLeft: left } = el
      if (rowIndex !== undefined && rowIndex >= 0 && rowIndex < g.rows.length) {
        const y = g.geometry.topOf(rowIndex)
        const h = g.geometry.heightOf(rowIndex)
        // the body is what the header, the pinned rows and the total row leave
        const pinned = (g.pinnedTop.length + g.pinnedBottom.length + (g.footer ? 1 : 0)) * g.rowHeight
        const view = Math.max(0, el.clientHeight - g.headerHeight - pinned)
        if (align === 'start') top = y
        else if (align === 'end') top = y + h - view
        else if (align === 'center') top = y - (view - h) / 2
        else if (y < top) top = y
        else if (y + h > top + view) top = y + h - view
      }
      const col = colIndex === undefined ? undefined : g.layout.all[colIndex]
      if (col && !g.layout.pinnedSide.has(col.field)) {
        // pinned columns are always in view: only the scrolling ones are scrolled to
        const i = g.layout.center.findIndex((c) => c.field === col.field)
        const x = g.layout.centerOffsets[i]!
        const w = g.layout.centerOffsets[i + 1]! - x
        const view = Math.max(0, el.clientWidth - g.layout.leftWidth - g.layout.rightWidth)
        if (align === 'start') left = x
        else if (align === 'end') left = x + w - view
        else if (align === 'center') left = x - (view - w) / 2
        else if (x < left) left = x
        else if (x + w > left + view) left = x + w - view
      }
      top = Math.max(0, Math.round(top))
      left = Math.max(0, Math.round(left))
      el.scrollTop = top
      el.scrollLeft = left
      api.setScroll(el.scrollTop, el.scrollLeft) // the element's own scroll event follows; the rows should not wait for it
    }
    api.setScrollHandler(handler)
    return () => api.setScrollHandler(null)
  }, [api, scrollerRef, gridRef])

  // restore a scroll position the grid was started with
  useEffect(() => {
    const el = scrollerRef.current
    const { top, left } = gridRef.current.state.scroll
    if (el && (top > 0 || left > 0)) {
      el.scrollTop = top
      el.scrollLeft = left
    }
    // once, when the grid appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
