import type { ColumnLayout } from '../core/layout'
import { renderSections } from './sections'
import { memo, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { type CellRef, type ColumnDef, type CustomAggregation, type Range, type RenderRow } from '../core'
import { type EditMove } from './Editors'
import { type UIColumnDef } from './types'
import { Cell } from './Cell'

/* --------------------------------------------------------------------- row */

export interface RowProps<R> {
  row: RenderRow<R>
  index: number
  gridId: string
  layout: ColumnLayout<R>
  colPos: Map<string, number>
  colRange: Range
  rowHeight: number
  totalWidth: number
  hierarchyField: string | undefined
  hasHierarchy: boolean
  checkbox: boolean
  selected: boolean | 'indeterminate'
  /** only set on the row that holds the focus / editor, so other rows keep stable props */
  focusedField: string | undefined
  editing: CellRef | null
  onToggleExpand: (id: RenderRow['id']) => void
  onToggleSelect: (id: RenderRow['id']) => void
  onCommit: (value: unknown, move?: EditMove) => Promise<boolean>
  onCancel: () => void
  /** pinned rows are laid out in normal flow instead of being absolutely positioned */
  pinSide: 'top' | 'bottom' | undefined
  rowPinning: boolean
  onPinRow: (id: RenderRow['id'], side: 'top' | 'bottom' | null) => void
  /** aria-rowindex of this row (header is 1) */
  ariaRow: number
  aggNames: Record<string, string> | undefined
  aggCustom: Record<string, CustomAggregation<any>> | undefined
  /** encoded selection / fill-preview blocks crossing this row (a string, so memoised rows compare it cheaply) */
  rangeKey: string
  /** column position carrying the fill handle on this row, or -1 */
  fillCol: number
  onFillStart: ((e: ReactPointerEvent<HTMLElement>) => void) | undefined
  /** y of the row's top inside the body (rows are not `rowHeight` apart when detail panels are open) */
  top: number
  detailState: 'open' | 'closed' | undefined
  onToggleDetail: (id: RenderRow['id']) => void
  canReorder: boolean
  onRowDragStart: ((id: RenderRow['id'], e: ReactPointerEvent<HTMLElement>) => void) | undefined
  dragging: boolean
}

interface Seg {
  kind: 's' | 'f'
  c0: number
  c1: number
  t: boolean
  b: boolean
}
const SEG = /^([sf])(\d+)-(\d+)(t?)(b?)$/
const decodeSegs = (key: string): Seg[] =>
  key
    ? key.split(',').map((part) => {
        const m = SEG.exec(part)!
        return { kind: m[1] as 's' | 'f', c0: +m[2]!, c1: +m[3]!, t: !!m[4], b: !!m[5] }
      })
    : []

function RowInner<R>(p: RowProps<R>) {
  const { row, layout, colRange, rowHeight } = p
  const segs = decodeSegs(p.rangeKey)
  const edgesAt = (pos: number): { sel: string | undefined; fill: string | undefined } => {
    let sel: string | undefined
    let fill: string | undefined
    for (const g of segs) {
      if (pos < g.c0 || pos > g.c1) continue
      const e = `${g.t ? 't' : ''}${g.b ? 'b' : ''}${pos === g.c0 ? 'l' : ''}${pos === g.c1 ? 'r' : ''}`
      if (g.kind === 's') sel = (sel ?? '') + e
      else fill = (fill ?? '') + e
    }
    return { sel, fill }
  }
  const cell = (col: UIColumnDef<R>, style: CSSProperties) => {
    const pos = p.colPos.get(col.field) ?? 0
    const edges = edgesAt(pos)
    return (
      <Cell
        key={col.field}
        id={`${p.gridId}-${p.pinSide ? p.pinSide[0] : 'r'}${p.index}-c${pos}`}
        col={col}
        row={row}
        style={style}
        colIndex={pos}
        isHierarchy={col.field === p.hierarchyField}
        hasHierarchy={p.hasHierarchy}
        checkbox={p.checkbox}
        selected={p.selected}
        focused={p.focusedField === col.field}
        editing={p.editing && p.editing.field === col.field ? p.editing : null}
        onToggleExpand={p.onToggleExpand}
        onToggleSelect={p.onToggleSelect}
        onCommit={p.onCommit}
        onCancel={p.onCancel}
        rowPinning={p.rowPinning}
        pinSide={p.pinSide}
        onPinRow={p.onPinRow}
        aggNames={p.aggNames}
        aggCustom={p.aggCustom}
        selEdges={edges.sel}
        fillEdges={edges.fill}
        fillHandle={p.fillCol === pos}
        onFillStart={p.onFillStart}
        detailState={p.detailState}
        onToggleDetail={p.onToggleDetail}
        reorderHandle={p.canReorder}
        onRowDragStart={p.onRowDragStart}
      />
    )
  }

  const centerCells: ReactNode[] = []
  for (let i = colRange.start; i < colRange.end; i++) {
    const col = layout.center[i] as UIColumnDef<R> | undefined
    if (!col) continue
    centerCells.push(
      cell(col, { position: 'absolute', left: layout.centerOffsets[i], width: layout.width(col.field), top: 0, bottom: 0 }),
    )
  }
  const pinned = (cols: ColumnDef<R>[]) =>
    cols.map((c) => cell(c as UIColumnDef<R>, { width: layout.width(c.field), flex: 'none' }))

  return (
    <div
      role="row"
      aria-rowindex={p.ariaRow}
      aria-selected={p.selected === true}
      className="gk-row"
      data-group={row.type === 'group' && row.row === undefined ? '' : undefined}
      data-footer={row.type === 'footer' ? '' : undefined}
      data-detail-open={p.detailState === 'open' ? '' : undefined}
      data-dragging={p.dragging ? '' : undefined}
      data-selected={p.selected === true ? '' : undefined}
      data-odd={p.index % 2 ? '' : undefined}
      data-rowindex={p.pinSide ? undefined : p.index}
      data-pinned={p.pinSide}
      style={
        p.pinSide
          ? { height: rowHeight, width: p.totalWidth }
          : { height: rowHeight, width: p.totalWidth, transform: `translateY(${p.top}px)` }
      }
    >
      {renderSections(layout, pinned(layout.left), centerCells, pinned(layout.right))}
    </div>
  )
}

export const Row = memo(RowInner, (a, b) => {
  const keys = Object.keys(a) as (keyof RowProps<any>)[]
  for (const k of keys) {
    if (k === 'row') continue
    if (!Object.is(a[k], b[k])) return false
  }
  const x = a.row
  const y = b.row
  return (
    x.id === y.id &&
    x.row === y.row &&
    x.depth === y.depth &&
    x.expanded === y.expanded &&
    x.expandable === y.expandable &&
    x.childCount === y.childCount &&
    x.aggregates === y.aggregates
  )
}) as typeof RowInner
