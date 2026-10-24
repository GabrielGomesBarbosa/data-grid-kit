import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { aggregationLabel, defaultAlign, formatAggregateValue, formatCellValue, getCellValue, type CellRef, type CustomAggregation, type RenderRow } from '../core'
import { CellEditor, type EditMove } from './Editors'
import { type UIColumnDef } from './types'

const INDENT = 18

/* -------------------------------------------------------------------- cell */

export interface CellProps<R> {
  col: UIColumnDef<R>
  row: RenderRow<R>
  style: CSSProperties
  id: string
  colIndex: number
  isHierarchy: boolean
  hasHierarchy: boolean
  checkbox: boolean
  selected: boolean | 'indeterminate'
  focused: boolean
  editing: CellRef | null
  onToggleExpand: (id: RenderRow['id']) => void
  onToggleSelect: (id: RenderRow['id']) => void
  onCommit: (value: unknown, move?: EditMove) => Promise<boolean>
  onCancel: () => void
  rowPinning: boolean
  pinSide: 'top' | 'bottom' | undefined
  onPinRow: (id: RenderRow['id'], side: 'top' | 'bottom' | null) => void
  /** field → aggregation function name, for the labels next to aggregated values */
  aggNames: Record<string, string> | undefined
  aggCustom: Record<string, CustomAggregation<any>> | undefined
  /** which edges of the selected block this cell sits on: any of t b l r ('' = interior); undefined = not selected */
  selEdges: string | undefined
  /** same, for the preview of a fill drag */
  fillEdges: string | undefined
  /** this cell carries the fill handle */
  fillHandle: boolean
  onFillStart: ((e: ReactPointerEvent<HTMLElement>) => void) | undefined
  /** undefined: this row has no detail panel */
  detailState: 'open' | 'closed' | undefined
  onToggleDetail: (id: RenderRow['id']) => void
  /** show the grip that starts a row drag */
  reorderHandle: boolean
  onRowDragStart: ((id: RenderRow['id'], e: ReactPointerEvent<HTMLElement>) => void) | undefined
}

const edgeVars = (prefix: string, edges: string | undefined): CSSProperties | undefined =>
  edges === undefined
    ? undefined
    : ({
        [`--gk-${prefix}t`]: edges.includes('t') ? '2px' : '0px',
        [`--gk-${prefix}b`]: edges.includes('b') ? '2px' : '0px',
        [`--gk-${prefix}l`]: edges.includes('l') ? '2px' : '0px',
        [`--gk-${prefix}r`]: edges.includes('r') ? '2px' : '0px',
      } as CSSProperties)

export function Cell<R>(p: CellProps<R>) {
  const { col, row } = p
  const isGroupRow = (row.type === 'group' && row.row === undefined) || row.type === 'footer'
  const aggName = p.aggNames?.[col.field]
  const aggregated = aggName !== undefined && row.aggregates !== undefined && col.field in row.aggregates
  let content: ReactNode = null
  if (p.editing && row.row !== undefined) {
    content = (
      <CellEditor col={col} row={row.row} seed={p.editing.seed} onCommit={p.onCommit} onCancel={p.onCancel} />
    )
  } else if (aggregated && !(p.isHierarchy && isGroupRow)) {
    // group rows, tree parents and the total row show the aggregate instead of a cell value
    const text = formatAggregateValue(col, aggName, row.aggregates![col.field])
    content = col.pivot ? (
      <span className="gk-agg-pivot" title={`${aggregationLabel(aggName, p.aggCustom)} of ${col.pivot.valueField}`}>
        {text}
      </span>
    ) : (
      <span className="gk-agg" title={`${aggregationLabel(aggName, p.aggCustom)} of ${col.headerName ?? col.field}`}>
        <span className="gk-agg-label">{aggregationLabel(aggName, p.aggCustom)}</span> {text}
      </span>
    )
  } else if (isGroupRow) {
    if (p.isHierarchy) content = <GroupLabel row={row} />
  } else if (row.row !== undefined) {
    const value = getCellValue(col, row.row)
    content = col.renderCell
      ? col.renderCell({ value, row: row.row })
      : col.type === 'boolean'
        ? value === true
          ? '✓'
          : value === false
            ? ''
            : ''
        : formatCellValue(col, row.row)
  }
  const align = defaultAlign(col)
  return (
    <div
      id={p.id}
      role="gridcell"
      aria-colindex={p.colIndex + 1}
      aria-selected={p.focused || undefined}
      className="gk-cell"
      data-align={align}
      data-field={col.field}
      data-focused={p.focused ? '' : undefined}
      data-editing={p.editing ? '' : undefined}
      data-in-range={p.selEdges !== undefined ? '' : undefined}
      data-fill={p.fillEdges !== undefined ? '' : undefined}
      style={{
        ...p.style,
        ...edgeVars('s', p.selEdges),
        ...edgeVars('f', p.fillEdges),
        paddingLeft: p.isHierarchy && p.hasHierarchy ? 8 + row.depth * INDENT : undefined,
      }}
    >
      {p.isHierarchy && p.reorderHandle && (
        <span
          className="gk-row-handle"
          aria-hidden="true"
          title="Drag to move this row (or Alt+Shift+↑ / ↓)"
          onPointerDown={(e) => p.onRowDragStart?.(row.id, e)}
        >
          ⋮⋮
        </span>
      )}
      {p.isHierarchy && p.checkbox && (
        <input
          type="checkbox"
          className="gk-checkbox"
          tabIndex={-1}
          aria-label="Select row"
          checked={p.selected === true}
          ref={(el) => {
            if (el) el.indeterminate = p.selected === 'indeterminate'
          }}
          onChange={() => p.onToggleSelect(row.id)}
        />
      )}
      {p.isHierarchy && p.detailState && (
        <button
          type="button"
          tabIndex={-1}
          className="gk-detail-toggle"
          data-open={p.detailState === 'open' ? '' : undefined}
          aria-expanded={p.detailState === 'open'}
          aria-label={p.detailState === 'open' ? 'Collapse details' : 'Expand details'}
          onClick={() => p.onToggleDetail(row.id)}
        >
          ›
        </button>
      )}
      {p.isHierarchy &&
        p.hasHierarchy &&
        (row.expandable ? (
          <button
            type="button"
            tabIndex={-1}
            className="gk-toggle"
            aria-label={row.expanded ? 'Collapse' : 'Expand'}
            aria-expanded={row.expanded}
            onClick={() => p.onToggleExpand(row.id)}
          >
            {row.expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="gk-toggle-spacer" />
        ))}
      {p.isHierarchy && p.rowPinning && !isGroupRow && (
        <span className="gk-rowpin">
          {p.pinSide ? (
            <button type="button" tabIndex={-1} aria-label="Unpin row" title="Unpin row" onClick={() => p.onPinRow(row.id, null)}>
              ✕
            </button>
          ) : (
            <>
              <button type="button" tabIndex={-1} aria-label="Pin row to top" title="Pin to top" onClick={() => p.onPinRow(row.id, 'top')}>
                ▲
              </button>
              <button type="button" tabIndex={-1} aria-label="Pin row to bottom" title="Pin to bottom" onClick={() => p.onPinRow(row.id, 'bottom')}>
                ▼
              </button>
            </>
          )}
        </span>
      )}
      {p.editing ? content : <span className="gk-cell-text">{content}</span>}
      {p.fillHandle && <div className="gk-fill-handle" title="Drag to fill" aria-hidden="true" onPointerDown={p.onFillStart} />}
    </div>
  )
}

export function GroupLabel<R>({ row }: { row: RenderRow<R> }) {
  if (row.type === 'footer') {
    return (
      <>
        <strong>Total</strong> <span className="gk-count">({row.childCount.toLocaleString()})</span>
      </>
    )
  }
  const text =
    row.groupValue == null || row.groupValue === ''
      ? '(empty)'
      : row.groupValue instanceof Date
        ? row.groupValue.toLocaleDateString()
        : String(row.groupValue)
  return (
    <>
      <strong>{text}</strong> <span className="gk-count">({row.childCount})</span>
    </>
  )
}
