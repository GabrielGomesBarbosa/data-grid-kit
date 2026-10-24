import { neighborInGroup, planColumnMove } from '../reorder'
import { reset, type ApiContext } from './context'
import type { GridApi } from '../gridTypes'

const DEFAULT_SORTING_ORDER: ('asc' | 'desc' | null)[] = ['asc', 'desc', null]

export function viewApi<R>(c: ApiContext<R>): Pick<GridApi<R>, 'setSortModel' | 'toggleSort' | 'setFilterModel' | 'setQuickFilter' | 'setPage' | 'setPageSize' | 'pinColumn' | 'setColumnWidth' | 'setDensity' | 'setColumnVisibility' | 'setColumnVisibilityModel' | 'moveColumn' | 'reorderColumn' | 'moveColumnBy' | 'setRowGroupingModel' | 'toggleExpanded' | 'expandAll' | 'collapseAll' | 'setAggregation' | 'setAggregationModel' | 'setPivotMode' | 'setPivotModel' | 'setScroll' | 'setViewport'> {
  const { set, store, layoutRef, optionsRef, apiRef } = c
  return {
    setSortModel: (sortModel) => set({ sortModel, paginationModel: reset(store) }),
    toggleSort(field, multi = false) {
      const o = optionsRef.current
      const order = o.columns.find((col) => col.field === field)?.sortingOrder ?? o.sortingOrder ?? DEFAULT_SORTING_ORDER
      set((s) => {
        const current = s.sortModel.find((x) => x.field === field)
        const others = multi || o.multipleColumnsSortingMode === 'always' ? s.sortModel.filter((x) => x.field !== field) : []
        // the next step after where this column is now (a column whose state is not in the order starts at its first step)
        const at = order.indexOf(current?.direction ?? null)
        const next = order.length === 0 ? null : order[(at + 1) % order.length]!
        return { sortModel: next === null ? others : [...others, { field, direction: next }] }
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
    setDensity: (density) => set({ density }),
    setColumnWidth: (field, width) => set((s) => ({ columnWidths: { ...s.columnWidths, [field]: width } })),
    setColumnVisibility: (field, visible) =>
      set((s) => ({ columnVisibility: { ...s.columnVisibility, [field]: visible } })),
    setColumnVisibilityModel: (model) => set({ columnVisibility: { ...model } }),
    moveColumn(field, toIndex) {
      const oldIndex = store.getState().columnOrder.indexOf(field)
      set((s) => {
        const order = s.columnOrder.filter((f) => f !== field)
        order.splice(Math.max(0, Math.min(toIndex, order.length)), 0, field)
        return { columnOrder: order }
      })
      const targetIndex = store.getState().columnOrder.indexOf(field)
      if (oldIndex !== targetIndex) optionsRef.current.onColumnOrderChange?.({ field, oldIndex, targetIndex })
    },
    reorderColumn(field, target, placement) {
      const layout = layoutRef.current
      if (!layout) return false
      const s = store.getState()
      const change = planColumnMove(optionsRef.current.columns, s, layout, field, target, placement)
      if (!change) return false
      set(change)
      const after = store.getState().columnOrder
      const oldIndex = s.columnOrder.indexOf(field)
      const targetIndex = after.indexOf(field)
      if (oldIndex !== targetIndex) optionsRef.current.onColumnOrderChange?.({ field, oldIndex, targetIndex })
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
    setScroll: (top, left) => set({ scroll: { top, left } }),
    setViewport: (width, height) => set({ viewport: { width, height } }),
  }
}
