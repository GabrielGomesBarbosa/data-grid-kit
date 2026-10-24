import { useCallback, useMemo, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useGrid, type GridOptions, type RenderRow } from '../core'
import { useIsomorphicLayoutEffect } from '../core/isomorphic'

import { Header } from './Header'
import { Footer } from './Footer'
import { ErrorBanner, EmptyState, LoadingBar } from './Overlays'
import { ColumnDragFeedback, RowDragFeedback } from './DragFeedback'
import { Popovers } from './Popovers'
import { type UIColumnDef, type GridProps } from './types'
import { DetailPanel } from './DetailPanel'
import { SkeletonRow } from './SkeletonRow'
import { Row } from './Row'
import { Toolbar, type PanelState } from './Toolbar'

import { useCellSelection } from './useCellSelection'
import { useRowDrag } from './useRowDrag'
import { useKeyboard } from './useKeyboard'
import { useClipboard } from './useClipboard'
import { useColumnDrag } from './useColumnDrag'
import { usePanels } from './usePanels'
import type { GridCtx } from './ctx'

export type { GridProps, UIColumnDef }

/** height of a detail panel when `renderDetailPanel` is given without `detailPanelHeight` */
const DETAIL_DEFAULT = 200

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
  useIsomorphicLayoutEffect(() => {
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

  const { pinnedTop, pinnedBottom, footer } = grid
  const aggNames = useRefMemo(
    () => grid.pivot?.aggNames ?? (Object.keys(state.aggregationModel).length ? state.aggregationModel : undefined),
    [state.aggregationModel, grid.pivot?.aggNames],
  )
  const aggCustom = props.aggregationFunctions
  const canPinRows = rowPinning && !props.getTreeDataPath && state.rowGroupingModel.length === 0
  const pinnedHeight = (pinnedTop.length + pinnedBottom.length + (footer ? 1 : 0)) * rowHeight
  const detailOpen = useMemo(() => new Set(state.detailPanelExpanded), [state.detailPanelExpanded])
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
      {grid.server?.loading && <LoadingBar />}
      {grid.server?.error && <ErrorBanner message={grid.server.error.message} onRetry={() => api.refreshData()} />}
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
          <Header
            grid={grid}
            colPos={colPos}
            controls={columnControls}
            reorder={columnReorder}
            onOpenMenu={openMenu}
            onDragIntent={startColumnDrag}
            justDragged={justDragged}
            totalWidth={totalWidth}
          />
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
          <EmptyState grid={grid} />
        </div>
      </div>
      {(props.pagination !== false || grid.server) && <Footer grid={grid} paging={props.pagination !== false} rects={rects} />}

      {rowDrag && <RowDragFeedback drag={rowDrag} scroller={scrollerRef} />}
      <div className="gk-sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      {drag && <ColumnDragFeedback drag={drag} label={columns.find((c) => c.field === drag.field)?.headerName ?? drag.field} />}
      <Popovers
        grid={grid}
        menu={menu}
        panel={panel}
        closeMenu={() => setMenu(null)}
        closePanel={() => setPanel(null)}
        onFilter={openFilterFor}
        aggregationMenu={aggregationMenu}
        onExportCsv={(selectedOnly) => doExport(selectedOnly ? { selectedOnly: true } : {})}
        onExportXlsx={() => {
          setPanel(null)
          void api.exportXlsx({ fileName: xlsxFileName })
        }}
      />
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
