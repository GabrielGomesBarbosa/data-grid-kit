import type { ColumnLayout } from '../core/layout'
import { cx } from './cx'
import { renderSections } from './sections'
import { memo, type CSSProperties, type ReactNode } from 'react'
import { type ColumnDef, type Range } from '../core'

/* ------------------------------------------------------------------ skeleton */

/** a stable, natural-looking bar width for a (row, column) pair */
const barWidth = (row: number, col: number) => 35 + (((row * 31 + col * 17) * 2654435761) >>> 0) % 50

/**
 * A row whose data has not arrived (server-side data). It mirrors the real row's three column groups so the
 * pinned columns and the horizontal scroll stay where they will be.
 */
export interface SkeletonRowProps {
  index: number
  top: number
  rowHeight: number
  totalWidth: number
  layout: ColumnLayout<any>
  colRange: Range
  ariaRow: number
  /** added to the row's class names and style (`slotProps.skeletonRow`) */
  className?: string
  style?: CSSProperties
}

export const SkeletonRow = memo(function SkeletonRow({
  index,
  top,
  rowHeight,
  totalWidth,
  layout,
  colRange,
  ariaRow,
  className,
  style: extraStyle,
}: SkeletonRowProps) {
  const bar = (field: string, style: CSSProperties, pos: number) => (
    <div key={field} role="gridcell" className="gk-cell" aria-busy="true" style={style}>
      <span className="gk-skel-bar" style={{ width: `${barWidth(index, pos)}%` }} />
    </div>
  )
  const pinned = (cols: ColumnDef<any>[], offset: number) =>
    cols.map((c, i) => bar(c.field, { width: layout.width(c.field), flex: 'none' }, offset + i))
  const center: ReactNode[] = []
  for (let i = colRange.start; i < colRange.end; i++) {
    const col = layout.center[i]
    if (col) {
      center.push(bar(col.field, { position: 'absolute', left: layout.centerOffsets[i], width: layout.width(col.field), top: 0, bottom: 0 }, layout.left.length + i))
    }
  }
  return (
    <div
      role="row"
      aria-rowindex={ariaRow}
      aria-busy="true"
      className={cx('gk-row gk-skeleton', className)}
      data-odd={index % 2 ? '' : undefined}
      style={{ height: rowHeight, width: totalWidth, transform: `translateY(${top}px)`, ...extraStyle }}
    >
      {renderSections(layout, pinned(layout.left, 0), center, pinned(layout.right, layout.left.length + layout.center.length))}
    </div>
  )
})
