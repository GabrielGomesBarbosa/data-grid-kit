import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import type { GridInstance, RowId } from '../core'
import { useIsomorphicLayoutEffect } from '../core/isomorphic'

/**
 * Rows whose `getRowHeight` is `'auto'` are sized by their content. After every render, and whenever a cell of such a row
 * changes size (a font loads, an image arrives, a column is resized), the rows on screen are measured and the heights are
 * reported to the grid, which moves the rows below. A row that changes above the visible rows would push what the user is
 * reading, so the scroll position moves by the same amount.
 */
export function useAutoRowHeights<R>(enabled: boolean, scrollerRef: RefObject<HTMLDivElement>, gridRef: MutableRefObject<GridInstance<R>>) {
  const shift = useRef(0)
  const passes = useRef(0)
  const frame = useRef(0)
  const observer = useRef<ResizeObserver>()

  const measure = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const g = gridRef.current
    const top = g.geometry.indexAt(el.scrollTop)
    const updates = new Map<RowId, number>()
    let moved = 0
    el.querySelectorAll<HTMLElement>('.gk-row[data-auto]').forEach((rowEl) => {
      const index = Number(rowEl.dataset.rowindex)
      const row = g.rows[index]
      if (!row) return
      let h = 0
      rowEl.querySelectorAll<HTMLElement>('.gk-cell').forEach((cell) => (h = Math.max(h, cell.offsetHeight)))
      h = Math.ceil(h)
      const now = g.geometry.heightOf(index)
      if (h <= 0 || Math.abs(h - now) < 1) return
      updates.set(row.id, h)
      if (index < top) moved += h - now
    })
    if (!updates.size) return
    // content that depends on the row's own height never settles: stop after a few passes in one frame
    if (++passes.current > 8) return
    shift.current += moved
    g.reportRowHeights(updates)
  }, [scrollerRef, gridRef])

  // the new positions are on screen: move the scroll by what the rows above the view grew or shrank
  const geometry = gridRef.current.geometry
  useIsomorphicLayoutEffect(() => {
    const el = scrollerRef.current
    if (el && shift.current) {
      el.scrollTop += shift.current
      shift.current = 0
    }
  }, [geometry, scrollerRef])

  useIsomorphicLayoutEffect(() => {
    if (!enabled) return
    measure()
    if (!frame.current) {
      frame.current = requestAnimationFrame(() => {
        frame.current = 0
        passes.current = 0
      })
    }
  })

  // later changes of size: watch the cells of the rows on screen
  useEffect(() => {
    if (!enabled || typeof ResizeObserver === 'undefined') return
    const ro = (observer.current ??= new ResizeObserver(() => measure()))
    ro.disconnect()
    scrollerRef.current?.querySelectorAll('.gk-row[data-auto] .gk-cell').forEach((cell) => ro.observe(cell))
  })
  useEffect(() => () => {
    observer.current?.disconnect()
    cancelAnimationFrame(frame.current)
  }, [])
}
