import type { GridInstance, RenderRow } from '../../core'
import type { BodyRow, DetailItem, PinnedBlock } from '../gridView'
import type { RowProps } from '../Row'
import type { GridProps } from '../types'

/** What the row builders read: the grid, the props, and what the interaction hooks produced for rows. */
export interface RowsInput<R> {
  grid: GridInstance<R>
  props: GridProps<R>
  /** aria-rowindex of the first body row */
  hdr: number
  totalWidth: number
  hasHierarchy: boolean
  /** what every row gets, pinned or not */
  shared: Omit<RowProps<R>, 'rowEdit' | 'row' | 'index' | 'rowClassName' | 'hasHierarchy' | 'selected' | 'selectable' | 'focusedField' | 'editing' | 'pinSide' | 'ariaRow' | 'rangeKey' | 'fillCol' | 'onFillStart' | 'top' | 'detailState' | 'canReorder' | 'onRowDragStart' | 'dragging'>
  canSelect: (r: RenderRow<R>) => boolean
  detailStateOf: (r: RenderRow<R>) => 'open' | 'closed' | undefined
  rangeKeyFor: (rowIndex: number) => string
  fillColFor: (rowIndex: number) => number
  onFillStart: RowProps<R>['onFillStart']
  onRowDragStart: RowProps<R>['onRowDragStart']
  /** the row being dragged, if any */
  draggingId: RenderRow['id'] | undefined
}

/** What the row being edited tells its cells: where the editors are (a row: every editable cell), which takes the focus, what went wrong. */
function rowEditOf<R>(i: RowsInput<R>, r: RenderRow<R>): NonNullable<RowProps<R>['rowEdit']> {
  const { state, layout, api } = i.grid
  const rowMode = state.editingRow === r.id
  return {
    rowMode,
    fields: rowMode ? layout.all.filter((c) => api.isCellEditable(r.id, c.field)).map((c) => c.field) : state.editingCell ? [state.editingCell.field] : [],
    focus: state.editingCell?.field,
    errors: state.editErrors,
  }
}

/** The rows in view, as props for the `row` slot (or the placeholders for server rows that have not arrived). */
export function buildBodyRows<R>(i: RowsInput<R>): BodyRow<R>[] {
  const { grid, props, hdr, totalWidth } = i
  const { rows, rowRange, geometry, layout, colRange, pinnedTop, state } = grid
  const focused = state.focusedCell
  const out: BodyRow<R>[] = []
  // with no columns there is nothing to draw in a row: the empty state is shown instead
  for (let n = rowRange.start; layout.all.length > 0 && n < rowRange.end; n++) {
    const r = rows[n]
    const ariaRow = hdr + pinnedTop.length + n + geometry.slotsBefore(n)
    if (!r) {
      // server data that hasn't arrived: a placeholder row (client-side grids never have gaps)
      if (grid.server && n < rows.length) {
        out.push({ type: 'skeleton', key: `sk-${n}`, props: { index: n, top: geometry.topOf(n), rowHeight: geometry.heightOf(n), totalWidth, layout, colRange, ariaRow } })
      }
      continue
    }
    const here = focused?.rowId === r.id
    const editedHere = state.editingRow === r.id || state.editingCell?.rowId === r.id
    out.push({
      type: 'row',
      key: r.id,
      props: {
        ...i.shared,
        rowHeight: geometry.heightOf(n),
        auto: props.getRowHeight?.({ id: r.id, row: r.row, depth: r.depth }) === 'auto',
        row: r,
        index: n,
        rowClassName: props.getRowClassName?.({ id: r.id, row: r.row, renderRow: r, index: n }),
        hasHierarchy: i.hasHierarchy,
        selected: grid.isSelected(r),
        selectable: i.canSelect(r),
        focusedField: here ? focused!.field : undefined,
        editing: here && state.editingCell?.rowId === r.id ? state.editingCell : null,
        rowEdit: editedHere ? rowEditOf(i, r) : undefined,
        pinSide: undefined,
        ariaRow,
        rangeKey: i.rangeKeyFor(n),
        fillCol: i.fillColFor(n),
        onFillStart: i.onFillStart,
        top: geometry.topOf(n),
        detailState: i.detailStateOf(r),
        canReorder: grid.reorderAllowed && r.row !== undefined,
        onRowDragStart: i.onRowDragStart,
        dragging: i.draggingId === r.id,
      },
    })
  }
  return out
}

/** The open detail panels in view (only when `renderDetailPanel` is given). */
export function buildDetailItems<R>(i: RowsInput<R>): DetailItem<R>[] {
  const { grid, hdr, totalWidth } = i
  const { api, rows, detailSlots, detailRange, geometry, pinnedTop, layout, state } = grid
  const out: DetailItem<R>[] = []
  if (!i.props.renderDetailPanel) return out
  for (let k = detailRange.start; k < detailRange.end; k++) {
    const slot = detailSlots[k]
    const row = slot && rows[slot.index]?.row
    if (!slot || row === undefined) continue
    out.push({
      key: `detail-${slot.id}`,
      row,
      props: {
        top: geometry.slotTop(k),
        height: slot.height,
        auto: slot.auto,
        width: state.viewport.width,
        totalWidth,
        ariaRow: hdr + pinnedTop.length + slot.index + k + 1,
        colCount: layout.all.length,
        onMeasure: (h) => api.setDetailPanelHeight(slot.id, h),
      },
    })
  }
  return out
}

/** The blocks of rows stuck to the top and the bottom of the body: pinned rows, and the total row under the bottom ones. */
export function buildPinnedBlocks<R>(i: RowsInput<R>): { top: PinnedBlock<R> | null; bottom: PinnedBlock<R> | null; height: number } {
  const { grid, props, hdr, totalWidth } = i
  const { rows, detailSlots, pinnedTop, pinnedBottom, footer, rowHeight, headerHeight, text } = grid
  const rowsOf = (list: RenderRow<R>[], side: 'top' | 'bottom', firstAria: number): RowProps<R>[] =>
    list.map((r, n) => ({
      ...i.shared,
      row: r,
      index: n,
      rowClassName: props.getRowClassName?.({ id: r.id, row: r.row, renderRow: r, index: n }),
      hasHierarchy: false,
      selected: grid.isSelected(r),
      selectable: i.canSelect(r),
      focusedField: undefined,
      editing: null,
      pinSide: side,
      ariaRow: firstAria + n,
      rangeKey: '',
      fillCol: -1,
      onFillStart: undefined,
      top: 0,
      detailState: undefined,
      canReorder: false,
      onRowDragStart: undefined,
      dragging: false,
    }))
  const belowBody = hdr + pinnedTop.length + rows.length + detailSlots.length
  const top: PinnedBlock<R> | null = pinnedTop.length
    ? { side: 'top', label: text.pinnedRowsTop, style: { top: headerHeight, height: pinnedTop.length * rowHeight, width: totalWidth }, rows: rowsOf(pinnedTop, 'top', hdr) }
    : null
  const bottom: PinnedBlock<R> | null =
    pinnedBottom.length > 0 || footer
      ? {
          side: 'bottom',
          label: footer ? text.pinnedRowsAndTotals : text.pinnedRowsBottom,
          style: { height: (pinnedBottom.length + (footer ? 1 : 0)) * rowHeight, width: totalWidth },
          rows: [...rowsOf(pinnedBottom, 'bottom', belowBody), ...(footer ? rowsOf([footer], 'bottom', belowBody + pinnedBottom.length) : [])],
        }
      : null
  return { top, bottom, height: (pinnedTop.length + pinnedBottom.length + (footer ? 1 : 0)) * rowHeight }
}
