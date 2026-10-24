import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useGrid, type GridOptions, type RenderRow } from '../core'
import type { GridCtx } from './ctx'
import type { GridView } from './gridView'
import { mergeProps } from './mergeProps'
import type { PanelState } from './Toolbar'
import type { GridProps } from './types'
import { useAutoRowHeights } from './useAutoRowHeights'
import { useAutosize } from './useAutosize'
import { useCellSelection } from './useCellSelection'
import { useClipboard } from './useClipboard'
import { useColumnDrag } from './useColumnDrag'
import { useGridEvents } from './useGridEvents'
import { useKeyboard } from './useKeyboard'
import { usePanels } from './usePanels'
import { useRowDrag } from './useRowDrag'
import { useRowEditOutside } from './useRowEditOutside'
import { useScrollApi } from './useScrollApi'
import { buildBodyRows, buildDetailItems, buildPinnedBlocks, type RowsInput } from './view/buildRows'
import { useSlotsValue } from './view/slotsValue'
import { useFitting } from './view/useFitting'
import { useRefMemo } from './view/useRefMemo'
import { useViewport } from './view/useViewport'

/** height of a detail panel when `renderDetailPanel` is given without `detailPanelHeight` */
const DETAIL_DEFAULT = 200

/**
 * The grid without its markup: state, interactions (keyboard, selection, drag and drop, clipboard, panels), and the
 * props of every part, ready to render. `<Grid>` is a renderer over this hook; use it directly to draw the grid with
 * your own elements while keeping the virtualization, the keyboard navigation and the ARIA roles.
 */
export function useGridView<R = any>(props: GridProps<R>): GridView<R> {
  const {
    height = 400,
    autoHeight = false,
    checkboxSelection = false,
    rowSelectionOnClick = false,
    densitySelector = false,
    pageSizeOptions,
    autoPageSize = false,
    toolbar = false,
    pivotPanelMode = 'docked',
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
    autosizeOnMount = false,
    autosizeOptions,
    onRowClick,
    onRowDoubleClick,
    onCellClick,
    onCellDoubleClick,
    onCellKeyDown,
    onColumnHeaderClick,
    onColumnHeaderDoubleClick,
    slots: userSlots,
    slotProps,
    ...options
  } = props
  const slotsValue = useSlotsValue<R>(userSlots, slotProps)
  const grid = useGrid<R>({
    ...options,
    // giving a renderer is enough to turn the feature on
    detailPanelHeight: options.detailPanelHeight ?? (renderDetailPanel ? DETAIL_DEFAULT : undefined),
  } as GridOptions<R>)
  const events = useGridEvents<R>(grid, { onRowClick, onRowDoubleClick, onCellClick, onCellDoubleClick, onCellKeyDown, onColumnHeaderClick, onColumnHeaderDoubleClick })
  const { api, layout, rows, rowRange, colRange, rowHeight, headerHeight, headerDepth, state, geometry, detailSlots, detailRange } = grid
  /** aria-rowindex of the first body row: the header takes one row per level of column groups, plus the titles */
  const hdr = 2 + headerDepth
  const scrollerRef = useRef<HTMLDivElement>(null)
  const gridId = useId().replace(/:/g, '')
  const columns = props.columns

  const gridRef = useRef(grid)
  gridRef.current = grid
  useAutoRowHeights(!!props.getRowHeight, scrollerRef, gridRef)
  useAutosize(api, scrollerRef, gridRef)
  useScrollApi(api, scrollerRef, gridRef)
  useRowEditOutside(api, scrollerRef, state.editingRow)
  const autosizeRef = useRef(autosizeOptions)
  autosizeRef.current = autosizeOptions
  useFitting(api, gridRef, autosizeRef, { autosizeOnMount, autoPageSize, paginated: props.pagination !== false, viewportHeight: state.viewport.height, density: state.density })

  const [menu, setMenu] = useState<{ field: string; anchor: DOMRect } | null>(null)
  const [panel, setPanel] = useState<PanelState | null>(null)

  useEffect(() => {
    onReady?.(api)
  }, [api, onReady])

  const onScroll = useViewport(api, scrollerRef, gridRef)

  const hasHierarchy = state.rowGroupingModel.length > 0 || !!props.getTreeDataPath || !!grid.server?.tree
  const hierarchyField = layout.all[0]?.field
  const totalWidth = layout.leftWidth + layout.centerWidth + layout.rightWidth
  const colPos = useRefMemo(() => new Map(layout.all.map((c, i) => [c.field, i])), [layout])

  const isSelectable = grid.options.isRowSelectable
  const canSelect = (r: RenderRow<R>) => !isSelectable || r.row === undefined || isSelectable({ id: r.id, row: r.row })
  const toggleSelect = useCallback((id: RenderRow['id']) => api.toggleSelection(id), [api])
  const hasDetail = (r: RenderRow<R>) =>
    !!renderDetailPanel && detailPanelToggle && r.row !== undefined && (grid.options.isDetailPanelAvailable?.(r.row) ?? true)

  /* ---- interactions: each hook gets what the grid computed above and returns what the others need ---- */
  const ctx = { cellSelection, api, state, grid, layout, fillHandle, scrollerRef, gridRef, hasHierarchy, hierarchyField, hasDetail, checkboxSelection, rowSelectionOnClick, rows, clipboard, setPanel, setMenu, menu, columns, csvFileName } as GridCtx<R>
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
    onEditValue: api.setEditValue,
    rowPinning: canPinRows,
    onPinRow: api.pinRow,
    aggNames,
    aggCustom: props.aggregationFunctions,
    onToggleDetail: api.toggleDetailPanel,
    getCellClassName: props.getCellClassName,
  }

  const rowsInput: RowsInput<R> = {
    grid,
    props,
    hdr,
    totalWidth,
    hasHierarchy,
    shared: rowShared,
    canSelect,
    detailStateOf,
    rangeKeyFor,
    fillColFor,
    onFillStart,
    onRowDragStart,
    draggingId: rowDrag?.id,
  }
  const bodyRows = buildBodyRows(rowsInput)
  const detailItems = buildDetailItems(rowsInput)
  const pinned = buildPinnedBlocks(rowsInput)
  const { pinnedTop, pinnedBottom, footer } = grid
  const dockedPivot = panel?.kind === 'pivot' && pivotPanelMode === 'docked'

  const paging = props.pagination !== false
  return {
    grid,
    slotsValue,
    scrollerRef,
    getRootProps: (extra) =>
      mergeProps(
        {
          className: `gk-root ${cellSelection ? 'gk-cell-select' : ''} ${className ?? ''}`.trim(),
          style: autoHeight ? undefined : { height },
          'data-autoheight': autoHeight ? '' : undefined,
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
          'aria-multiselectable': (checkboxSelection || rowSelectionOnClick) && grid.options.multipleRowSelection !== false,
          'aria-busy': grid.server?.loading || undefined,
          'aria-activedescendant': activeId,
          tabIndex: 0,
          onScroll,
          onKeyDown,
          ...events,
          onCopy,
          onCut,
          onPaste,
        },
        extra,
      ),
    getContentProps: (extra) =>
      mergeProps({ className: 'gk-content', style: { width: totalWidth > 0 ? totalWidth : '100%', height: geometry.totalHeight + headerHeight + pinned.height } }, extra),
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
    header: { grid, colPos, onAutosize: (field: string) => api.autosizeColumns({ ...autosizeRef.current, columns: [field] }), controls: columnControls, reorder: columnReorder, onOpenMenu: openMenu, onDragIntent: startColumnDrag, justDragged, totalWidth },
    bodyRows,
    detailItems,
    pinnedTop: pinned.top,
    pinnedBottom: pinned.bottom,
    toolbar: toolbar ? { grid, panel, onPanel: openPanel, onExport: doExport, densitySelector } : null,
    openPanel,
    footer: paging || grid.server ? { grid, paging, rects, pageSizeOptions } : null,
    loading: !!grid.server?.loading,
    error: grid.server?.error ? { message: grid.server.error.message, retry: () => api.refreshData() } : null,
    dock: dockedPivot ? { onClose: () => setPanel(null) } : null,
    popovers: {
      grid,
      menu,
      panel: dockedPivot ? null : panel, // a docked panel is not a popover
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
