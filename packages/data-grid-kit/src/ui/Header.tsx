import { useMemo, type CSSProperties, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { ColumnDef, GridInstance } from '../core'
import { useSlots } from './slotsContext'
import { headerGroupSpans, type GroupSpan } from './headerGroups'
import { renderSections } from './sections'
import type { UIColumnDef } from './types'

export interface HeaderProps<R> {
  grid: GridInstance<R>
  /** column field → position among all visible columns (for aria-colindex) */
  colPos: Map<string, number>
  controls: boolean
  reorder: boolean
  onOpenMenu: (field: string, anchor: DOMRect) => void
  /** a double click on a column's divider: fit it to its content */
  onAutosize: (field: string) => void
  onDragIntent: (field: string, e: ReactPointerEvent<HTMLElement>) => void
  justDragged: MutableRefObject<boolean>
  totalWidth: number
}

/** The header: one row per level of column groups, then the column titles. */
export function Header<R>(p: HeaderProps<R>) {
  const { grid, colPos, totalWidth } = p
  const { layout, colRange, headerHeight, headerRowHeight, headerDepth } = grid
  const spans = useMemo(
    () => ({
      left: headerGroupSpans(layout.left, headerDepth),
      center: headerGroupSpans(layout.center, headerDepth),
      right: headerGroupSpans(layout.right, headerDepth),
    }),
    [layout, headerDepth],
  )

  const { slots, slotProps } = useSlots<R>()
  const HeaderCellSlot = slots.headerCell
  const title = (c: ColumnDef<R>, style: CSSProperties) => (
    <HeaderCellSlot
      key={c.field}
      col={c as UIColumnDef<R>}
      colIndex={colPos.get(c.field) ?? 0}
      grid={grid}
      controls={p.controls}
      onOpenMenu={p.onOpenMenu}
      onAutosize={p.onAutosize}
      onDragIntent={p.reorder && c.reorderable !== false ? p.onDragIntent : undefined}
      suppressClick={() => p.justDragged.current}
      {...slotProps.headerCell}
      style={{ ...style, ...slotProps.headerCell?.style }}
    />
  )
  const pinnedTitles = (cols: ColumnDef<R>[]) => cols.map((c) => title(c, { width: layout.width(c.field), flex: 'none' }))
  const centerTitles: ReactNode[] = []
  for (let i = colRange.start; i < colRange.end; i++) {
    const c = layout.center[i]
    if (c) centerTitles.push(title(c, { position: 'absolute', left: layout.centerOffsets[i], width: layout.width(c.field), top: 0, bottom: 0 }))
  }

  const groupCell = (sp: GroupSpan, style: CSSProperties, labelLeft: number) => (
    <div key={sp.key} role="columnheader" aria-colspan={sp.end - sp.start} className="gk-header-group" style={style} title={sp.label}>
      <span className="gk-header-group-label" style={{ left: labelLeft }}>
        {sp.label}
      </span>
    </div>
  )
  const widthOf = (cols: ColumnDef<R>[], a: number, b: number) => cols.slice(a, b).reduce((w, c) => w + layout.width(c.field), 0)
  const pinnedGroups = (cols: ColumnDef<R>[], list: GroupSpan[]) =>
    list.map((sp) => groupCell(sp, { width: widthOf(cols, sp.start, sp.end), flex: 'none' }, 0))
  const rowProps = { className: 'gk-header-row', role: 'row' as const }

  const groupRows: ReactNode[] = []
  for (let lv = 0; lv < headerDepth; lv++) {
    const centerGroups: ReactNode[] = []
    for (const sp of spans.center[lv]!) {
      if (sp.end <= colRange.start || sp.start >= colRange.end) continue // not near the viewport
      const x = layout.centerOffsets[sp.start]!
      centerGroups.push(groupCell(sp, { position: 'absolute', left: x, width: layout.centerOffsets[sp.end]! - x, top: 0, bottom: 0 }, layout.leftWidth))
    }
    groupRows.push(
      <div key={lv} {...rowProps} aria-rowindex={1 + lv} style={{ height: headerRowHeight, width: totalWidth }}>
        {renderSections(layout, pinnedGroups(layout.left, spans.left[lv]!), centerGroups, pinnedGroups(layout.right, spans.right[lv]!))}
      </div>,
    )
  }

  return (
    <div className="gk-header" role="rowgroup" style={{ height: headerHeight, width: totalWidth }}>
      {groupRows}
      <div {...rowProps} aria-rowindex={1 + headerDepth} style={{ height: headerRowHeight, width: totalWidth }}>
        {renderSections(layout, pinnedTitles(layout.left), centerTitles, pinnedTitles(layout.right))}
      </div>
    </div>
  )
}
