import {
  memo,
  useCallback,
  useMemo,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type ReactNode,
} from 'react'
import {
  aggregationLabel,
  countCells,
  defaultAlign,
  fillTarget,
  formatAggregateValue,
  defaultFilterItem,
  formatCellValue,
  getCellValue,
  isPrintableKey,
  navigate,
  planColumnMove,
  scrollToCell,
  useGrid,
  type CellRef,
  type ColumnDef,
  type CsvOptions,
  type CustomAggregation,
  type DropPlacement,
  type GridApi,
  type GridInstance,
  type GridOptions,
  type Range,
  type RangeRect,
  type RenderRow,
} from '../core'
import type { ColumnLayout } from '../core/layout'
import { CellEditor, type EditCellParams, type EditMove } from './Editors'
import { ColumnMenu, ColumnsPanel, FilterPanel, PivotPanel } from './Panels'
import { Popover } from './Popover'

export interface UIColumnDef<R = any> extends ColumnDef<R> {
  renderCell?: (params: { value: unknown; row: R }) => ReactNode
  renderEditCell?: (params: EditCellParams<R>) => ReactNode
}

export interface GridProps<R = any> extends Omit<GridOptions<R>, 'columns'> {
  columns: UIColumnDef<R>[]
  height?: number | string
  checkboxSelection?: boolean
  /** toolbar with columns panel, filter panel, export and quick filter */
  toolbar?: boolean
  /** show the column menu button in headers (default true) */
  columnControls?: boolean
  /** drag headers to reorder columns (default true; per column: reorderable: false) */
  columnReorder?: boolean
  /** show pin-to-top / pin-to-bottom buttons on rows (flat grids only) */
  rowPinning?: boolean
  /** content of a row's detail panel; setting it turns on detail panels (see also `detailPanelHeight`) */
  renderDetailPanel?: (params: { row: R }) => ReactNode
  /** show the ›/⌄ button on rows that have a panel (default true; Alt+↓ / Alt+↑ always work) */
  detailPanelToggle?: boolean
  /** show the Aggregate choices in the column menu (default true) */
  aggregationMenu?: boolean
  /** select blocks of cells: drag, Shift+click / Shift+arrows, Ctrl/Cmd+click for more, Ctrl/Cmd+A, Delete clears */
  cellSelection?: boolean
  /** copy, cut and paste (tab-separated, works with spreadsheets). Default true. */
  clipboard?: boolean
  /** drag the corner of the selection to repeat its cells (needs cellSelection). Default true. */
  fillHandle?: boolean
  className?: string
  csvFileName?: string
  /** file name of the Excel download (default export.xlsx) */
  xlsxFileName?: string
  onReady?: (api: GridApi<R>) => void
}

const INDENT = 18
/** height of a detail panel when `renderDetailPanel` is given without `detailPanelHeight` */
const DETAIL_DEFAULT = 200

/* -------------------------------------------------------------------- cell */

interface CellProps<R> {
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

function Cell<R>(p: CellProps<R>) {
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

function GroupLabel<R>({ row }: { row: RenderRow<R> }) {
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

/* ------------------------------------------------------------- detail panel */

/**
 * A panel under a row. It spans the whole scrolling width but its content is sticky to the left edge and
 * as wide as the visible area, so it stays in view while the columns scroll sideways.
 */
function DetailPanel({
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
  useLayoutEffect(() => {
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

/* ------------------------------------------------------------------ skeleton */

/** a stable, natural-looking bar width for a (row, column) pair */
const barWidth = (row: number, col: number) => 35 + (((row * 31 + col * 17) * 2654435761) >>> 0) % 50

/**
 * A row whose data has not arrived (server-side data). It mirrors the real row's three column groups so the
 * pinned columns and the horizontal scroll stay where they will be.
 */
const SkeletonRow = memo(function SkeletonRow({
  index,
  top,
  rowHeight,
  totalWidth,
  layout,
  colRange,
  ariaRow,
}: {
  index: number
  top: number
  rowHeight: number
  totalWidth: number
  layout: ColumnLayout<any>
  colRange: Range
  ariaRow: number
}) {
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
      className="gk-row gk-skeleton"
      data-odd={index % 2 ? '' : undefined}
      style={{ height: rowHeight, width: totalWidth, transform: `translateY(${top}px)` }}
    >
      {layout.left.length > 0 && (
        <div className="gk-pinned gk-pinned-left" style={{ width: layout.leftWidth }}>
          {pinned(layout.left, 0)}
        </div>
      )}
      <div className="gk-center" style={{ width: layout.centerWidth }}>
        {center}
      </div>
      {layout.right.length > 0 && (
        <div className="gk-pinned gk-pinned-right" style={{ width: layout.rightWidth }}>
          {pinned(layout.right, layout.left.length + layout.center.length)}
        </div>
      )}
    </div>
  )
})

/* --------------------------------------------------------------------- row */

interface RowProps<R> {
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
      {layout.left.length > 0 && (
        <div className="gk-pinned gk-pinned-left" style={{ width: layout.leftWidth }}>
          {pinned(layout.left)}
        </div>
      )}
      <div className="gk-center" style={{ width: layout.centerWidth }}>
        {centerCells}
      </div>
      {layout.right.length > 0 && (
        <div className="gk-pinned gk-pinned-right" style={{ width: layout.rightWidth }}>
          {pinned(layout.right)}
        </div>
      )}
    </div>
  )
}

const Row = memo(RowInner, (a, b) => {
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

/* ------------------------------------------------------------------ header */

function HeaderCell<R>({
  col,
  style,
  colIndex,
  grid,
  controls,
  onOpenMenu,
  onDragIntent,
  suppressClick,
}: {
  col: UIColumnDef<R>
  style: CSSProperties
  colIndex: number
  grid: GridInstance<R>
  controls: boolean
  onOpenMenu: (field: string, anchor: DOMRect) => void
  /** undefined when reordering is off for this column */
  onDragIntent: ((field: string, e: ReactPointerEvent<HTMLElement>) => void) | undefined
  suppressClick: () => boolean
}) {
  const { api, state, layout } = grid
  const sort = state.sortModel.find((s) => s.field === col.field)
  const side = layout.pinnedSide.get(col.field)
  const sortable = col.sortable !== false

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = layout.width(col.field)
    const dir = side === 'right' ? -1 : 1 // right-pinned columns grow leftwards
    const move = (ev: PointerEvent) => api.setColumnWidth(col.field, startW + dir * (ev.clientX - startX))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      role="columnheader"
      aria-colindex={colIndex + 1}
      aria-sort={sort ? (sort.direction === 'asc' ? 'ascending' : 'descending') : sortable ? 'none' : undefined}
      className="gk-header-cell"
      data-align={defaultAlign(col)}
      data-field={col.field}
      style={style}
      onPointerDown={(e) => {
        if (!onDragIntent || e.button !== 0 || e.pointerType === 'touch') return
        if ((e.target as Element).closest('.gk-resizer, .gk-menu-btn')) return
        onDragIntent(col.field, e)
      }}
    >
      <button
        type="button"
        className="gk-header-title"
        disabled={!sortable}
        onClick={(e) => {
          if (suppressClick()) return // this click is the end of a column drag
          api.toggleSort(col.field, e.shiftKey)
        }}
      >
        <span className="gk-header-label">{col.headerName ?? col.field}</span>
        {sort && <span className="gk-sort">{sort.direction === 'asc' ? '↑' : '↓'}</span>}
      </button>
      {side && (
        <span className="gk-pin-mark" title={`Pinned ${side}`} aria-hidden="true">
          {side === 'left' ? '⇤' : '⇥'}
        </span>
      )}
      {controls && (
        <button
          type="button"
          className="gk-menu-btn"
          data-gk-anchor
          aria-haspopup="menu"
          aria-label={`${col.headerName ?? col.field} column menu`}
          onClick={(e) => onOpenMenu(col.field, e.currentTarget.getBoundingClientRect())}
        >
          ⋮
        </button>
      )}
      {col.resizable !== false && (
        <div
          className="gk-resizer"
          role="separator"
          aria-orientation="vertical"
          data-side={side === 'right' ? 'left' : 'right'}
          onPointerDown={startResize}
        />
      )}
    </div>
  )
}

/* ----------------------------------------------------------------- toolbar */

type PanelKind = 'filters' | 'columns' | 'export' | 'pivot'
interface PanelState {
  kind: PanelKind
  anchor: DOMRect
}

function downloadText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function Toolbar<R>({
  grid,
  panel,
  onPanel,
  onExport,
}: {
  grid: GridInstance<R>
  panel: PanelState | null
  onPanel: (kind: PanelKind, anchor: DOMRect) => void
  onExport: (options: CsvOptions & { selectedOnly?: boolean }) => void
}) {
  const { api, state } = grid
  const activeFilters = state.filterModel.items.length
  const open = (kind: PanelKind) => (e: ReactMouseEvent<HTMLButtonElement>) =>
    onPanel(kind, e.currentTarget.getBoundingClientRect())
  void onExport
  return (
    <div className="gk-toolbar" role="toolbar" aria-label="Grid toolbar">
      {!grid.pivot && (
        <button type="button" data-gk-anchor aria-haspopup="dialog" aria-expanded={panel?.kind === 'columns'} onClick={open('columns')}>
          Columns
        </button>
      )}
      <button type="button" data-gk-anchor aria-haspopup="dialog" aria-expanded={panel?.kind === 'filters'} onClick={open('filters')}>
        Filters{activeFilters > 0 && <span className="gk-badge">{activeFilters}</span>}
      </button>
      <button type="button" data-gk-anchor aria-haspopup="menu" aria-expanded={panel?.kind === 'export'} onClick={open('export')}>
        Export
      </button>
      {grid.options.pivoting && !grid.options.dataSource && (
        <button
          type="button"
          data-gk-anchor
          data-active={state.pivotMode ? '' : undefined}
          aria-haspopup="dialog"
          aria-expanded={panel?.kind === 'pivot'}
          onClick={open('pivot')}
        >
          Pivot
        </button>
      )}
      <input
        type="search"
        className="gk-search"
        placeholder="Search…"
        aria-label="Quick filter"
        value={state.filterModel.quickFilter ?? ''}
        onChange={(e) => api.setQuickFilter(e.target.value)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------- grid */

export function Grid<R = any>(props: GridProps<R>) {
  const {
    height = 400,
    checkboxSelection = false,
    toolbar = false,
    columnControls = true,
    columnReorder = true,
    rowPinning = false,
    aggregationMenu = true,
    renderDetailPanel,
    detailPanelToggle = true,
    cellSelection = false,
    clipboard = true,
    fillHandle = true,
    className,
    csvFileName = 'export.csv',
    xlsxFileName = 'export.xlsx',
    onReady,
    ...options
  } = props
  const grid = useGrid<R>({
    ...options,
    // giving a renderer is enough to turn the feature on
    detailPanelHeight: options.detailPanelHeight ?? (renderDetailPanel ? DETAIL_DEFAULT : undefined),
  } as GridOptions<R>)
  const { api, layout, rows, rowRange, colRange, rowHeight, headerHeight, headerRowHeight, headerDepth, state, geometry, detailSlots, detailRange } = grid
  /** aria-rowindex of the first body row: the header takes one row per level of column groups, plus the titles */
  const hdr = 2 + headerDepth
  const scrollerRef = useRef<HTMLDivElement>(null)
  const gridId = useId().replace(/:/g, '')
  const columns = props.columns

  const gridRef = useRef(grid)
  gridRef.current = grid

  const [menu, setMenu] = useState<{ field: string; anchor: DOMRect } | null>(null)
  const [panel, setPanel] = useState<PanelState | null>(null)

  useEffect(() => {
    onReady?.(api)
  }, [api, onReady])

  // keep the viewport size in the store
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const measure = () => api.setViewport(el.clientWidth, el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [api])

  // one store write per frame, regardless of how many scroll events fire
  const frame = useRef(0)
  const onScroll = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const el = scrollerRef.current
      if (el) api.setScroll(el.scrollTop, el.scrollLeft)
    })
  }, [api])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const hasHierarchy = state.rowGroupingModel.length > 0 || !!props.getTreeDataPath
  const firstColumn = layout.all[0]
  const hierarchyField = firstColumn?.field
  const totalWidth = layout.leftWidth + layout.centerWidth + layout.rightWidth
  const bodyHeight = geometry.totalHeight
  const colPos = useRefMemo(() => new Map(layout.all.map((c, i) => [c.field, i])), [layout])

  const toggleExpand = api.toggleExpanded
  const toggleSelect = useCallback((id: RenderRow['id']) => api.toggleSelection(id), [api])

  /* ---- focus + keyboard ---- */

  const focusAt = useCallback(
    (rowIndex: number, colIndex: number) => {
      const g = gridRef.current
      const r = g.rows[rowIndex]
      const c = g.layout.all[colIndex]
      const el = scrollerRef.current
      if (!c || !el) return
      if (!r) {
        // a row of server data that has not loaded: scroll to it so it does, the focus can follow on the next key
        if (rowIndex >= 0 && rowIndex < g.rows.length) {
          const top = g.geometry.topOf(rowIndex)
          const bodyHeight = el.clientHeight - g.headerHeight
          if (top < el.scrollTop) el.scrollTop = top
          else if (top + g.rowHeight > el.scrollTop + bodyHeight) el.scrollTop = top + g.rowHeight - bodyHeight
        }
        return
      }
      g.api.focusCell({ rowId: r.id, field: c.field })
      const next = scrollToCell(
        g.layout,
        c.field,
        rowIndex,
        { top: el.scrollTop, left: el.scrollLeft },
        { width: el.clientWidth, height: el.clientHeight },
        g.rowHeight,
        g.headerHeight,
        (g.pinnedTop.length + g.pinnedBottom.length + (g.footer ? 1 : 0)) * g.rowHeight,
        g.geometry.topOf(rowIndex),
      )
      if (next.top !== el.scrollTop) el.scrollTop = next.top
      if (next.left !== el.scrollLeft) el.scrollLeft = next.left
    },
    [],
  )

  const focusPosition = () => {
    const g = gridRef.current
    const cell = g.state.focusedCell
    if (!cell) return null
    const row = g.result.indexOf(cell.rowId)
    const col = g.layout.all.findIndex((c) => c.field === cell.field)
    return row < 0 || col < 0 ? null : { row, col, cell }
  }

  const finishEdit = useCallback(
    async (value: unknown, move?: EditMove) => {
      const g = gridRef.current
      const at = focusPosition()
      const ok = await g.api.commitEdit(value)
      if (!ok) return false
      scrollerRef.current?.focus({ preventScroll: true })
      if (move && at) {
        const key = move === 'down' ? 'ArrowDown' : 'Tab'
        const next = navigate({
          key,
          shift: move === 'left',
          row: at.row,
          col: at.col,
          rowCount: g.rows.length,
          colCount: g.layout.all.length,
          pageRows: 1,
        })
        if (next) focusAt(next.row, next.col)
      }
      return true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focusAt],
  )
  const cancelEdit = useCallback(() => {
    api.cancelEdit()
    scrollerRef.current?.focus({ preventScroll: true })
  }, [api])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // keys typed into editors, buttons and inputs belong to them
    if (e.target !== e.currentTarget) return
    const g = gridRef.current
    const at = focusPosition()

    if (!at) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageDown', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        focusAt(g.rowRange.start, 0)
      }
      return
    }
    const row = g.rows[at.row]!
    const col = g.layout.all[at.col]!
    const onHierarchyCell = hasHierarchy && col.field === hierarchyField && row.expandable

    if (cellSelection) {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        return selectAllCells()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
        e.preventDefault()
        void g.api.clearSelectedCells()
        return
      }
      if (e.key === 'Escape' && g.state.cellSelection.length) return g.api.clearCellSelection()
    }

    if (e.key === 'ArrowRight' && onHierarchyCell && !row.expanded) {
      e.preventDefault()
      return g.api.toggleExpanded(row.id)
    }
    if (e.key === 'ArrowLeft' && onHierarchyCell && row.expanded) {
      e.preventDefault()
      return g.api.toggleExpanded(row.id)
    }
    // Alt+Shift+↑/↓ moves the focused row (the keyboard way to reorder); Alt+↓/↑ opens/closes its detail panel
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      if (e.shiftKey) {
        const neighbour = g.rows[at.row + (e.key === 'ArrowDown' ? 1 : -1)]
        if (g.reorderAllowed && row.row !== undefined && neighbour?.row !== undefined) {
          const to = e.key === 'ArrowDown' ? { after: neighbour.id } : { before: neighbour.id }
          if (g.api.moveRow(row.id, to)) {
            announceMove(row.id)
            // keep the row in view once it has been re-rendered in its new place
            setTimeout(() => {
              const cur = gridRef.current
              const i = cur.result.indexOf(row.id)
              if (i >= 0) focusAt(i, cur.layout.all.findIndex((c) => c.field === col.field))
            }, 0)
          }
        }
      } else if (hasDetail(row)) {
        g.api.toggleDetailPanel(row.id, e.key === 'ArrowDown')
      }
      return
    }
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault()
      if (g.api.startEdit(row.id, col.field)) return
      if (row.expandable) g.api.toggleExpanded(row.id)
      else if (hasDetail(row)) g.api.toggleDetailPanel(row.id)
      return
    }
    if (e.key === ' ') {
      e.preventDefault()
      if (checkboxSelection) g.api.toggleSelection(row.id)
      return
    }
    if (e.key === 'Escape') return g.api.focusCell(null)
    if (isPrintableKey(e) && g.api.isCellEditable(row.id, col.field)) {
      e.preventDefault()
      g.api.startEdit(row.id, col.field, e.key)
      return
    }
    const next = navigate({
      key: e.key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      row: at.row,
      col: at.col,
      rowCount: g.rows.length,
      colCount: g.layout.all.length,
      pageRows: Math.floor((g.state.viewport.height - g.headerHeight - (g.pinnedTop.length + g.pinnedBottom.length + (g.footer ? 1 : 0)) * g.rowHeight) / g.rowHeight),
    })
    if (next) {
      e.preventDefault()
      if (cellSelection) {
        const dest = g.rows[next.row]
        const destCol = g.layout.all[next.col]
        if (e.shiftKey && e.key !== 'Tab' && dest && destCol) g.api.extendCellSelection({ rowId: dest.id, field: destCol.field })
        else g.api.clearCellSelection() // moving without Shift collapses the selection to the cursor
      }
      focusAt(next.row, next.col)
    }
  }

  const onBodyClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const cell = (e.target as Element).closest<HTMLElement>('.gk-cell')
    const rowEl = cell?.closest<HTMLElement>('.gk-row')
    if (!cell || !rowEl) return
    const r = rows[Number(rowEl.dataset.rowindex)]
    const field = cell.dataset.field
    if (!r || !field) return
    api.focusCell({ rowId: r.id, field })
    const tag = (e.target as Element).tagName
    if (tag !== 'INPUT' && tag !== 'SELECT') scrollerRef.current?.focus({ preventScroll: true })
  }
  const onBodyDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const cell = (e.target as Element).closest<HTMLElement>('.gk-cell')
    const rowEl = cell?.closest<HTMLElement>('.gk-row')
    if (!cell || !rowEl) return
    const r = rows[Number(rowEl.dataset.rowindex)]
    if (r && cell.dataset.field) api.startEdit(r.id, cell.dataset.field)
  }

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
  const trackPointer = (
    start: { x: number; y: number },
    onMove: (x: number, y: number) => void,
    onEnd: () => void,
  ): (() => void) => {
    let { x, y } = start
    let raf = 0
    const loop = () => {
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
      raf = requestAnimationFrame(loop)
    }
    const move = (ev: PointerEvent) => {
      x = ev.clientX
      y = ev.clientY
      onMove(x, y)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      cancelAnimationFrame(raf)
    }
    const up = () => {
      stop()
      onEnd()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    raf = requestAnimationFrame(loop)
    return stop
  }

  /** Follow the pointer across cells: `onCell` fires when the cell under it changes. */
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

  /* ---- row drag & drop ---- */

  interface RowDrop {
    target: RenderRow['id']
    placement: DropPlacement
    rect: DOMRect
  }
  const [rowDrag, setRowDrag] = useState<{ id: RenderRow['id']; label: string; x: number; y: number; drop: RowDrop | null } | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const announceMove = (id: RenderRow['id']) =>
    setTimeout(() => {
      const res = gridRef.current.result
      setAnnouncement(`Row moved to position ${res.dataIndexOf(id) + 1} of ${res.dataCount}`)
    }, 0)

  const startRowDrag = (id: RenderRow['id'], e: ReactPointerEvent<HTMLElement>) => {
    const g = gridRef.current
    if (!g.reorderAllowed || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const source = g.rows.find((r) => r?.id === id)
    const first = g.layout.all[0]
    const label = source?.row !== undefined && first ? formatCellValue(first, source.row) || String(id) : String(id)
    let drop: RowDrop | null = null
    const dropAt = (x: number, y: number): RowDrop | null => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.gk-body .gk-row[data-rowindex]')
      const over = el ? gridRef.current.rows[Number(el.dataset.rowindex)] : undefined
      if (!el || !over || over.row === undefined || over.id === id) return null
      const rect = el.getBoundingClientRect()
      const placement: DropPlacement = y < rect.top + rect.height / 2 ? 'before' : 'after'
      const to = placement === 'before' ? { before: over.id } : { after: over.id }
      // a drop that would leave the row where it is gets no marker
      return gridRef.current.api.canMoveRow(id, to) ? { target: over.id, placement, rect } : null
    }
    const cleanup = () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.classList.remove('gk-col-dragging')
      setRowDrag(null)
    }
    const stop = trackPointer(
      { x: e.clientX, y: e.clientY },
      (x, y) => {
        drop = dropAt(x, y)
        setRowDrag({ id, label, x, y, drop })
      },
      () => {
        const d = drop
        cleanup()
        if (!d) return
        const to = d.placement === 'before' ? { before: d.target } : { after: d.target }
        if (gridRef.current.api.moveRow(id, to)) announceMove(id)
      },
    )
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      ev.stopPropagation()
      drop = null
      stop()
      cleanup()
    }
    window.addEventListener('keydown', onKey, true)
    document.body.classList.add('gk-col-dragging')
  }
  const startRowDragRef = useRef(startRowDrag)
  startRowDragRef.current = startRowDrag
  const onRowDragStart = useCallback((id: RenderRow['id'], e: ReactPointerEvent<HTMLElement>) => startRowDragRef.current(id, e), [])

  const onBodyPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!cellSelection || e.button !== 0) return
    const target = e.target as Element
    if (target.closest('input, select, textarea, button, .gk-fill-handle')) return
    const cellEl = target.closest<HTMLElement>('.gk-cell')
    const rowEl = cellEl?.closest<HTMLElement>('.gk-row')
    if (!cellEl || !rowEl) return
    const g = gridRef.current
    const r = g.rows[Number(rowEl.dataset.rowindex)]
    const field = cellEl.dataset.field
    if (!r || !field || r.row === undefined) return
    const point = { rowId: r.id, field }
    if (e.shiftKey && (g.state.cellSelection.length || g.state.focusedCell)) {
      g.api.extendCellSelection(point) // before moving the focus: the focused cell is the anchor when there is no range
      g.api.focusCell(point)
    } else {
      g.api.focusCell(point)
      g.api.selectCells({ anchor: point, focus: point }, { add: e.ctrlKey || e.metaKey })
    }
    trackDrag(
      { x: e.clientX, y: e.clientY },
      (c) => {
        const cur = gridRef.current
        const rr = cur.rows[c.row]
        const cc = cur.layout.all[c.col]
        if (rr && cc && rr.row !== undefined) cur.api.extendCellSelection({ rowId: rr.id, field: cc.field })
      },
      () => {},
    )
  }

  const startFill = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const g = gridRef.current
    const all = g.api.getCellRects()
    const source = all[all.length - 1]
    if (!source) return
    trackDrag(
      { x: e.clientX, y: e.clientY },
      (c) => setFillPreview(fillTarget(source, c.row, c.col)),
      (last) => {
        setFillPreview(null)
        if (last && fillTarget(source, last.row, last.col)) void g.api.fillCells(source, { row: last.row, col: last.col })
      },
    )
  }
  const startFillRef = useRef(startFill)
  startFillRef.current = startFill
  const onFillStart = useCallback((e: ReactPointerEvent<HTMLElement>) => startFillRef.current(e), [])

  const selectAllCells = () => {
    const g = gridRef.current
    const first = g.rows.findIndex((r) => r?.row !== undefined)
    let last = -1
    for (let i = g.rows.length - 1; i >= 0; i--) {
      if (g.rows[i]?.row !== undefined) {
        last = i
        break
      }
    }
    const a = g.layout.all[0]
    const b = g.layout.all[g.layout.all.length - 1]
    if (first < 0 || !a || !b) return
    g.api.selectCells({ anchor: { rowId: g.rows[first]!.id, field: a.field }, focus: { rowId: g.rows[last]!.id, field: b.field } })
  }

  /* ---- clipboard ---- */

  const onCopy = (e: ReactClipboardEvent<HTMLDivElement>) => {
    if (!clipboard || e.target !== e.currentTarget) return // copying inside an editor is the editor's business
    const text = api.copySelection()
    if (!text) return
    e.clipboardData.setData('text/plain', text)
    e.preventDefault()
  }
  const onCut = (e: ReactClipboardEvent<HTMLDivElement>) => {
    if (!clipboard || e.target !== e.currentTarget) return
    const text = api.copySelection()
    if (!text) return
    e.clipboardData.setData('text/plain', text)
    e.preventDefault()
    void api.clearSelectedCells()
  }
  const onPaste = (e: ReactClipboardEvent<HTMLDivElement>) => {
    if (!clipboard || e.target !== e.currentTarget) return
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()
    void api.pasteText(text)
  }

  /* ---- column drag & drop ---- */

  interface DropTarget {
    field: string
    placement: DropPlacement
    rect: DOMRect
  }
  const [drag, setDrag] = useState<{ field: string; x: number; y: number; target: DropTarget | null } | null>(null)
  const justDragged = useRef(false)

  const dropTargetAt = (clientX: number, field: string): DropTarget | null => {
    const g = gridRef.current
    const header = scrollerRef.current?.querySelector<HTMLElement>('.gk-header')
    if (!header) return null
    const hr = header.getBoundingClientRect()
    const under = document.elementFromPoint(clientX, hr.top + hr.height / 2)
    const cell = under?.closest<HTMLElement>('.gk-header-cell')
    const targetField = cell?.dataset.field
    if (!cell || !targetField || targetField === field) return null
    const rect = cell.getBoundingClientRect()
    const placement: DropPlacement = clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    // only show a drop marker where the move is allowed and actually changes something
    const ok = planColumnMove(g.options.columns, g.state, g.layout, field, targetField, placement)
    return ok ? { field: targetField, placement, rect } : null
  }

  const startColumnDrag = (field: string, e: ReactPointerEvent<HTMLElement>) => {
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false
    let x = startX
    let target: DropTarget | null = null
    let raf = 0

    const publish = (y: number) => {
      target = dropTargetAt(x, field)
      setDrag({ field, x, y, target })
    }
    const autoScroll = () => {
      const el = scrollerRef.current
      const g = gridRef.current
      if (el && dragging && !g.layout.pinnedSide.has(field)) {
        const r = el.getBoundingClientRect()
        const left = r.left + g.layout.leftWidth
        const right = r.right - g.layout.rightWidth
        const edge = 48
        if (x < left + edge) el.scrollLeft -= 14
        else if (x > right - edge) el.scrollLeft += 14
      }
      raf = requestAnimationFrame(autoScroll)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', key, true)
      cancelAnimationFrame(raf)
      document.body.classList.remove('gk-col-dragging')
      setDrag(null)
    }
    const move = (ev: PointerEvent) => {
      x = ev.clientX
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return
        dragging = true
        document.body.classList.add('gk-col-dragging')
        raf = requestAnimationFrame(autoScroll)
      }
      publish(ev.clientY)
    }
    const up = () => {
      const drop = target
      const wasDragging = dragging
      cleanup()
      if (!wasDragging) return
      // the click that follows pointerup belongs to the drag, not to the sort button
      justDragged.current = true
      setTimeout(() => (justDragged.current = false), 0)
      if (drop) api.reorderColumn(field, drop.field, drop.placement)
    }
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      ev.stopPropagation()
      target = null
      dragging = false
      cleanup()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', key, true)
  }

  /* ---- panels ---- */

  const openMenu = useCallback((field: string, anchor: DOMRect) => {
    setPanel(null)
    setMenu((m) => (m?.field === field ? null : { field, anchor }))
  }, [])
  const openPanel = (kind: PanelKind, anchor: DOMRect) => {
    setMenu(null)
    setPanel((p) => (p?.kind === kind ? null : { kind, anchor }))
  }
  const openFilterFor = (field: string) => {
    const anchor = menu?.anchor
    setMenu(null)
    const col = columns.find((c) => c.field === field)
    if (col && state.filterModel.items.length === 0) {
      api.setFilterModel({ ...state.filterModel, items: [defaultFilterItem(col)] })
    }
    if (anchor) setPanel({ kind: 'filters', anchor })
  }
  const doExport = (opts: CsvOptions & { selectedOnly?: boolean }) => {
    downloadText(api.getCsv(opts), csvFileName)
    setPanel(null)
  }

  /* ---- render ---- */

  const { page, pageSize } = state.paginationModel
  const pageCount = Math.max(1, Math.ceil(grid.result.rootCount / pageSize))
  const focused = state.focusedCell
  const focusedRowIndex = focused ? grid.result.indexOf(focused.rowId) : -1
  const focusedPos = focused ? (colPos.get(focused.field) ?? -1) : -1
  const activeId =
    focusedRowIndex >= rowRange.start && focusedRowIndex < rowRange.end && focusedPos >= 0
      ? `${gridId}-r${focusedRowIndex}-c${focusedPos}`
      : undefined

  const headerGroups = (cols: ColumnDef<R>[]) =>
    cols.map((c) => (
      <HeaderCell
        key={c.field}
        col={c as UIColumnDef<R>}
        style={{ width: layout.width(c.field), flex: 'none' }}
        colIndex={colPos.get(c.field) ?? 0}
        grid={grid}
        controls={columnControls}
        onOpenMenu={openMenu}
        onDragIntent={columnReorder && c.reorderable !== false ? startColumnDrag : undefined}
        suppressClick={() => justDragged.current}
      />
    ))

  const headerCenter: ReactNode[] = []
  for (let i = colRange.start; i < colRange.end; i++) {
    const c = layout.center[i]
    if (!c) continue
    headerCenter.push(
      <HeaderCell
        key={c.field}
        col={c as UIColumnDef<R>}
        style={{ position: 'absolute', left: layout.centerOffsets[i], width: layout.width(c.field), top: 0, bottom: 0 }}
        colIndex={colPos.get(c.field) ?? 0}
        grid={grid}
        controls={columnControls}
        onOpenMenu={openMenu}
        onDragIntent={columnReorder && c.reorderable !== false ? startColumnDrag : undefined}
        suppressClick={() => justDragged.current}
      />,
    )
  }

  /* ---- header groups: spans of adjacent columns that share a group path, one row per level ---- */
  const groupSpans = useMemo(() => {
    const spansOf = (cols: ColumnDef<R>[]) => {
      const levels: { start: number; end: number; label: string; key: string }[][] = []
      for (let lv = 0; lv < headerDepth; lv++) {
        const out: { start: number; end: number; label: string; key: string }[] = []
        let cur: (typeof out)[number] | null = null
        cols.forEach((c, i) => {
          const g = c.group
          if (!g || g.length <= lv) {
            cur = null
            return
          }
          const key = g.slice(0, lv + 1).join('\u241f')
          if (cur && cur.key === key) cur.end = i + 1
          else out.push((cur = { start: i, end: i + 1, label: g[lv]!, key }))
        })
        levels.push(out)
      }
      return levels
    }
    return { left: spansOf(layout.left), center: spansOf(layout.center), right: spansOf(layout.right) }
  }, [layout, headerDepth])

  const groupLevels: ReactNode[] = []
  for (let lv = 0; lv < headerDepth; lv++) {
    const cell = (sp: { start: number; end: number; label: string; key: string }, style: CSSProperties, left: number) => (
      <div key={sp.key} role="columnheader" aria-colspan={sp.end - sp.start} className="gk-header-group" style={style} title={sp.label}>
        <span className="gk-header-group-label" style={{ left }}>
          {sp.label}
        </span>
      </div>
    )
    const width = (cols: ColumnDef<R>[], a: number, b: number) => {
      let w = 0
      for (let i = a; i < b; i++) w += layout.width(cols[i]!.field)
      return w
    }
    const centerCells: ReactNode[] = []
    for (const sp of groupSpans.center[lv]!) {
      if (sp.end <= colRange.start || sp.start >= colRange.end) continue // not near the viewport
      const x = layout.centerOffsets[sp.start]!
      centerCells.push(
        cell(sp, { position: 'absolute', left: x, width: layout.centerOffsets[sp.end]! - x, top: 0, bottom: 0 }, layout.leftWidth),
      )
    }
    groupLevels.push(
      <div key={lv} className="gk-header-row" role="row" aria-rowindex={1 + lv} style={{ height: headerRowHeight, width: totalWidth }}>
        {layout.left.length > 0 && (
          <div className="gk-pinned gk-pinned-left" style={{ width: layout.leftWidth }}>
            {groupSpans.left[lv]!.map((sp) => cell(sp, { width: width(layout.left, sp.start, sp.end), flex: 'none' }, 0))}
          </div>
        )}
        <div className="gk-center" style={{ width: layout.centerWidth }}>
          {centerCells}
        </div>
        {layout.right.length > 0 && (
          <div className="gk-pinned gk-pinned-right" style={{ width: layout.rightWidth }}>
            {groupSpans.right[lv]!.map((sp) => cell(sp, { width: width(layout.right, sp.start, sp.end), flex: 'none' }, 0))}
          </div>
        )}
      </div>,
    )
  }

  const { pinnedTop, pinnedBottom, footer } = grid
  const aggNames = useRefMemo(
    () => grid.pivot?.aggNames ?? (Object.keys(state.aggregationModel).length ? state.aggregationModel : undefined),
    [state.aggregationModel, grid.pivot?.aggNames],
  )
  const aggCustom = props.aggregationFunctions
  const canPinRows = rowPinning && !props.getTreeDataPath && state.rowGroupingModel.length === 0
  const pinnedHeight = (pinnedTop.length + pinnedBottom.length + (footer ? 1 : 0)) * rowHeight
  const detailOpen = useMemo(() => new Set(state.detailPanelExpanded), [state.detailPanelExpanded])
  const hasDetail = (r: RenderRow<R>) =>
    !!renderDetailPanel && detailPanelToggle && r.row !== undefined && (grid.options.isDetailPanelAvailable?.(r.row) ?? true)
  const detailStateOf = (r: RenderRow<R>): 'open' | 'closed' | undefined =>
    hasDetail(r) ? (detailOpen.has(r.id) ? 'open' : 'closed') : undefined
  const canReorderRows = grid.reorderAllowed
  const body: ReactNode[] = []
  for (let i = rowRange.start; i < rowRange.end; i++) {
    const r = rows[i]
    if (!r) {
      // server data that hasn't arrived: a placeholder row (client-side grids never have gaps)
      if (grid.server && i < rows.length) {
        body.push(
          <SkeletonRow
            key={`sk-${i}`}
            index={i}
            top={geometry.topOf(i)}
            rowHeight={rowHeight}
            totalWidth={totalWidth}
            layout={layout}
            colRange={colRange}
            ariaRow={hdr + pinnedTop.length + i + geometry.slotsBefore(i)}
          />,
        )
      }
      continue
    }
    const here = focused?.rowId === r.id
    body.push(
      <Row<R>
        key={r.id}
        row={r}
        index={i}
        gridId={gridId}
        layout={layout}
        colPos={colPos}
        colRange={colRange}
        rowHeight={rowHeight}
        totalWidth={totalWidth}
        hierarchyField={hierarchyField}
        hasHierarchy={hasHierarchy}
        checkbox={checkboxSelection}
        selected={grid.isSelected(r)}
        focusedField={here ? focused!.field : undefined}
        editing={here && state.editingCell?.rowId === r.id ? state.editingCell : null}
        onToggleExpand={toggleExpand}
        onToggleSelect={toggleSelect}
        onCommit={finishEdit}
        onCancel={cancelEdit}
        pinSide={undefined}
        rowPinning={canPinRows}
        onPinRow={api.pinRow}
        ariaRow={hdr + pinnedTop.length + i + geometry.slotsBefore(i)}
        aggNames={aggNames}
        aggCustom={aggCustom}
        rangeKey={rangeKeyFor(i)}
        fillCol={fillColFor(i)}
        onFillStart={onFillStart}
        top={geometry.topOf(i)}
        detailState={detailStateOf(r)}
        onToggleDetail={api.toggleDetailPanel}
        canReorder={canReorderRows && r.row !== undefined}
        onRowDragStart={onRowDragStart}
        dragging={rowDrag?.id === r.id}
      />,
    )
  }

  const detailNodes: ReactNode[] = []
  if (renderDetailPanel) {
    for (let k = detailRange.start; k < detailRange.end; k++) {
      const slot = detailSlots[k]
      const row = slot && rows[slot.index]?.row
      if (!slot || row === undefined) continue
      detailNodes.push(
        <DetailPanel
          key={`detail-${slot.id}`}
          top={geometry.slotTop(k)}
          height={slot.height}
          auto={slot.auto}
          width={state.viewport.width}
          totalWidth={totalWidth}
          ariaRow={hdr + pinnedTop.length + slot.index + k + 1}
          colCount={layout.all.length}
          onMeasure={(h) => api.setDetailPanelHeight(slot.id, h)}
        >
          {renderDetailPanel({ row })}
        </DetailPanel>,
      )
    }
  }

  const pinnedRowsView = (list: RenderRow<R>[], side: 'top' | 'bottom', firstAria: number) =>
    list.map((r, i) => (
      <Row<R>
        key={r.id}
        row={r}
        index={i}
        gridId={gridId}
        layout={layout}
        colPos={colPos}
        colRange={colRange}
        rowHeight={rowHeight}
        totalWidth={totalWidth}
        hierarchyField={hierarchyField}
        hasHierarchy={false}
        checkbox={checkboxSelection}
        selected={grid.isSelected(r)}
        focusedField={undefined}
        editing={null}
        onToggleExpand={toggleExpand}
        onToggleSelect={toggleSelect}
        onCommit={finishEdit}
        onCancel={cancelEdit}
        pinSide={side}
        rowPinning={canPinRows}
        onPinRow={api.pinRow}
        ariaRow={firstAria + i}
        aggNames={aggNames}
        aggCustom={aggCustom}
        rangeKey=""
        fillCol={-1}
        onFillStart={undefined}
        top={0}
        detailState={undefined}
        onToggleDetail={api.toggleDetailPanel}
        canReorder={false}
        onRowDragStart={undefined}
        dragging={false}
      />
    ))

  return (
    <div className={`gk-root ${cellSelection ? 'gk-cell-select' : ''} ${className ?? ''}`} style={{ height }}>
      {toolbar && <Toolbar grid={grid} panel={panel} onPanel={openPanel} onExport={doExport} />}
      {grid.server?.loading && <div className="gk-loading" role="progressbar" aria-label="Loading rows" />}
      {grid.server?.error && (
        <div className="gk-error" role="alert">
          <span>Could not load rows: {grid.server.error.message}</span>
          <button type="button" onClick={() => api.refreshData()}>
            Try again
          </button>
        </div>
      )}
      <div
        ref={scrollerRef}
        className="gk-scroller"
        role="grid"
        aria-rowcount={rows.length + detailSlots.length + hdr - 1 + pinnedTop.length + pinnedBottom.length + (footer ? 1 : 0)}
        aria-colcount={layout.all.length}
        aria-multiselectable={checkboxSelection}
        aria-busy={grid.server?.loading || undefined}
        aria-activedescendant={activeId}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
      >
        <div className="gk-content" style={{ width: totalWidth, height: bodyHeight + headerHeight + pinnedHeight }}>
          <div className="gk-header" role="rowgroup" style={{ height: headerHeight, width: totalWidth }}>
            {groupLevels}
            <div className="gk-header-row" role="row" aria-rowindex={1 + headerDepth} style={{ height: headerRowHeight, width: totalWidth }}>
              {layout.left.length > 0 && (
                <div className="gk-pinned gk-pinned-left" style={{ width: layout.leftWidth }}>
                  {headerGroups(layout.left)}
                </div>
              )}
              <div className="gk-center" style={{ width: layout.centerWidth }}>
                {headerCenter}
              </div>
              {layout.right.length > 0 && (
                <div className="gk-pinned gk-pinned-right" style={{ width: layout.rightWidth }}>
                  {headerGroups(layout.right)}
                </div>
              )}
            </div>
          </div>
          {pinnedTop.length > 0 && (
            <div
              className="gk-pinned-rows gk-pinned-rows-top"
              role="rowgroup"
              aria-label="Pinned rows (top)"
              style={{ top: headerHeight, height: pinnedTop.length * rowHeight, width: totalWidth }}
            >
              {pinnedRowsView(pinnedTop, 'top', hdr)}
            </div>
          )}
          <div
            className="gk-body"
            role="rowgroup"
            style={{ height: bodyHeight, ['--gk-row-h' as string]: `${rowHeight}px` }}
            onPointerDown={onBodyPointerDown}
            onClick={onBodyClick}
            onDoubleClick={onBodyDoubleClick}
          >
            {body}
            {detailNodes}
          </div>
          {(pinnedBottom.length > 0 || footer) && (
            <div
              className="gk-pinned-rows gk-pinned-rows-bottom"
              role="rowgroup"
              aria-label={footer ? 'Pinned rows and totals' : 'Pinned rows (bottom)'}
              style={{ height: (pinnedBottom.length + (footer ? 1 : 0)) * rowHeight, width: totalWidth }}
            >
              {pinnedRowsView(pinnedBottom, 'bottom', hdr + pinnedTop.length + rows.length + detailSlots.length)}
              {footer && pinnedRowsView([footer], 'bottom', hdr + pinnedTop.length + rows.length + detailSlots.length + pinnedBottom.length)}
            </div>
          )}
          {grid.pivot && (state.pivotModel.rows.length === 0 || grid.pivot.columns.length === 0) ? (
            <div className="gk-empty">
              {state.pivotModel.rows.length === 0 ? 'Add a field as a row' : 'Add a field as a value'} in the Pivot panel to fill the table.
            </div>
          ) : (
            rows.length === 0 && !grid.server?.loading && !grid.server?.error && <div className="gk-empty">No rows</div>
          )}
        </div>
      </div>
      {(props.pagination !== false || grid.server) && (
        <div className="gk-footer">
          <span>
            {grid.server
              ? grid.server.rowCount >= 0
                ? `${grid.server.rowCount.toLocaleString()} rows`
                : `${grid.server.loadedEnd.toLocaleString()}${grid.server.hasNextPage ? '+' : ''} rows`
              : `${grid.result.filteredCount} rows`}
            {grid.server?.loading && ' · loading…'}
            {state.selection.length > 0 && ` · ${state.selection.length} selected`}
            {rects.length > 0 && countCells(rects) > 1 && ` · ${countCells(rects).toLocaleString()} cells selected`}
          </span>
          {props.pagination !== false && (
            <span className="gk-pager">
              <button type="button" disabled={page <= 0} onClick={() => api.setPage(page - 1)} aria-label="Previous page">
                ‹
              </button>
              <span>
                {page + 1} / {pageCount}
                {grid.server && grid.server.rowCount < 0 && grid.server.hasNextPage ? '+' : ''}
              </span>
              <button
                type="button"
                disabled={page >= pageCount - 1}
                onClick={() => api.setPage(page + 1)}
                aria-label="Next page"
              >
                ›
              </button>
            </span>
          )}
        </div>
      )}

      {rowDrag && (
        <>
          <div className="gk-drag-ghost" style={{ left: rowDrag.x + 12, top: rowDrag.y + 12 }}>
            {rowDrag.label}
          </div>
          {rowDrag.drop && (
            <div
              className="gk-row-drop"
              style={{
                left: scrollerRef.current?.getBoundingClientRect().left ?? 0,
                width: scrollerRef.current?.clientWidth ?? 0,
                top: (rowDrag.drop.placement === 'before' ? rowDrag.drop.rect.top : rowDrag.drop.rect.bottom) - 1.5,
              }}
            />
          )}
        </>
      )}
      <div className="gk-sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      {drag && (
        <>
          <div className="gk-drag-ghost" style={{ left: drag.x + 12, top: drag.y + 12 }}>
            {columns.find((c) => c.field === drag.field)?.headerName ?? drag.field}
          </div>
          {drag.target && (
            <div
              className="gk-drop-indicator"
              style={{
                left: (drag.target.placement === 'before' ? drag.target.rect.left : drag.target.rect.right) - 1,
                top: drag.target.rect.top,
                height: drag.target.rect.height,
              }}
            />
          )}
        </>
      )}
      {menu && (
        <Popover anchor={menu.anchor} onClose={() => setMenu(null)} label="Column menu" role="menu" align="end" className="gk-menu">
          <ColumnMenu grid={grid} field={menu.field} onClose={() => setMenu(null)} onFilter={openFilterFor} aggregation={aggregationMenu && !grid.pivot} />
        </Popover>
      )}
      {panel?.kind === 'filters' && (
        <Popover anchor={panel.anchor} onClose={() => setPanel(null)} label="Filters">
          <FilterPanel grid={grid} />
        </Popover>
      )}
      {panel?.kind === 'columns' && (
        <Popover anchor={panel.anchor} onClose={() => setPanel(null)} label="Columns">
          <ColumnsPanel grid={grid} />
        </Popover>
      )}
      {panel?.kind === 'pivot' && (
        <Popover anchor={panel.anchor} onClose={() => setPanel(null)} label="Pivot">
          <PivotPanel grid={grid} />
        </Popover>
      )}
      {panel?.kind === 'export' && (
        <Popover anchor={panel.anchor} onClose={() => setPanel(null)} label="Export" role="menu" className="gk-menu">
          <button type="button" role="menuitem" className="gk-menu-item" onClick={() => doExport({})}>
            Download CSV
          </button>
          <button
            type="button"
            role="menuitem"
            className="gk-menu-item"
            disabled={state.selection.length === 0}
            onClick={() => doExport({ selectedOnly: true })}
          >
            Download CSV (selected rows)
          </button>
          <button
            type="button"
            role="menuitem"
            className="gk-menu-item"
            onClick={() => {
              setPanel(null)
              void api.exportXlsx({ fileName: xlsxFileName })
            }}
          >
            Download Excel (.xlsx)
          </button>
        </Popover>
      )}
    </div>
  )
}

/** useMemo that recomputes only when the dependency identities change */
function useRefMemo<T>(factory: () => T, deps: unknown[]): T {
  const ref = useRef<{ deps: unknown[]; value: T }>()
  if (!ref.current || ref.current.deps.some((d, i) => !Object.is(d, deps[i]))) {
    ref.current = { deps, value: factory() }
  }
  return ref.current.value
}
