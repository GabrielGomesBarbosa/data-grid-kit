import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { useIsomorphicLayoutEffect } from '../../core/isomorphic'
import type { GridApi, GridInstance, Range, RowGeometry } from '../../core'

/** is any part of the visible body not covered by the rows that are rendered right now? */
function exposesUnrenderedRows(grid: { rowRange: Range; geometry: RowGeometry; headerHeight: number }, el: HTMLElement): boolean {
  const { rowRange, geometry } = grid
  const count = geometry.count
  if (count === 0) return false
  const top = el.scrollTop
  const bottom = top + el.clientHeight - grid.headerHeight
  const from = geometry.topOf(Math.min(rowRange.start, count - 1))
  const to = rowRange.end >= count ? geometry.totalHeight : geometry.topOf(rowRange.end)
  return (top < from && rowRange.start > 0) || (bottom > to && rowRange.end < count)
}

/**
 * Keeps the viewport size and the scroll position of the scroller in the store. Returns the `onScroll` handler for the scroller.
 */
export function useViewport<R>(api: GridApi<R>, scrollerRef: RefObject<HTMLDivElement>, gridRef: MutableRefObject<GridInstance<R>>): () => void {
  // keep the viewport size in the store
  useIsomorphicLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const measure = () => api.setViewport(el.clientWidth, el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [api, scrollerRef])

  // One store write per frame, regardless of how many scroll events fire. But when the scroll has already left the
  // rendered rows (a scrollbar dragged fast), waiting for the frame would paint an empty region first: commit that
  // one at once, inside the event, like MUI does with flushSync.
  const frame = useRef(0)
  const onScroll = useCallback(() => {
    const el = scrollerRef.current
    if (el && exposesUnrenderedRows(gridRef.current, el)) {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      flushSync(() => api.setScroll(el.scrollTop, el.scrollLeft))
      return
    }
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const e = scrollerRef.current
      if (e) api.setScroll(e.scrollTop, e.scrollLeft)
    })
  }, [api, scrollerRef, gridRef])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  return onScroll
}
