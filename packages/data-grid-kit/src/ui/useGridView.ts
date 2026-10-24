import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentType, type FunctionComponent } from 'react'
import { flushSync } from 'react-dom'
import { useGrid, type GridOptions, type Range, type RenderRow, type RowGeometry } from '../core'
import { useIsomorphicLayoutEffect } from '../core/isomorphic'
import type { GridCtx } from './ctx'
import { defaultSlots } from './defaultSlots'
import type { BodyRow, DetailItem, GridView, PinnedBlock } from './gridView'
import { mergeProps } from './mergeProps'
import { rowPropsEqual } from './Row'
import type { GridSlotProps, GridSlots } from './slotTypes'
import type { PanelState } from './Toolbar'
import type { GridProps } from './types'
import { useAutoRowHeights } from './useAutoRowHeights'
import { useCellSelection } from './useCellSelection'
import { useClipboard } from './useClipboard'
import { useColumnDrag } from './useColumnDrag'
import { useKeyboard } from './useKeyboard'
import { usePanels } from './usePanels'
import { useRowDrag } from './useRowDrag'

const NO_SLOT_PROPS: GridSlotProps = {}

/** a custom `row` slot, memoised once with the grid's own comparison (the same component object gives the same wrapper) */
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

const memoRows = new WeakMap<object, ComponentType<any>>()
function memoRow(component: ComponentType<any>): ComponentType<any> {
  let wrapped = memoRows.get(component)
  if (!wrapped) memoRows.set(component, (wrapped = memo(component as FunctionComponent<any>, rowPropsEqual as (a: any, b: any) => boolean)))
  return wrapped
}

/** height of a detail panel when `renderDetailPanel` is given without `detailPanelHeight` */
const DETAIL_DEFAULT = 200

/** useMemo that recomputes only when the dependency identities change */
function useRefMemo<T>(factory: () => T, deps: unknown[]): T {
  const ref = useRef<{ deps: unknown[]; value: T }>()
  if (!ref.current || ref.current.deps.some((d, i) => !Object.is(d, deps[i]))) {
    ref.current = { deps, value: factory() }
  }
  return ref.current.value
}

/**
 * The grid without its markup: state, interactions (keyboard, selection, drag and drop, clipboard, panels), and the
 * props of every part, ready to render. `<Grid>` is a renderer over this hook; use it directly to draw the grid with
 * your own elements while keeping the virtualization, the keyboard navigation and the ARIA roles.
 */
export function useGridView<R = any>(props: GridProps<R>): GridView<R> {
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
    slots: userSlots,
    slotProps = NO_SLOT_PROPS,
    ...options
  } = props
  const slotsValue = useMemo(
    () => {
      const slots = { ...defaultSlots, ...userSlots, icons: { ...defaultSlots.icons, ...userSlots?.icons } } as GridSlots<R>
      // the speed of the grid must not depend on how a replacement row was written
      if (userSlots?.row) slots.row = memoRow(userSlots.row)
      return { slots, slotProps }
    },
    [userSlots, slotProps],
  )
  const grid = useGrid<R>({
    ...options,
    // giving a renderer is enough to turn the feature on
    detailPanelHeight: options.detailPanelHeight ?? (renderDetailPanel ? DETAIL_DEFAULT : undefined),
  } as GridOptions<R>)
  const { api, layout, rows, rowRange, colRange, rowHeight, headerHeight, headerDepth, state, geometry, detailSlots, detailRange } = grid
  /** aria-rowindex of the first body row: the header takes one row per level of column groups, plus the titles */
  const hdr = 2 + headerDepth
  const scrollerRef = useRef<HTMLDivElement>(null)
  const gridId = useId().replace(/:/g, '')
  const columns = props.columns

  const gridRef = useRef(grid)
  gridRef.current = grid
  useAutoRowHeights(!!props.getRowHeight, scrollerRef, gridRef)

  const [menu, setMenu] = useState<{ field: string; anchor: DOMRect } | null>(null)
  const [panel, setPanel] = useState<PanelState | null>(null)

  useEffect(() => {
    onReady?.(api)
  }, [api, onReady])

  // keep the viewport size in the store
  useIsomorphicLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const measure = () => api.setViewport(el.clientWidth, el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [api])

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
  }, [api])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const hasHierarchy = state.rowGroupingModel.length > 0 || !!props.getTreeDataPath || !!grid.server?.tree
  const hierarchyField = layout.all[0]?.field
  const totalWidth = layout.leftWidth + layout.centerWidth + layout.rightWidth
  const colPos = useRefMemo(() => new Map(layout.all.map((c, i) => [c.field, i])), [layout])

  const toggleSelect = useCallback((id: RenderRow['id']) => api.toggleSelection(id), [api])
  const hasDetail = (r: RenderRow<R>) =>
    !!renderDetailPanel && detailPanelToggle && r.row !== undefined && (grid.options.isDetailPanelAvailable?.(r.row) ?? true)

  /* ---- interactions: each hook gets what the grid computed above and returns what the others need ---- */
  const ctx = { cellSelection, api, state, grid, layout, fillHandle, scrollerRef, gridRef, hasHierarchy, hierarchyField, hasDetail, checkboxSelection, rows, clipboard, setPanel, setMenu, menu, columns, csvFileName } as GridCtx<R>
  Object.assign(ctx, useCellSelection(ctx))
  Object.assign(ctx, useRowDrag(ctx))
  Object.assign(ctx, useKeyboard(ctx))
  Object.assign(ctx, useClipboard(ctx))
  Object.assign(ctx, useColumnDrag(ctx))
  Object.assign(ctx, usePanels(ctx))
  const { openMenu, startColumnDrag, justDragged, finishEdit, cancelEdit, rangeKeyFor, fillColFor, onFillStart, onRowDragStart, rowDrag, openPanel, doExport, onKeyDown, onCopy, onCut, onPaste, onBodyPointerDown, onBodyClick, onBodyDoubleClick, rects, announcement, drag, openFilterFor } = ctx

  /* ---- the props of every part ---- */
  const focused = state.focusedCell
  const focusedRowIndex = focused ? grid.result.indexOf(focused.rowId) : -1
  const focusedPos = focused ? (colPos.get(focused.field) ?? -1) : -1
  const activeId =
    focusedRowIndex >= rowRange.start && focusedRowIndex < rowRange.end && focusedPos >= 0 ? `${gridId}-r${focusedRowIndex}-c${focusedPos}` : undefined

  const { pinnedTop, pinnedBottom, footer } = grid
  const aggNames = useRefMemo(
    () => grid.pivot?.aggNames ?? (Object.keys(state.aggregationModel).length ? state.aggregationModel : undefined),
    [state.aggregationModel, grid.pivot?.aggNames],
  )
  const canPinRows = rowPinning && !props.getTreeDataPath && state.rowGroupingModel.length === 0
  const detailOpen = useMemo(() => new Set(state.detailPanelExpanded), [state.detailPanelExpanded])
  const detailStateOf = (r: RenderRow<R>): 'open' | 'closed' | undefined => (hasDetail(r) ? (detailOpen.has(r.id) ? 'open' : 'closed') : undefined)
  // what every row gets, pinned or not
  const rowShared = {
    gridId,
    layout,
    colPos,
    colRange,
    rowHeight,
    totalWidth,
    hierarchyField,
    checkbox: checkboxSelection,
    onToggleExpand: api.toggleExpanded,
    onToggleSelect: toggleSelect,
    onCommit: finishEdit,
    onCancel: cancelEdit,
    rowPinning: canPinRows,
    onPinRow: api.pinRow,
    aggNames,
    aggCustom: props.aggregationFunctions,
    onToggleDetail: api.toggleDetailPanel,
  }

  const bodyRows: BodyRow<R>[] = []
  // with no columns there is nothing to draw in a row: the empty state is shown instead
  for (let i = rowRange.start; layout.all.length > 0 && i < rowRange.end; i++) {
    const r = rows[i]
    const ariaRow = hdr + pinnedTop.length + i + geometry.slotsBefore(i)
    if (!r) {
      // server data that hasn't arrived: a placeholder row (client-side grids never have gaps)
      if (grid.server && i < rows.length) {
        bodyRows.push({ type: 'skeleton', key: `sk-${i}`, props: { index: i, top: geometry.topOf(i), rowHeight: geometry.heightOf(i), totalWidth, layout, colRange, ariaRow } })
      }
      continue
    }
    const here = focused?.rowId === r.id
    bodyRows.push({
      type: 'row',
      key: r.id,
      props: {
        ...rowShared,
        rowHeight: geometry.heightOf(i),
        auto: props.getRowHeight?.({ id: r.id, row: r.row, depth: r.depth }) === 'auto',
        row: r,
        index: i,
        hasHierarchy,
        selected: grid.isSelected(r),
        focusedField: here ? focused!.field : undefined,
        editing: here && state.editingCell?.rowId === r.id ? state.editingCell : null,
        pinSide: undefined,
        ariaRow,
        rangeKey: rangeKeyFor(i),
        fillCol: fillColFor(i),
        onFillStart,
        top: geometry.topOf(i),
        detailState: detailStateOf(r),
        canReorder: grid.reorderAllowed && r.row !== undefined,
        onRowDragStart,
        dragging: rowDrag?.id === r.id,
      },
    })
  }

  const detailItems: DetailItem<R>[] = []
  if (renderDetailPanel) {
    for (let k = detailRange.start; k < detailRange.end; k++) {
      const slot = detailSlots[k]
      const row = slot && rows[slot.index]?.row
      if (!slot || row === undefined) continue
      detailItems.push({
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
  }

  const pinnedRowProps = (list: RenderRow<R>[], side: 'top' | 'bottom', firstAria: number) =>
    list.map((r, i) => ({
      ...rowShared,
      row: r,
      index: i,
      hasHierarchy: false,
      selected: grid.isSelected(r),
      focusedField: undefined,
      editing: null,
      pinSide: side,
      ariaRow: firstAria + i,
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
  const pinnedTopBlock: PinnedBlock<R> | null = pinnedTop.length
    ? { side: 'top', label: 'Pinned rows (top)', style: { top: headerHeight, height: pinnedTop.length * rowHeight, width: totalWidth }, rows: pinnedRowProps(pinnedTop, 'top', hdr) }
    : null
  const pinnedBottomBlock: PinnedBlock<R> | null =
    pinnedBottom.length > 0 || footer
      ? {
          side: 'bottom',
          label: footer ? 'Pinned rows and totals' : 'Pinned rows (bottom)',
          style: { height: (pinnedBottom.length + (footer ? 1 : 0)) * rowHeight, width: totalWidth },
          rows: [...pinnedRowProps(pinnedBottom, 'bottom', belowBody), ...(footer ? pinnedRowProps([footer], 'bottom', belowBody + pinnedBottom.length) : [])],
        }
      : null
  const pinnedHeight = (pinnedTop.length + pinnedBottom.length + (footer ? 1 : 0)) * rowHeight

  const paging = props.pagination !== false
  return {
    grid,
    slotsValue,
    scrollerRef,
    getRootProps: (extra) =>
      mergeProps(
        {
          className: `gk-root ${cellSelection ? 'gk-cell-select' : ''} ${className ?? ''}`.trim(),
          style: { height },
          'data-loading': grid.server?.loading ? '' : undefined,
          'data-pivot': grid.pivot ? '' : undefined,
        },
        extra,
      ),
    getScrollerProps: (extra) =>
      mergeProps(
        {
          ref: scrollerRef,
          className: 'gk-scroller',
          role: 'grid',
          'aria-rowcount': rows.length + detailSlots.length + hdr - 1 + pinnedTop.length + pinnedBottom.length + (footer ? 1 : 0),
          'aria-colcount': layout.all.length,
          'aria-multiselectable': checkboxSelection,
          'aria-busy': grid.server?.loading || undefined,
          'aria-activedescendant': activeId,
          tabIndex: 0,
          onScroll,
          onKeyDown,
          onCopy,
          onCut,
          onPaste,
        },
        extra,
      ),
    getContentProps: (extra) =>
      mergeProps({ className: 'gk-content', style: { width: totalWidth > 0 ? totalWidth : '100%', height: geometry.totalHeight + headerHeight + pinnedHeight } }, extra),
    getBodyProps: (extra) =>
      mergeProps(
        {
          className: 'gk-body',
          role: 'rowgroup',
          style: { height: geometry.totalHeight, ['--gk-row-h' as string]: `${rowHeight}px`, ...(layout.all.length === 0 ? { backgroundImage: 'none' } : null) }, // no columns: no placeholder stripes either
          onPointerDown: onBodyPointerDown,
          onClick: onBodyClick,
          onDoubleClick: onBodyDoubleClick,
        },
        extra,
      ),
    header: { grid, colPos, controls: columnControls, reorder: columnReorder, onOpenMenu: openMenu, onDragIntent: startColumnDrag, justDragged, totalWidth },
    bodyRows,
    detailItems,
    pinnedTop: pinnedTopBlock,
    pinnedBottom: pinnedBottomBlock,
    toolbar: toolbar ? { grid, panel, onPanel: openPanel, onExport: doExport } : null,
    openPanel,
    footer: paging || grid.server ? { grid, paging, rects } : null,
    loading: !!grid.server?.loading,
    error: grid.server?.error ? { message: grid.server.error.message, retry: () => api.refreshData() } : null,
    popovers: {
      grid,
      menu,
      panel,
      closeMenu: () => setMenu(null),
      closePanel: () => setPanel(null),
      onFilter: openFilterFor,
      aggregationMenu,
      onExportCsv: (selectedOnly) => doExport(selectedOnly ? { selectedOnly: true } : {}),
      onExportXlsx: () => {
        setPanel(null)
        void api.exportXlsx({ fileName: xlsxFileName })
      },
    },
    rowDrag,
    columnDrag: drag ? { ...drag, label: columns.find((c) => c.field === drag.field)?.headerName ?? drag.field } : null,
    announcement,
    rects,
  }
}
