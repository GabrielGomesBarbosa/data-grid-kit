import { useBase } from './base'
import { cx } from './cx'
import { useIcons } from './icons'
import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { aggregationLabel, defaultAlign, formatAggregateValue, formatCellValue, formatDate, formatNumber, getCellValue, type CellRef, type CustomAggregation, type RenderRow } from '../core'
import { useLocaleText } from './localeContext'
import { ActionsCell } from './ActionsCell'
import { CellEditor, type EditMove } from './Editors'
import { type GridProps, type UIColumnDef } from './types'

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
  selectable: boolean
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
  getCellClassName?: GridProps<R>['getCellClassName']
  /** show the grip that starts a row drag */
  reorderHandle: boolean
  onRowDragStart: ((id: RenderRow['id'], e: ReactPointerEvent<HTMLElement>) => void) | undefined
  /** added to the cell's class names (`slotProps.cell`) */
  className?: string
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
  const { text: t, locale } = useLocaleText()
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
    const text = formatAggregateValue(col, aggName, row.aggregates![col.field], locale)
    const label = aggregationLabel(aggName, p.aggCustom, t)
    content = col.pivot ? (
      <span className="gk-agg-pivot" title={t.aggregationOf(label, col.pivot.valueField)}>
        {text}
      </span>
    ) : (
      <span className="gk-agg" title={t.aggregationOf(label, col.headerName ?? col.field)}>
        <span className="gk-agg-label">{label}</span> {text}
      </span>
    )
  } else if (isGroupRow) {
    if (p.isHierarchy) content = <GroupLabel row={row} />
  } else if (col.type === 'actions') {
    content = row.row !== undefined && col.getActions ? <ActionsCell actions={col.getActions({ id: row.id, row: row.row, field: col.field })} /> : null
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
        : formatCellValue(col, row.row, locale)
  }
  const align = defaultAlign(col)
  // classes from the data: the column's, then the grid's; only computed when one was given (most cells have neither)
  let dataClass: string | undefined
  if (col.cellClassName !== undefined || p.getCellClassName) {
    const value = row.row !== undefined ? getCellValue(col, row.row) : undefined
    const fromColumn = typeof col.cellClassName === 'function' ? (row.row !== undefined ? col.cellClassName({ value, row: row.row }) : undefined) : col.cellClassName
    const fromGrid = p.getCellClassName?.({ id: row.id, row: row.row, renderRow: row, field: col.field, colDef: col, value })
    dataClass = cx(fromColumn, fromGrid) || undefined
  }
  return (
    <div
      id={p.id}
      role="gridcell"
      aria-colindex={p.colIndex + 1}
      aria-selected={p.focused || undefined}
      className={cx('gk-cell', dataClass, p.className)}
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
      {p.isHierarchy && <HierarchyControls p={p} isGroupRow={isGroupRow} />}
      {p.editing ? content : <span className="gk-cell-text">{content}</span>}
      {p.fillHandle && <div className="gk-fill-handle" title={t.fillHandle} aria-hidden="true" onPointerDown={p.onFillStart} />}
    </div>
  )
}

/** What leads the first cell of a row: drag grip, selection checkbox, detail and expand toggles, pin buttons. */
function HierarchyControls<R>({ p, isGroupRow }: { p: CellProps<R>; isGroupRow: boolean }) {
  const { Button, Checkbox } = useBase()
  const { text: t } = useLocaleText()
  const icons = useIcons()
  const { row } = p
  return (
    <>
      {p.reorderHandle && (
        <span
          className="gk-row-handle"
          aria-hidden="true"
          title={t.rowDragHandle}
          onPointerDown={(e) => p.onRowDragStart?.(row.id, e)}
        >
          <icons.dragHandle />
        </span>
      )}
      {p.checkbox && (
        <Checkbox
          type="checkbox"
          className="gk-checkbox"
          tabIndex={-1}
          aria-label={t.rowSelect}
          disabled={!p.selectable}
          checked={p.selected === true}
          ref={(el) => {
            if (el) el.indeterminate = p.selected === 'indeterminate'
          }}
          onChange={() => p.onToggleSelect(row.id)}
        />
      )}
      {p.detailState && (
        <Button
          type="button"
          tabIndex={-1}
          className="gk-detail-toggle"
          data-open={p.detailState === 'open' ? '' : undefined}
          aria-expanded={p.detailState === 'open'}
          aria-label={p.detailState === 'open' ? t.detailCollapse : t.detailExpand}
          onClick={() => p.onToggleDetail(row.id)}
        >
          <icons.detailToggle />
        </Button>
      )}
      {p.hasHierarchy &&
        (row.expandable ? (
          <Button
            type="button"
            tabIndex={-1}
            className="gk-toggle"
            aria-label={row.expanded ? t.treeCollapse : t.treeExpand}
            aria-expanded={row.expanded}
            onClick={() => p.onToggleExpand(row.id)}
          >
            {row.expanded ? <icons.collapse /> : <icons.expand />}
          </Button>
        ) : (
          <span className="gk-toggle-spacer" />
        ))}
      {p.rowPinning && !isGroupRow && (
        <span className="gk-rowpin">
          {p.pinSide ? (
            <Button type="button" tabIndex={-1} aria-label={t.rowUnpin} title={t.rowUnpinTitle} onClick={() => p.onPinRow(row.id, null)}>
              <icons.close />
            </Button>
          ) : (
            <>
              <Button type="button" tabIndex={-1} aria-label={t.rowPinTop} title={t.rowPinTopTitle} onClick={() => p.onPinRow(row.id, 'top')}>
                <icons.pinTop />
              </Button>
              <Button type="button" tabIndex={-1} aria-label={t.rowPinBottom} title={t.rowPinBottomTitle} onClick={() => p.onPinRow(row.id, 'bottom')}>
                <icons.pinBottom />
              </Button>
            </>
          )}
        </span>
      )}
    </>
  )
}

export function GroupLabel<R>({ row }: { row: RenderRow<R> }) {
  const { text: t, locale } = useLocaleText()
  if (row.type === 'footer') {
    return (
      <>
        <strong>{t.groupTotal}</strong> <span className="gk-count">({formatNumber(row.childCount, locale)})</span>
      </>
    )
  }
  const text =
    row.groupValue == null || row.groupValue === ''
      ? t.groupEmpty
      : row.groupValue instanceof Date
        ? formatDate(row.groupValue, locale)
        : String(row.groupValue)
  return (
    <>
      <strong>{text}</strong> <span className="gk-count">({row.childCount})</span>
    </>
  )
}
