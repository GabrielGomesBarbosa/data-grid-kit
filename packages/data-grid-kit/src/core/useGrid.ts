import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createApi } from './api'
import { identity } from './api/context'
import { defaultState } from './gridState'
import type { GridApi, GridInstance, PivotInfo, ServerInfo } from './gridTypes'
import { createStore, useStore, type Store } from './store'
import { DEFAULT_HEADER_HEIGHT, DEFAULT_ROW_HEIGHT, computeColumnLayout, computeColumnRange, rangeEqual, type ColumnLayout, type Range } from './layout'

import { createRowGeometry, rowHeightsOf, type DetailSlot } from './geometry'

import { createPipeline, type PipelineResult } from './pipeline'
import type { DataSourceController } from './dataSource'
import type { ServerTree } from './serverTree'
import { useServerData, useServerInfo, useServerView } from './useServerData'

import { useMeasuredHeights } from './useMeasuredHeights'
import { visiblePivot } from './pivotModel'
import { resolveLocaleText } from './localeText'
import { PIVOT_ROWS_FIELD, buildPivotColumns, pivotAggSortOf, pivotInputOf, pivotSortOf, withDerivedColumns } from './pivot'
import { type ColumnDef, type GridOptions, type GridState, type RenderRow, type RowId } from './types'

/** height assumed for an 'auto' detail panel until its content has been measured */
export const DETAIL_ESTIMATE = 160

export type { ApplyResult, AutosizeOptions, ColumnMeasurer, GridApi, GridInstance, PivotInfo, ScrollAlign, ScrollHandler, ServerInfo } from './gridTypes'

const EMPTY_ROWS: never[] = []

/** scroll and viewport change constantly; consumers read them through the windowed ranges instead */
function modelsEqual(a: GridState, b: GridState) {
  for (const key of Object.keys(a) as (keyof GridState)[]) {
    if (key === 'scroll' || key === 'viewport') continue
    if (!Object.is(a[key], b[key])) return false
  }
  return true
}

const rangesStable = (a: [Range, Range, Range], b: [Range, Range, Range]) =>
  rangeEqual(a[0], b[0]) && rangeEqual(a[1], b[1]) && rangeEqual(a[2], b[2])

/**
 * Headless grid. Owns the store, runs the memoised row pipeline and returns everything a UI
 * needs. Scroll position lives in the store, but components only re-render when the visible
 * row/column window actually changes.
 */
/** Columns of type `actions` hold buttons, not data: they cannot be sorted, filtered, edited, grouped or aggregated. */
function withActionColumns<R>(options: GridOptions<R>, columns: ColumnDef<R>[]): GridOptions<R> {
  return { ...options, columns }
}

export function useGrid<R = any>(rawOptions: GridOptions<R>): GridInstance<R> {
  const actionColumns = useMemo(
    () => (rawOptions.columns.some((c) => c.type === 'actions') ? rawOptions.columns.map((c) => (c.type === 'actions' ? { ...c, sortable: false, filterable: false, groupable: false, aggregable: false, editable: false } : c)) : rawOptions.columns),
    [rawOptions.columns],
  )
  const options = actionColumns === rawOptions.columns ? rawOptions : withActionColumns(rawOptions, actionColumns)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const resultRef = useRef<PipelineResult<R>>()
  const ctrlRef = useRef<DataSourceController<R>>()
  const treeRef = useRef<ServerTree<R>>()
  const layoutRef = useRef<ColumnLayout<R>>()
  const pinningActiveRef = useRef(true)
  // bumping this re-renders after the pipeline was patched outside of render
  const [, setPatchVersion] = useState(0)
  const storeRef = useRef<Store<GridState>>()
  if (!storeRef.current) storeRef.current = createStore(defaultState(options))
  const store = storeRef.current

  const pipelineRef = useRef<ReturnType<typeof createPipeline<R>>>()
  if (!pipelineRef.current) pipelineRef.current = createPipeline<R>()

  // controlled slices override the store; everything else flows through it
  const state = useStore(store, (s) => s, modelsEqual)
  const pivotAvailable = !!options.pivoting && !options.dataSource
  const effective = useMemo<GridState>(() => {
    const s = options.state ? { ...state, ...options.state } : state
    // in pivot mode the row groups are the pivot's rows; everything downstream reads them from here
    return pivotAvailable && s.pivotMode ? { ...s, rowGroupingModel: visiblePivot(s.pivotModel).rows } : s
  }, [state, options.state, pivotAvailable])
  const pivotActive = pivotAvailable && effective.pivotMode

  const apiRef = useRef<GridApi<R>>()
  if (!apiRef.current) {
    apiRef.current = createApi({
      store,
      optionsRef,
      resultRef,
      layoutRef,
      ctrlRef,
      treeRef,
      pipelineRef,
      pinningActiveRef,
      apiRef,
      bump: () => setPatchVersion((v) => v + 1),
    })
  }
  const api = apiRef.current

  // The pipeline treats these as pure and ignores their identity, so inline arrow functions are fine.
  const stableGetRowId = useCallback((row: R) => (optionsRef.current.getRowId ?? identity)(row), [])
  const stableTreePath = useCallback((row: R) => optionsRef.current.getTreeDataPath!(row), [])
  const expandedSet = useMemo(() => new Set(effective.expandedIds), [effective.expandedIds])
  const hasPagination = options.pagination !== false

  // Pinned rows leave the main list. With grouping or tree data they would have no sensible place, so
  // pinning is simply not applied there.
  const hasDataSource = !!options.dataSource
  const pinningOn = !hasDataSource && !options.getTreeDataPath && !pivotActive && effective.rowGroupingModel.length === 0
  pinningActiveRef.current = pinningOn
  const pinnedIds = useMemo(
    () => new Set<RowId>(pinningOn ? [...effective.pinnedRows.top, ...effective.pinnedRows.bottom] : []),
    [pinningOn, effective.pinnedRows],
  )

  const detailEnabled = options.detailPanelHeight !== undefined
  const detailIds = useMemo(
    () => (detailEnabled ? new Set<RowId>(effective.detailPanelExpanded) : undefined),
    [detailEnabled, effective.detailPanelExpanded],
  )

  const paged = hasPagination
  const serverData = useServerData({ options, optionsRef, effective, expandedSet, detailIds, stableGetRowId, hasDataSource, paged, ctrlRef, treeRef })
  const { serverResult, pageSize } = serverData

  const text = useMemo(() => resolveLocaleText(options.localeText), [options.localeText])
  // The generated pivot columns say a few of those texts: they are rebuilt when what they would say changes, not when the
  // object does (a `localeText` written inline is a new object every render, and the columns must not be laid out again for it).
  const pivotTextKey = [text.pivotRowsHeader, text.pivotTotalGroup, text.aggregationSum, text.aggregationAvg, text.aggregationMin, text.aggregationMax, text.aggregationCount, text.aggregationSize, text.pivotYear('\u0000'), text.pivotQuarter('\u0000'), text.pivotQuarterValue(1)].join('\u0001')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pivotText = useMemo(() => text, [pivotTextKey])

  // columns the pipeline knows: the real ones, plus (for the pivot panel) what is derived from them
  const sourceColumns = useMemo(
    () => (options.pivoting ? withDerivedColumns(options.columns, options.pivotDerivedColumns, pivotText) : options.columns),
    [options.pivoting, options.columns, options.pivotDerivedColumns, pivotText],
  )
  const pivotInput = useMemo(
    () => (pivotActive ? pivotInputOf(effective.pivotModel, !!options.pivotTotals) : undefined),
    [pivotActive, effective.pivotModel, options.pivotTotals],
  )
  const pipelineSort = useMemo(
    () => (pivotActive ? pivotSortOf(effective.sortModel, visiblePivot(effective.pivotModel).rows) : effective.sortModel),
    [pivotActive, effective.sortModel, effective.pivotModel],
  )

  const result: PipelineResult<R> = serverResult ?? pipelineRef.current({
    rows: options.rows ?? EMPTY_ROWS,
    columns: sourceColumns,
    getRowId: stableGetRowId,
    getTreeDataPath: options.getTreeDataPath ? stableTreePath : undefined,
    sortModel: pipelineSort,
    filterModel: effective.filterModel,
    ignoreDiacritics: options.ignoreDiacritics,
    rowGroupingModel: effective.rowGroupingModel,
    expandedIds: expandedSet,
    expandAllByDefault: effective.expandAllByDefault,
    pagination: hasPagination ? effective.paginationModel : undefined,
    hiddenIds: pinnedIds,
    detailIds,
    aggregationModel: effective.aggregationModel,
    aggregationFunctions: options.aggregationFunctions,
    pivot: pivotInput,
    aggSort: pivotActive ? pivotAggSortOf(effective.sortModel) : undefined,
  })
  resultRef.current = result

  // pivot mode swaps the columns for generated ones: a row-label column and one column per distinct column value
  const layoutColumns = useMemo(
    () => (pivotActive ? buildPivotColumns(result.pivotColumns, sourceColumns, effective.pivotModel, options.pivotColumnDef, pivotText) : options.columns),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pivotActive, result.pivotColumns, sourceColumns, effective.pivotModel, options.columns, pivotText],
  )
  const pivotInfo = useMemo<PivotInfo | null>(() => {
    if (!pivotActive) return null
    const aggNames: Record<string, string> = {}
    for (const c of result.pivotColumns) aggNames[c.field] = c.aggFunc
    return { columns: result.pivotColumns, aggNames, sourceColumns }
  }, [pivotActive, result.pivotColumns, sourceColumns])

  // the grid's width only matters to the layout when a column has `flex`: otherwise a resize must not rebuild it
  const flexWidth = layoutColumns.some((c) => (c.flex ?? 0) > 0) ? effective.viewport.width : 0
  const layout = useMemo(
    () =>
      computeColumnLayout(layoutColumns, {
        columnOrder: effective.columnOrder,
        columnWidths: effective.columnWidths,
        columnVisibility: effective.columnVisibility,
        // the group labels stay in view while the pivot columns scroll
        pinnedColumns: pivotActive ? { ...effective.pinnedColumns, left: [PIVOT_ROWS_FIELD, ...effective.pinnedColumns.left] } : effective.pinnedColumns,
      }, flexWidth),
    [layoutColumns, pivotActive, effective.columnOrder, effective.columnWidths, effective.columnVisibility, effective.pinnedColumns, flexWidth],
  )

  layoutRef.current = layout

  const densityFactor = effective.density === 'compact' ? 0.75 : effective.density === 'comfortable' ? 1.3 : 1
  const rowHeight = Math.round((options.rowHeight ?? DEFAULT_ROW_HEIGHT) * densityFactor)
  const headerRowHeight = Math.round((options.headerHeight ?? DEFAULT_HEADER_HEIGHT) * densityFactor)
  // header groups (pivot columns) stack rows above the column titles
  const headerDepth = useMemo(() => layout.all.reduce((d, c) => Math.max(d, c.group?.length ?? 0), 0), [layout])
  const headerHeight = headerRowHeight * (1 + headerDepth)

  const pinnedOf = (ids: RowId[]): RenderRow<R>[] => {
    const out: RenderRow<R>[] = []
    if (!pinningOn) return out
    for (const id of ids) {
      const row = result.getRow(id)
      if (row !== undefined) {
        out.push({ id, type: 'leaf', depth: 0, row, childCount: 0, expandable: false, expanded: false })
      }
    }
    return out
  }
  const pinnedTop = pinnedOf(effective.pinnedRows.top)
  const pinnedBottom = pinnedOf(effective.pinnedRows.bottom)
  const totals = result.getTotals()
  const footer = useMemo<RenderRow<R> | null>(
    () =>
      totals && options.aggregationFooter !== false
        ? { id: '__gk_footer__', type: 'footer', depth: 0, childCount: result.filteredCount, expandable: false, expanded: false, aggregates: totals }
        : null,
    [totals, result.filteredCount, options.aggregationFooter],
  )
  const pinnedHeight = (pinnedTop.length + pinnedBottom.length + (footer ? 1 : 0)) * rowHeight

  // open detail panels, with their heights (fixed, or measured for 'auto')
  const detailSlots = useMemo(() => {
    const out: { id: RowId; index: number; height: number; auto: boolean }[] = []
    if (!detailEnabled) return out
    const opt = options.detailPanelHeight!
    for (const { id, index } of result.detailRows) {
      const row = result.rows[index]?.row
      if (row === undefined || options.isDetailPanelAvailable?.(row) === false) continue
      const h = typeof opt === 'function' ? opt(row) : opt
      const auto = h === 'auto'
      out.push({ id, index, height: auto ? (effective.detailHeights[id] ?? DETAIL_ESTIMATE) : h, auto })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailEnabled, result, effective.detailHeights, options.detailPanelHeight, options.isDetailPanelAvailable])
  const { measured, version: measuredVersion, report: reportRowHeights } = useMeasuredHeights()
  const rowHeights = useMemo(
    () => (options.getRowHeight ? rowHeightsOf(result.rows, rowHeight, options.getRowHeight, options.getEstimatedRowHeight, measured) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result.rows, rowHeight, options.getRowHeight, options.getEstimatedRowHeight, measuredVersion],
  )
  const geometry = useMemo(
    () => createRowGeometry(rowHeight, result.rows.length, detailSlots as DetailSlot[], rowHeights?.heights),
    [rowHeight, result.rows.length, detailSlots, rowHeights],
  )
  // a row sized by its content is as tall as its tallest cell, so every column has to be rendered (as MUI does)
  const allColumns = !!rowHeights?.hasAuto && !options.virtualizeColumnsWithAutoRowHeight

  // Only the *window* is a render dependency: scrolling inside a window costs nothing.
  const [rowRange, colWindow, detailRange] = useStore(
    store,
    (s): [Range, Range, Range] => {
      const buffer = options.rowBufferPx ?? rowHeight * 8
      const visible = s.viewport.height - headerHeight - pinnedHeight
      const w = geometry.window(s.scroll.top - buffer, s.scroll.top + visible + buffer)
      return [
        { start: w.start, end: w.end },
        allColumns ? { start: 0, end: layout.center.length } : computeColumnRange(layout, s.scroll.left, s.viewport.width, options.columnBufferPx ?? 200),
        { start: w.slotStart, end: w.slotEnd },
      ]
    },
    rangesStable,
  )
  // a row-window change must not hand every row a new column range object (rows compare it by identity)
  const colRange = useMemo(() => colWindow, [colWindow.start, colWindow.end]) // eslint-disable-line react-hooks/exhaustive-deps

  const reorderAllowed =
    !!options.rowReordering &&
    !hasDataSource &&
    !options.getTreeDataPath &&
    !pivotActive &&
    effective.rowGroupingModel.length === 0 &&
    effective.sortModel.length === 0 &&
    effective.editingCell === null

  useServerView(serverData, paged, effective.paginationModel.page, rowRange)
  const server = useServerInfo(serverData, paged)

  const selectionSet = useMemo(() => new Set(effective.selection), [effective.selection])
  const isSelected = useCallback(
    (row: RenderRow<R>): boolean | 'indeterminate' => {
      if (row.type === 'leaf' && !row.expandable) return selectionSet.has(row.id)
      const ids = result.getLeafIds(row.id)
      if (!ids.length) return false
      const n = ids.reduce<number>((c, id) => c + (selectionSet.has(id) ? 1 : 0), 0)
      return n === 0 ? false : n === ids.length ? true : 'indeterminate'
    },
    [selectionSet, result],
  )

  return { api, options, text, locale: options.locale, rowHeight, headerHeight, headerRowHeight, headerDepth, pivot: pivotInfo, layout, result, rows: result.rows, rowRange, colRange, geometry, reportRowHeights, detailSlots, detailRange, reorderAllowed, server, footer, pinnedTop, pinnedBottom, state: effective, isSelected }
}

export type { ColumnDef }
