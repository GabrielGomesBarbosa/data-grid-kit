import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useIsomorphicLayoutEffect } from './isomorphic'
import { createStore, useStore, type Store } from './store'
import {
  DEFAULT_HEADER_HEIGHT,
  DEFAULT_ROW_HEIGHT,
  computeColumnLayout,
  computeColumnRange,
  rangeEqual,
  type ColumnLayout,
  type Range,
} from './layout'
import { toCsv, type CsvOptions } from './csv'
import { createRowGeometry, type DetailSlot, type RowGeometry } from './geometry'
import { neighborInGroup, planColumnMove, type DropPlacement } from './reorder'
import { cellToText, emptyValueFor, parseCellText, parseTsv, toTsv } from './clipboard'
import { fillSourceOf, fillTarget, resolveRange, type CellPoint, type CellRange, type RangeRect } from './range'
import { getCellValue } from './values'
import { createPipeline, type PipelineResult, type PivotColumn, type RowChanges } from './pipeline'
import { DataSourceController, DataSourceError, type DataSourceSnapshot } from './dataSource'
import { buildServerResult } from './serverResult'
import { buildXlsx, XLSX_MIME } from './xlsx'
import { sheetOfGrid, type XlsxExportOptions } from './xlsxExport'
import { PIVOT_ROWS_FIELD, buildPivotColumns, pivotInputOf, pivotSortOf, withDerivedColumns } from './pivot'
import {
  EMPTY_PIVOT,
  type PivotModel,
  type CellRef,
  type ColumnDef,
  type FilterModel,
  type GridOptions,
  type GridState,
  type PaginationModel,
  type PinSide,
  type RenderRow,
  type RowId,
  type SortItem,
} from './types'

/** height assumed for an 'auto' detail panel until its content has been measured */
export const DETAIL_ESTIMATE = 160

function defaultState<R>(options: GridOptions<R>): GridState {
  const init = options.initialState ?? {}
  return {
    sortModel: [],
    filterModel: { items: [] },
    paginationModel: { page: 0, pageSize: 100 },
    selection: [],
    columnOrder: options.columns.map((c) => c.field),
    columnWidths: {},
    columnVisibility: {},
    pinnedColumns: { left: [], right: [] },
    rowGroupingModel: [],
    expandedIds: [],
    expandAllByDefault: false,
    pinnedRows: { top: [], bottom: [] },
    aggregationModel: {},
    pivotMode: false,
    pivotModel: EMPTY_PIVOT,
    detailPanelExpanded: [],
    detailHeights: {},
    cellSelection: [],
    focusedCell: null,
    editingCell: null,
    scroll: { top: 0, left: 0 },
    viewport: { width: 800, height: 400 },
    ...init,
  }
}

/** What a bulk cell change (paste, fill, delete) did. */
export interface ApplyResult {
  /** cells written */
  applied: number
  /** cells left alone: not editable, nothing to change, or text that doesn't fit the column */
  skipped: number
  /** cells whose row was refused by processRowUpdate */
  rejected: number
}

export interface GridApi<R = any> {
  store: Store<GridState>
  setSortModel(model: SortItem[]): void
  /** click-style toggle: none → asc → desc → none. `multi` keeps other sorted columns. */
  toggleSort(field: string, multi?: boolean): void
  setFilterModel(model: FilterModel): void
  setQuickFilter(text: string): void
  setPage(page: number): void
  setPageSize(size: number): void
  pinColumn(field: string, side: PinSide | null): void
  setColumnWidth(field: string, width: number): void
  setColumnVisibility(field: string, visible: boolean): void
  moveColumn(field: string, toIndex: number): void
  /** move a column next to another one in the same group (pinned left / scrolling / pinned right) */
  reorderColumn(field: string, target: string, placement: DropPlacement): boolean
  /** keep a row visible above or below the scrolling rows (null unpins). Ignored with grouping / tree data. */
  pinRow(id: RowId, side: 'top' | 'bottom' | null): void
  /** open, close or toggle the detail panel under a row (needs `detailPanelHeight`) */
  toggleDetailPanel(id: RowId, open?: boolean): void
  setDetailPanelExpanded(ids: RowId[]): void
  /** the measured height of an 'auto' panel; the grid calls this itself */
  setDetailPanelHeight(id: RowId, height: number): void
  /**
   * Move a row in the data order: before another row (null = to the end) or after one. Flat grids only.
   * Returns false when nothing moved. Calls `onRowOrderChange`.
   */
  moveRow(id: RowId, to: { before: RowId | null } | { after: RowId }): boolean
  /** would `moveRow` do something? (no side effects) */
  canMoveRow(id: RowId, to: { before: RowId | null } | { after: RowId }): boolean
  /** choose how a column is aggregated ('sum', 'avg', …, or a custom name); null removes it */
  setAggregation(field: string, name: string | null): void
  setAggregationModel(model: Record<string, string>): void
  /** turn pivot mode on or off (needs the `pivoting` option) */
  setPivotMode(on: boolean): void
  /** what the pivot table is made of; a function gets the current model */
  setPivotModel(model: PivotModel | ((current: PivotModel) => PivotModel)): void
  /** shift a column one place left or right inside its group; false at the edge */
  moveColumnBy(field: string, delta: -1 | 1): boolean
  setRowGroupingModel(fields: string[]): void
  toggleExpanded(id: RowId): void
  expandAll(): void
  collapseAll(): void
  toggleSelection(id: RowId, selected?: boolean): void
  clearSelection(): void
  setScroll(top: number, left: number): void
  setViewport(width: number, height: number): void
  focusCell(cell: CellRef | null): void
  /** select a block of cells; `add` keeps the existing ranges (Ctrl/Cmd+click) */
  selectCells(range: CellRange, options?: { add?: boolean }): void
  /** move the free end of the active range (starting one at the focused cell if there is none) */
  extendCellSelection(focus: CellPoint): void
  clearCellSelection(): void
  /** the selected ranges as index rectangles over the current rows and columns */
  getCellRects(): RangeRect[]
  /** tab-separated text of the active range (or the selected rows, or the focused cell) */
  copySelection(): string
  /** paste tab-separated text at the active range / focused cell */
  pasteText(text: string): Promise<ApplyResult>
  /** clear the editable cells of the selection (what Delete and cut do) */
  clearSelectedCells(): Promise<ApplyResult>
  /** write values to cells, going through valueSetter and processRowUpdate once per row */
  applyCellValues(changes: { rowId: RowId; field: string; value: unknown }[]): Promise<ApplyResult>
  /** repeat the source block's pattern over the cells between it and (row, col) */
  fillCells(source: RangeRect, to: { row: number; col: number }): Promise<ApplyResult>
  /** true when the cell can be edited (column editable, data row, `isCellEditable` agrees) */
  isCellEditable(rowId: RowId, field: string): boolean
  /** enter edit mode; `seed` replaces the value with typed text. Returns false if not editable. */
  startEdit(rowId: RowId, field: string, seed?: string): boolean
  cancelEdit(): void
  /** apply the edited value through `valueSetter` / `processRowUpdate`. Resolves false if rejected. */
  commitEdit(value: unknown): Promise<boolean>
  /**
   * Insert, update or remove rows without rebuilding the grid: only the sort/filter/group nodes on the
   * changed rows' paths are touched. Upsert semantics: `insert` and `update` both replace a row whose id
   * exists and add one that doesn't. Kept until the `rows` prop gets a new identity.
   */
  updateRows(changes: RowChanges<R>): void
  /** Server data: forget everything and fetch again (the rows on screen stay until the new ones arrive). */
  refreshData(): void
  /** Server data: what the data source is doing right now, or null without a `dataSource` */
  getDataSourceState(): DataSourceSnapshot | null
  /** CSV of every row passing the filter, in current order, using visible columns */
  getCsv(options?: CsvOptions & { selectedOnly?: boolean }): string
  /** the grid as an .xlsx file (bytes): visible columns, rows as filtered and sorted, group rows with aggregates */
  getXlsx(options?: XlsxExportOptions): Promise<Uint8Array>
  /** download the grid as an .xlsx file */
  exportXlsx(options?: XlsxExportOptions): Promise<void>
}

export interface ServerInfo {
  /** 'pages' (paginated) or 'lazy' (positions that load as you scroll) */
  mode: 'pages' | 'lazy'
  /** rows in the data set; -1 until the server says */
  rowCount: number
  /** with an unknown row count: is there more beyond what has loaded? */
  hasNextPage: boolean
  /** rows in view are being fetched */
  loading: boolean
  error: DataSourceError | null
  /** rows loaded so far */
  loadedEnd: number
}

/** pivot mode, while it is on */
export interface PivotInfo {
  /** the value columns that exist for the current data */
  columns: PivotColumn[]
  /** pivot column field → aggregation function */
  aggNames: Record<string, string>
  /** the columns the pivot panel offers: the real ones plus the derived ones */
  sourceColumns: ColumnDef<any>[]
}

export interface GridInstance<R = any> {
  api: GridApi<R>
  options: GridOptions<R>
  rowHeight: number
  /** the whole header: `headerRowHeight` for the titles plus one row per level of column groups */
  headerHeight: number
  headerRowHeight: number
  /** rows of column groups above the titles (0 without pivot columns) */
  headerDepth: number
  /** set while pivot mode is on */
  pivot: PivotInfo | null
  layout: ColumnLayout<R>
  result: PipelineResult<R>
  /** rows of the current page after filter/sort/grouping/expansion */
  rows: RenderRow<R>[]
  rowRange: Range
  colRange: Range
  /** where each row sits vertically, with the open detail panels between rows */
  geometry: RowGeometry
  /** open detail panels, top to bottom */
  detailSlots: { id: RowId; index: number; height: number; auto: boolean }[]
  /** which of `detailSlots` are near the viewport: [start, end) */
  detailRange: Range
  /** dragging rows is possible right now: enabled, flat, not sorted, nothing being edited */
  reorderAllowed: boolean
  /** server-side data only: the state of the data source */
  server: ServerInfo | null
  /** the total row (aggregates over every row passing the filter), or null */
  footer: RenderRow<R> | null
  /** pinned rows that currently exist, in pin order (empty when grouping or tree data is on) */
  pinnedTop: RenderRow<R>[]
  pinnedBottom: RenderRow<R>[]
  state: GridState
  isSelected(row: RenderRow<R>): boolean | 'indeterminate'
}

const identity = (row: any): RowId => row.id
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
export function useGrid<R = any>(options: GridOptions<R>): GridInstance<R> {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const resultRef = useRef<PipelineResult<R>>()
  const ctrlRef = useRef<DataSourceController<R>>()
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
    return pivotAvailable && s.pivotMode ? { ...s, rowGroupingModel: s.pivotModel.rows } : s
  }, [state, options.state, pivotAvailable])
  const pivotActive = pivotAvailable && effective.pivotMode

  const apiRef = useRef<GridApi<R>>()
  if (!apiRef.current) {
    const set = (patch: Partial<GridState> | ((s: GridState) => Partial<GridState>)) => {
      const prev = store.getState()
      store.setState(patch)
      const next = store.getState()
      if (next !== prev) optionsRef.current.onStateChange?.(next, prev)
    }
    /** Where a move would put a row, or null when it would change nothing (or can't be done). */
    const resolveMove = (id: RowId, to: { before: RowId | null } | { after: RowId }) => {
      const res = resultRef.current
      if (!res) return null
      const row = res.getRow(id)
      const from = res.dataIndexOf(id)
      if (row === undefined || from < 0) return null
      let beforeId: RowId | null
      if ('before' in to) beforeId = to.before
      else {
        const i = res.dataIndexOf(to.after)
        if (i < 0) return null
        beforeId = res.dataIdAt(i + 1) ?? null
      }
      if (beforeId === id) return null
      const beforeIndex = beforeId === null ? res.dataCount : res.dataIndexOf(beforeId)
      if (beforeIndex < 0) return null
      const targetIndex = from < beforeIndex ? beforeIndex - 1 : beforeIndex
      return targetIndex === from ? null : { row, from, beforeId, targetIndex }
    }
    /** run a row through the server (updateRow) or the app (processRowUpdate); throws if refused */
    const persist = async (next: R, old: R, id: RowId): Promise<R> => {
      const o = optionsRef.current
      if (o.dataSource?.updateRow) {
        const params = { rowId: id, updatedRow: next, previousRow: old }
        try {
          return ((await o.dataSource.updateRow(params)) ?? next) as R
        } catch (cause) {
          const error = new DataSourceError('updateRow', params, cause)
          o.onDataSourceError?.(error)
          throw error
        }
      }
      return o.processRowUpdate ? await o.processRowUpdate(next, old) : next
    }
    /** put edited rows where they live: the server cache, or the client-side pipeline */
    const commitRows = (rows: R[]) => {
      const ctrl = ctrlRef.current
      if (ctrl && optionsRef.current.dataSource) {
        ctrl.replaceRows(rows)
        // the server may have placed the row elsewhere: re-read what is in view, quietly
        if (optionsRef.current.dataSource.updateRow) ctrl.revalidate()
      } else pipelineRef.current!.patch({ update: rows })
      setPatchVersion((v) => v + 1)
    }
    const leafIdsOf = (id: RowId) => resultRef.current?.getLeafIds(id) ?? [id]
    const rowIdOf = (row: R) => (optionsRef.current.getRowId ?? identity)(row)
    const rectsNow = (): RangeRect[] => {
      const res = resultRef.current
      const layout = layoutRef.current
      const ranges = store.getState().cellSelection
      if (!res || !layout || !ranges.length) return []
      const colIndex = new Map(layout.all.map((c, i) => [c.field, i]))
      const out: RangeRect[] = []
      for (const range of ranges) {
        const rect = resolveRange(range, (id) => res.indexOf(id), (f) => colIndex.get(f) ?? -1)
        if (rect) out.push(rect)
      }
      return out
    }
    const pointAt = (row: number, col: number): CellPoint | null => {
      const r = resultRef.current?.rows[row]
      const c = layoutRef.current?.all[col]
      return r && c ? { rowId: r.id, field: c.field } : null
    }
    const canEdit = (rowId: RowId, field: string) => {
      const o = optionsRef.current
      const row = resultRef.current?.getRow(rowId)
      const col = o.columns.find((c) => c.field === field)
      if (row === undefined || !col || col.editable !== true) return false
      if (col.valueGetter && !col.valueSetter) return false
      return o.isCellEditable ? o.isCellEditable(row, field) : true
    }
    apiRef.current = {
      store,
      setSortModel: (sortModel) => set({ sortModel, paginationModel: reset(store) }),
      toggleSort(field, multi = false) {
        set((s) => {
          const current = s.sortModel.find((x) => x.field === field)
          const others = multi ? s.sortModel.filter((x) => x.field !== field) : []
          if (!current) return { sortModel: [...others, { field, direction: 'asc' }] }
          if (current.direction === 'asc') return { sortModel: [...others, { field, direction: 'desc' }] }
          return { sortModel: others }
        })
      },
      setFilterModel: (filterModel) => set({ filterModel, paginationModel: reset(store) }),
      setQuickFilter: (quickFilter) =>
        set((s) => ({ filterModel: { ...s.filterModel, quickFilter }, paginationModel: reset(store) })),
      setPage: (page) => set((s) => ({ paginationModel: { ...s.paginationModel, page } })),
      setPageSize: (pageSize) => set({ paginationModel: { page: 0, pageSize } }),
      pinColumn(field, side) {
        set((s) => {
          const left = s.pinnedColumns.left.filter((f) => f !== field)
          const right = s.pinnedColumns.right.filter((f) => f !== field)
          if (side === 'left') left.push(field)
          if (side === 'right') right.push(field)
          return { pinnedColumns: { left, right } }
        })
      },
      setColumnWidth: (field, width) => set((s) => ({ columnWidths: { ...s.columnWidths, [field]: width } })),
      setColumnVisibility: (field, visible) =>
        set((s) => ({ columnVisibility: { ...s.columnVisibility, [field]: visible } })),
      moveColumn(field, toIndex) {
        set((s) => {
          const order = s.columnOrder.filter((f) => f !== field)
          order.splice(Math.max(0, Math.min(toIndex, order.length)), 0, field)
          return { columnOrder: order }
        })
      },
      setAggregation(field, name) {
        set((s) => {
          const next = { ...s.aggregationModel }
          if (name) next[field] = name
          else delete next[field]
          return { aggregationModel: next }
        })
      },
      setAggregationModel: (aggregationModel) => set({ aggregationModel }),
      setPivotMode: (pivotMode) =>
        set({ pivotMode, expandedIds: [], expandAllByDefault: pivotMode ? true : false, paginationModel: reset(store) }),
      setPivotModel: (model) =>
        set((s) => ({
          pivotModel: typeof model === 'function' ? model(s.pivotModel) : model,
          expandedIds: [],
          paginationModel: reset(store),
        })),
      toggleDetailPanel(id, open) {
        set((s) => {
          const has = s.detailPanelExpanded.includes(id)
          const on = open ?? !has
          if (on === has) return {}
          return { detailPanelExpanded: on ? [...s.detailPanelExpanded, id] : s.detailPanelExpanded.filter((x) => x !== id) }
        })
      },
      setDetailPanelExpanded: (detailPanelExpanded) => set({ detailPanelExpanded }),
      setDetailPanelHeight(id, height) {
        set((s) => (Math.abs((s.detailHeights[id] ?? -1) - height) < 1 ? {} : { detailHeights: { ...s.detailHeights, [id]: height } }))
      },
      canMoveRow: (id, to) => resolveMove(id, to) !== null,
      moveRow(id, to) {
        const move = resolveMove(id, to)
        if (!move) return false
        pipelineRef.current!.patch({ move: [{ id, before: move.beforeId }] })
        setPatchVersion((v) => v + 1)
        optionsRef.current.onRowOrderChange?.({ rowId: id, row: move.row, oldIndex: move.from, targetIndex: move.targetIndex })
        return true
      },
      pinRow(id, side) {
        set((s) => {
          const top = s.pinnedRows.top.filter((x) => x !== id)
          const bottom = s.pinnedRows.bottom.filter((x) => x !== id)
          if (side === 'top') top.push(id)
          if (side === 'bottom') bottom.push(id)
          return { pinnedRows: { top, bottom } }
        })
      },
      reorderColumn(field, target, placement) {
        const layout = layoutRef.current
        if (!layout) return false
        const s = store.getState()
        const change = planColumnMove(optionsRef.current.columns, s, layout, field, target, placement)
        if (!change) return false
        set(change)
        return true
      },
      moveColumnBy(field, delta) {
        const layout = layoutRef.current
        const n = layout && neighborInGroup(layout, field, delta)
        return n ? apiRef.current!.reorderColumn(field, n.target, n.placement) : false
      },
      setRowGroupingModel: (rowGroupingModel) =>
        set({ rowGroupingModel, expandedIds: [], paginationModel: reset(store) }),
      toggleExpanded: (id) =>
        set((s) => ({
          expandedIds: s.expandedIds.includes(id) ? s.expandedIds.filter((x) => x !== id) : [...s.expandedIds, id],
        })),
      expandAll: () => set({ expandAllByDefault: true, expandedIds: [] }),
      collapseAll: () => set({ expandAllByDefault: false, expandedIds: [] }),
      toggleSelection(id, selected) {
        const ids = leafIdsOf(id)
        set((s) => {
          const current = new Set(s.selection)
          const all = ids.every((x) => current.has(x))
          const on = selected ?? !all
          for (const x of ids) on ? current.add(x) : current.delete(x)
          return { selection: [...current] }
        })
      },
      clearSelection: () => set({ selection: [] }),
      setScroll: (top, left) => set({ scroll: { top, left } }),
      setViewport: (width, height) => set({ viewport: { width, height } }),
      focusCell(cell) {
        set((s) => {
          const editing = s.editingCell
          const keepEdit = editing && cell && editing.rowId === cell.rowId && editing.field === cell.field
          return { focusedCell: cell, editingCell: keepEdit ? editing : null }
        })
      },
      selectCells: (range, opts) =>
        set((s) => ({ cellSelection: opts?.add ? [...s.cellSelection, range] : [range] })),
      extendCellSelection: (focus) =>
        set((s) => {
          const list = s.cellSelection
          const last = list[list.length - 1]
          if (last) return { cellSelection: [...list.slice(0, -1), { anchor: last.anchor, focus }] }
          const f = s.focusedCell
          return f ? { cellSelection: [{ anchor: { rowId: f.rowId, field: f.field }, focus }] } : {}
        }),
      clearCellSelection: () => set({ cellSelection: [] }),
      getCellRects: () => rectsNow(),
      copySelection() {
        const res = resultRef.current
        const layout = layoutRef.current
        if (!res || !layout) return ''
        const cols = layout.all
        const rects = rectsNow()
        const last = rects[rects.length - 1]
        const matrix: string[][] = []
        if (last) {
          for (let r = last.r0; r <= last.r1; r++) {
            const row = res.rows[r]?.row
            if (row === undefined) continue // group rows have no values
            matrix.push(cols.slice(last.c0, last.c1 + 1).map((c) => cellToText(c, row)))
          }
        } else {
          const s = store.getState()
          if (s.selection.length) {
            const chosen = new Set(s.selection)
            for (const row of res.getVisibleDataRows()) if (chosen.has(rowIdOf(row))) matrix.push(cols.map((c) => cellToText(c, row)))
          } else if (s.focusedCell) {
            const row = res.getRow(s.focusedCell.rowId)
            const col = cols.find((c) => c.field === s.focusedCell!.field)
            if (row !== undefined && col) matrix.push([cellToText(col, row)])
          }
        }
        return toTsv(matrix)
      },
      async applyCellValues(changes) {
        const res = resultRef.current
        const o = optionsRef.current
        const out: ApplyResult = { applied: 0, skipped: 0, rejected: 0 }
        if (!res) return out
        const byRow = new Map<RowId, { field: string; value: unknown }[]>()
        for (const ch of changes) {
          if (!canEdit(ch.rowId, ch.field)) {
            out.skipped++
            continue
          }
          const list = byRow.get(ch.rowId)
          if (list) list.push(ch)
          else byRow.set(ch.rowId, [ch])
        }
        const updated: R[] = []
        await Promise.all(
          [...byRow].map(async ([rowId, list]) => {
            const old = res.getRow(rowId) as R
            let next: R = old
            for (const { field, value } of list) {
              const col = o.columns.find((c) => c.field === field)!
              next = col.valueSetter ? col.valueSetter(value, next) : ({ ...next, [field]: value } as R)
            }
            const same =
              next === old || Object.keys(next as object).every((k) => Object.is((next as any)[k], (old as any)[k]))
            if (same) {
              out.skipped += list.length
              return
            }
            try {
              updated.push(await persist(next, old, rowId))
              out.applied += list.length
            } catch (error) {
              out.rejected += list.length
              if (!(error instanceof DataSourceError)) o.onProcessRowUpdateError?.(error)
            }
          }),
        )
        if (updated.length) commitRows(updated)
        return out
      },
      async pasteText(text) {
        const res = resultRef.current
        const layout = layoutRef.current
        const empty: ApplyResult = { applied: 0, skipped: 0, rejected: 0 }
        const matrix = parseTsv(text)
        if (!res || !layout || !matrix.length) return empty
        const cols = layout.all
        const rects = rectsNow()
        const active = rects[rects.length - 1]
        let origin: { r: number; c: number } | null = active ? { r: active.r0, c: active.c0 } : null
        if (!origin) {
          const f = store.getState().focusedCell
          const r = f ? res.indexOf(f.rowId) : -1
          const c = f ? cols.findIndex((x) => x.field === f.field) : -1
          if (r < 0 || c < 0) return empty
          origin = { r, c }
        }
        // one value pasted over a bigger selection fills all of it, like a spreadsheet
        const single = matrix.length === 1 && matrix[0]!.length === 1
        const width = Math.max(...matrix.map((m) => m.length))
        const area: RangeRect =
          single && active
            ? active
            : { r0: origin.r, r1: origin.r + matrix.length - 1, c0: origin.c, c1: origin.c + width - 1 }
        const changes: { rowId: RowId; field: string; value: unknown }[] = []
        let invalid = 0
        for (let r = area.r0; r <= area.r1 && r < res.rows.length; r++) {
          const row = res.rows[r]?.row
          if (row === undefined) continue
          for (let c = area.c0; c <= area.c1 && c < cols.length; c++) {
            const cell = single ? matrix[0]![0] : matrix[r - area.r0]?.[c - area.c0]
            if (cell === undefined) continue
            const parsed = parseCellText(cols[c]!, cell, row)
            if (!parsed.ok) invalid++
            else changes.push({ rowId: res.rows[r]!.id, field: cols[c]!.field, value: parsed.value })
          }
        }
        const done = await apiRef.current!.applyCellValues(changes)
        done.skipped += invalid
        const a = pointAt(area.r0, area.c0)
        const b = pointAt(Math.min(area.r1, res.rows.length - 1), Math.min(area.c1, cols.length - 1))
        if (a && b) set({ cellSelection: [{ anchor: a, focus: b }] })
        return done
      },
      async clearSelectedCells() {
        const res = resultRef.current
        const layout = layoutRef.current
        if (!res || !layout) return { applied: 0, skipped: 0, rejected: 0 }
        const changes: { rowId: RowId; field: string; value: unknown }[] = []
        let rects = rectsNow()
        if (!rects.length) {
          const f = store.getState().focusedCell
          const r = f ? res.indexOf(f.rowId) : -1
          const c = f ? layout.all.findIndex((x) => x.field === f.field) : -1
          if (r >= 0 && c >= 0) rects = [{ r0: r, r1: r, c0: c, c1: c }]
        }
        for (const rect of rects) {
          for (let r = rect.r0; r <= rect.r1; r++) {
            if (res.rows[r]?.row === undefined) continue
            for (let c = rect.c0; c <= rect.c1; c++) {
              const col = layout.all[c]!
              changes.push({ rowId: res.rows[r]!.id, field: col.field, value: emptyValueFor(col) })
            }
          }
        }
        return apiRef.current!.applyCellValues(changes)
      },
      async fillCells(source, to) {
        const res = resultRef.current
        const layout = layoutRef.current
        const none: ApplyResult = { applied: 0, skipped: 0, rejected: 0 }
        if (!res || !layout) return none
        const target = fillTarget(source, to.row, to.col)
        if (!target) return none
        const cols = layout.all
        const changes: { rowId: RowId; field: string; value: unknown }[] = []
        for (let r = target.r0; r <= target.r1; r++) {
          const dest = res.rows[r]
          if (dest?.row === undefined) continue
          for (let c = target.c0; c <= target.c1; c++) {
            const from = fillSourceOf(source, r, c)
            const srcRow = res.rows[from.row]?.row
            const srcCol = cols[from.col]
            const dstCol = cols[c]
            if (srcRow === undefined || !srcCol || !dstCol) continue
            changes.push({ rowId: dest.id, field: dstCol.field, value: getCellValue(srcCol, srcRow) })
          }
        }
        const done = await apiRef.current!.applyCellValues(changes)
        const a = pointAt(Math.min(source.r0, target.r0), Math.min(source.c0, target.c0))
        const b = pointAt(Math.max(source.r1, target.r1), Math.max(source.c1, target.c1))
        if (a && b) set({ cellSelection: [{ anchor: a, focus: b }] })
        return done
      },
      isCellEditable: canEdit,
      startEdit(rowId, field, seed) {
        if (!canEdit(rowId, field)) return false
        set({ editingCell: { rowId, field, seed }, focusedCell: { rowId, field } })
        return true
      },
      cancelEdit: () => set({ editingCell: null }),
      async commitEdit(value) {
        const cell = store.getState().editingCell
        const o = optionsRef.current
        const oldRow = cell ? resultRef.current?.getRow(cell.rowId) : undefined
        const col = cell ? o.columns.find((c) => c.field === cell.field) : undefined
        if (!cell || oldRow === undefined || !col) {
          set({ editingCell: null })
          return false
        }
        const newRow = col.valueSetter
          ? col.valueSetter(value, oldRow)
          : ({ ...oldRow, [col.field]: value } as R)
        const unchanged =
          newRow === oldRow ||
          Object.keys(newRow as object).every((k) => Object.is((newRow as any)[k], (oldRow as any)[k]))
        if (unchanged) {
          set({ editingCell: null })
          return true
        }
        try {
          const kept = await persist(newRow, oldRow, cell.rowId)
          commitRows([kept])
          const now = store.getState().editingCell
          if (now && now.rowId === cell.rowId && now.field === cell.field) set({ editingCell: null })
          return true
        } catch (error) {
          if (!(error instanceof DataSourceError)) o.onProcessRowUpdateError?.(error)
          return false
        }
      },
      updateRows(changes) {
        if (optionsRef.current.dataSource) {
          // the server owns which rows exist: only replacing rows that are loaded makes sense
          ctrlRef.current?.replaceRows([...(changes.update ?? []), ...(changes.insert ?? [])])
          setPatchVersion((v) => v + 1)
          return
        }
        pipelineRef.current!.patch(changes)
        setPatchVersion((v) => v + 1)
      },
      refreshData: () => ctrlRef.current?.refresh(),
      getDataSourceState: () => (optionsRef.current.dataSource ? (ctrlRef.current?.snapshot() ?? null) : null),
      async getXlsx(options = {}) {
        const result = resultRef.current
        const layout = layoutRef.current
        if (!result || !layout) throw new Error('The grid is not ready')
        const o = optionsRef.current
        const sheet = sheetOfGrid({
          columns: layout.all,
          rows: result.getExportRows(),
          totals: o.aggregationFooter === false ? undefined : result.getTotals(),
          widthOf: layout.width,
          selection: options.selectedOnly ? new Set(store.getState().selection) : undefined,
          options,
        })
        return buildXlsx(sheet, options)
      },
      async exportXlsx(options = {}) {
        const bytes = await apiRef.current!.getXlsx(options)
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: XLSX_MIME }))
        const a = document.createElement('a')
        a.href = url
        a.download = options.fileName ?? 'export.xlsx'
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 0)
      },
      getCsv(options) {
        const result = resultRef.current
        const layout = layoutRef.current
        if (!result || !layout) return ''
        if (layout.all.some((c) => c.field === PIVOT_ROWS_FIELD)) {
          // a pivot table exports what it shows: group rows with their aggregates (numbers, not text)
          const cols: ColumnDef<{ label: string; values: Record<string, unknown> }>[] = layout.all.map((c) => ({
            field: c.field,
            headerName: [...(c.group ?? []), c.headerName ?? c.field].join(' / '),
            type: c.field === PIVOT_ROWS_FIELD ? 'string' : 'number',
            valueGetter: (r) => (c.field === PIVOT_ROWS_FIELD ? r.label : r.values[c.field]),
          }))
          const body = result.rows
            .filter((r) => r.type === 'group')
            .map((r) => ({ label: r.groupValue == null || r.groupValue === '' ? '(empty)' : String(r.groupValue), values: r.aggregates ?? {} }))
          return toCsv(cols, body, options)
        }
        let rows = result.getVisibleDataRows()
        const pinned = store.getState().pinnedRows
        const pinnedIdsNow = [...pinned.top, ...pinned.bottom]
        if (pinnedIdsNow.length && pinningActiveRef.current) {
          // same order the user sees: pinned-top rows, the scrolling rows, pinned-bottom rows
          const hidden = new Set(pinnedIdsNow)
          const pick = (ids: RowId[]) => ids.map((id) => result.getRow(id)).filter((r): r is R => r !== undefined)
          rows = [...pick(pinned.top), ...rows.filter((r) => !hidden.has(rowIdOf(r))), ...pick(pinned.bottom)]
        }
        if (options?.selectedOnly) {
          const chosen = new Set(store.getState().selection)
          rows = rows.filter((r) => chosen.has(rowIdOf(r)))
        }
        return toCsv(layout.all, rows, options)
      },
    }
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

  // ---- server-side data: a controller owns the rows, the pipeline stays idle
  const paged = hasPagination
  const pageSize = effective.paginationModel.pageSize
  const chunkSize = options.dataSourceChunkSize ?? (paged ? pageSize : 100)
  if (hasDataSource && !ctrlRef.current) {
    // constructing one starts nothing: requests begin when the effect below calls resume()
    ctrlRef.current = new DataSourceController<R>({
      getSource: () => optionsRef.current.dataSource,
      getRowId: (row) => (optionsRef.current.getRowId ?? identity)(row),
      chunkSize,
      cache: options.dataSourceCache,
      maxConcurrent: options.dataSourceMaxConcurrent,
      revalidateMs: options.dataSourceRevalidateMs,
      keepPreviousData: options.dataSourceKeepPreviousData,
      settleMs: paged ? 0 : 60,
      prefetchChunks: options.dataSourcePrefetchChunks ?? (paged ? 0 : 1),
      onError: (error) => optionsRef.current.onDataSourceError?.(error),
    })
  }
  const ctrl = hasDataSource ? ctrlRef.current : undefined
  const noSubscribe = useCallback(() => () => {}, [])
  const dsVersion = useSyncExternalStore(
    ctrl ? ctrl.subscribe : noSubscribe,
    ctrl ? ctrl.getVersion : () => 0,
    // the server renders the same snapshot: nothing has been requested there
    ctrl ? ctrl.getVersion : () => 0,
  )

  useIsomorphicLayoutEffect(() => {
    ctrl?.resume()
    return () => ctrl?.destroy()
  }, [ctrl])
  useIsomorphicLayoutEffect(() => {
    if (!ctrl) return
    ctrl.configure({
      chunkSize,
      maxConcurrent: options.dataSourceMaxConcurrent ?? 4,
      revalidateMs: options.dataSourceRevalidateMs,
      keepPreviousData: options.dataSourceKeepPreviousData,
      settleMs: paged ? 0 : 60,
      prefetchChunks: options.dataSourcePrefetchChunks ?? (paged ? 0 : 1),
    })
    ctrl.setQuery(effective.sortModel, effective.filterModel)
  }, [ctrl, chunkSize, paged, options.dataSourcePrefetchChunks, options.dataSourceMaxConcurrent, options.dataSourceRevalidateMs, options.dataSourceKeepPreviousData, effective.sortModel, effective.filterModel])

  const serverResult = useMemo(
    () =>
      ctrl
        ? buildServerResult(ctrl, stableGetRowId, {
            mode: paged ? 'pages' : 'lazy',
            page: effective.paginationModel.page,
            pageSize,
            detailIds,
          })
        : null,
    // dsVersion is the cue that the controller's blocks changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctrl, dsVersion, paged, effective.paginationModel.page, pageSize, detailIds],
  )

  // columns the pipeline knows: the real ones, plus (for the pivot panel) what is derived from them
  const sourceColumns = useMemo(
    () => (options.pivoting ? withDerivedColumns(options.columns, options.pivotDerivedColumns) : options.columns),
    [options.pivoting, options.columns, options.pivotDerivedColumns],
  )
  const pivotInput = useMemo(
    () => (pivotActive ? pivotInputOf(effective.pivotModel, !!options.pivotTotals) : undefined),
    [pivotActive, effective.pivotModel, options.pivotTotals],
  )
  const pipelineSort = useMemo(
    () => (pivotActive ? pivotSortOf(effective.sortModel, effective.pivotModel.rows) : effective.sortModel),
    [pivotActive, effective.sortModel, effective.pivotModel.rows],
  )

  const result: PipelineResult<R> = serverResult ?? pipelineRef.current({
    rows: options.rows ?? EMPTY_ROWS,
    columns: sourceColumns,
    getRowId: stableGetRowId,
    getTreeDataPath: options.getTreeDataPath ? stableTreePath : undefined,
    sortModel: pipelineSort,
    filterModel: effective.filterModel,
    rowGroupingModel: effective.rowGroupingModel,
    expandedIds: expandedSet,
    expandAllByDefault: effective.expandAllByDefault,
    pagination: hasPagination ? effective.paginationModel : undefined,
    hiddenIds: pinnedIds,
    detailIds,
    aggregationModel: effective.aggregationModel,
    aggregationFunctions: options.aggregationFunctions,
    pivot: pivotInput,
  })
  resultRef.current = result

  // pivot mode swaps the columns for generated ones: a row-label column and one column per distinct column value
  const layoutColumns = useMemo(
    () => (pivotActive ? buildPivotColumns(result.pivotColumns, sourceColumns, effective.pivotModel, options.pivotColumnDef) : options.columns),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pivotActive, result.pivotColumns, sourceColumns, effective.pivotModel, options.columns],
  )
  const pivotInfo = useMemo<PivotInfo | null>(() => {
    if (!pivotActive) return null
    const aggNames: Record<string, string> = {}
    for (const c of result.pivotColumns) aggNames[c.field] = c.aggFunc
    return { columns: result.pivotColumns, aggNames, sourceColumns }
  }, [pivotActive, result.pivotColumns, sourceColumns])

  const layout = useMemo(
    () =>
      computeColumnLayout(layoutColumns, {
        columnOrder: effective.columnOrder,
        columnWidths: effective.columnWidths,
        columnVisibility: effective.columnVisibility,
        // the group labels stay in view while the pivot columns scroll
        pinnedColumns: pivotActive ? { ...effective.pinnedColumns, left: [PIVOT_ROWS_FIELD, ...effective.pinnedColumns.left] } : effective.pinnedColumns,
      }),
    [layoutColumns, pivotActive, effective.columnOrder, effective.columnWidths, effective.columnVisibility, effective.pinnedColumns],
  )

  layoutRef.current = layout

  const rowHeight = options.rowHeight ?? DEFAULT_ROW_HEIGHT
  const headerRowHeight = options.headerHeight ?? DEFAULT_HEADER_HEIGHT
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
  const geometry = useMemo(
    () => createRowGeometry(rowHeight, result.rows.length, detailSlots as DetailSlot[]),
    [rowHeight, result.rows.length, detailSlots],
  )

  // Only the *window* is a render dependency: scrolling inside a window costs nothing.
  const [rowRange, colRange, detailRange] = useStore(
    store,
    (s): [Range, Range, Range] => {
      const buffer = options.rowBufferPx ?? rowHeight * 8
      const visible = s.viewport.height - headerHeight - pinnedHeight
      const w = geometry.window(s.scroll.top - buffer, s.scroll.top + visible + buffer)
      return [
        { start: w.start, end: w.end },
        computeColumnRange(layout, s.scroll.left, s.viewport.width, options.columnBufferPx ?? 200),
        { start: w.slotStart, end: w.slotEnd },
      ]
    },
    rangesStable,
  )

  const reorderAllowed =
    !!options.rowReordering &&
    !hasDataSource &&
    !options.getTreeDataPath &&
    !pivotActive &&
    effective.rowGroupingModel.length === 0 &&
    effective.sortModel.length === 0 &&
    effective.editingCell === null

  // tell the controller which rows are wanted: the page, or the window of rows near the viewport
  useEffect(() => {
    if (!ctrl) return
    if (paged) ctrl.setView(effective.paginationModel.page * pageSize, effective.paginationModel.page * pageSize + pageSize - 1, true)
    else ctrl.setView(rowRange.start, Math.max(rowRange.start, rowRange.end - 1))
  }, [ctrl, paged, effective.paginationModel.page, pageSize, rowRange.start, rowRange.end])

  const server = useMemo<ServerInfo | null>(() => {
    if (!ctrl) return null
    const snap = ctrl.snapshot()
    return { mode: paged ? 'pages' : 'lazy', rowCount: snap.rowCount, hasNextPage: snap.hasNextPage, loading: snap.loading, error: snap.error, loadedEnd: snap.loadedEnd }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrl, dsVersion, paged])

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

  return { api, options, rowHeight, headerHeight, headerRowHeight, headerDepth, pivot: pivotInfo, layout, result, rows: result.rows, rowRange, colRange, geometry, detailSlots, detailRange, reorderAllowed, server, footer, pinnedTop, pinnedBottom, state: effective, isSelected }
}

function reset(store: Store<GridState>): PaginationModel {
  return { ...store.getState().paginationModel, page: 0 }
}

export type { ColumnDef }
