import { useRef, type ReactNode } from 'react'
import { useIsomorphicLayoutEffect } from '../core/isomorphic'

/* ------------------------------------------------------------- detail panel */

/**
 * A panel under a row. It spans the whole scrolling width but its content is sticky to the left edge and
 * as wide as the visible area, so it stays in view while the columns scroll sideways.
 */
export function DetailPanel({
  top,
  height,
  auto,
  width,
  totalWidth,
  ariaRow,
  colCount,
  onMeasure,
  children,
}: {
  top: number
  height: number
  auto: boolean
  width: number
  totalWidth: number
  ariaRow: number
  colCount: number
  onMeasure: (height: number) => void
  children: ReactNode
}) {
  const inner = useRef<HTMLDivElement>(null)
  const measure = useRef(onMeasure)
  measure.current = onMeasure
  useIsomorphicLayoutEffect(() => {
    const el = inner.current
    if (!auto || !el) return
    const report = () => measure.current(el.offsetHeight)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [auto])
  return (
    <div role="row" aria-rowindex={ariaRow} className="gk-detail" style={{ top, height, width: totalWidth }}>
      <div role="gridcell" aria-colspan={colCount} className="gk-detail-cell" style={{ width }}>
        <div ref={inner} className="gk-detail-content" data-auto={auto ? '' : undefined}>
          {children}
        </div>
      </div>
    </div>
  )
}
