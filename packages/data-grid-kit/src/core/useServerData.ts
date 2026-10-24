import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type MutableRefObject } from 'react'
import { useIsomorphicLayoutEffect } from './isomorphic'
import { identity } from './api/context'
import type { ServerInfo } from './gridTypes'
import { DataSourceController, type DataSourceError } from './dataSource'
import type { Range } from './layout'
import type { PipelineResult } from './pipeline'
import { buildServerResult } from './serverResult'
import { ServerTree } from './serverTree'
import { buildTreeResult } from './serverTreeResult'
import type { GridOptions, GridState, RowId } from './types'

/** What `useServerData` needs from the grid that owns it. */
export interface ServerDataInput<R> {
  options: GridOptions<R>
  optionsRef: MutableRefObject<GridOptions<R>>
  effective: GridState
  expandedSet: ReadonlySet<RowId>
  detailIds: ReadonlySet<RowId> | undefined
  stableGetRowId: (row: R) => RowId
  hasDataSource: boolean
  paged: boolean
  /** shared with the API object, which reaches the controllers for `updateRows` and `refreshData` */
  ctrlRef: MutableRefObject<DataSourceController<R> | undefined>
  treeRef: MutableRefObject<ServerTree<R> | undefined>
}

/**
 * Server-side data: the controller (or the tree of controllers) that owns the rows, kept in sync with the sorting, the filters,
 * the grouping and the expansion, and the pipeline result it makes. `serverResult` is null for client-side data.
 */
export function useServerData<R>(input: ServerDataInput<R>) {
  const { options, optionsRef, effective, expandedSet, detailIds, stableGetRowId, hasDataSource, paged, ctrlRef, treeRef } = input
  const pageSize = effective.paginationModel.pageSize
  // ---- server-side data: a controller owns the rows, the pipeline stays idle
  const chunkSize = options.dataSourceChunkSize ?? (paged ? pageSize : 100)
  // tree data / row grouping on the server: the source says how many children a row has. Loading by level needs
  // the rows to be one scrolling list, so it is for `pagination={false}`.
  const treeMode = hasDataSource && !paged && !!options.dataSource?.getChildrenCount && !!options.dataSource?.getGroupKey
  const expandedRef = useRef({ set: expandedSet, all: effective.expandAllByDefault })
  expandedRef.current = { set: expandedSet, all: effective.expandAllByDefault }
  const isExpanded = useCallback((id: RowId) => (expandedRef.current.all ? !expandedRef.current.set.has(id) : expandedRef.current.set.has(id)), [])
  if (hasDataSource && !ctrlRef.current) {
    // constructing one starts nothing: requests begin when the effect below calls resume()
    const ctrlOptions = {
      getSource: () => optionsRef.current.dataSource,
      getRowId: (row: R) => (optionsRef.current.getRowId ?? identity)(row),
      chunkSize,
      cache: options.dataSourceCache,
      maxConcurrent: options.dataSourceMaxConcurrent,
      revalidateMs: options.dataSourceRevalidateMs,
      keepPreviousData: options.dataSourceKeepPreviousData,
      settleMs: paged ? 0 : 60,
      prefetchChunks: options.dataSourcePrefetchChunks ?? (paged ? 0 : 1),
      onError: (error: DataSourceError) => optionsRef.current.onDataSourceError?.(error),
    }
    if (treeMode) {
      treeRef.current = new ServerTree<R>({ ...ctrlOptions, isExpanded })
      ctrlRef.current = treeRef.current.root.ctrl
    } else ctrlRef.current = new DataSourceController<R>(ctrlOptions)
  }
  const ctrl = hasDataSource ? ctrlRef.current : undefined
  const tree = hasDataSource ? treeRef.current : undefined
  const live = tree ?? ctrl // what loads the rows: the tree of levels, or the one controller
  const noSubscribe = useCallback(() => () => {}, [])
  const dsVersion = useSyncExternalStore(
    live ? live.subscribe : noSubscribe,
    live ? live.getVersion : () => 0,
    // the server renders the same snapshot: nothing has been requested there
    live ? live.getVersion : () => 0,
  )

  useIsomorphicLayoutEffect(() => {
    live?.resume()
    return () => live?.destroy()
  }, [live])
  // open the levels of the rows that are expanded (and close the others) whenever rows arrive or the expansion changes
  useIsomorphicLayoutEffect(() => {
    tree?.sync()
  }, [tree, dsVersion, expandedSet, effective.expandAllByDefault])
  const grouping = useMemo(
    () => (tree ? { groupFields: effective.rowGroupingModel.length ? effective.rowGroupingModel : undefined, aggregationModel: Object.keys(effective.aggregationModel).length ? effective.aggregationModel : undefined } : undefined),
    [tree, effective.rowGroupingModel, effective.aggregationModel],
  )
  useIsomorphicLayoutEffect(() => {
    if (!live) return
    live.configure({
      chunkSize,
      maxConcurrent: options.dataSourceMaxConcurrent ?? 4,
      revalidateMs: options.dataSourceRevalidateMs,
      keepPreviousData: options.dataSourceKeepPreviousData,
      settleMs: paged ? 0 : 60,
      prefetchChunks: options.dataSourcePrefetchChunks ?? (paged ? 0 : 1),
    })
    if (tree) tree.setQuery(effective.sortModel, effective.filterModel, grouping)
    else ctrl!.setQuery(effective.sortModel, effective.filterModel)
  }, [live, tree, ctrl, grouping, chunkSize, paged, options.dataSourcePrefetchChunks, options.dataSourceMaxConcurrent, options.dataSourceRevalidateMs, options.dataSourceKeepPreviousData, effective.sortModel, effective.filterModel])

  const serverResult = useMemo(
    () =>
      tree
        ? buildTreeResult(tree, { getRowId: stableGetRowId, isExpanded, groupFields: effective.rowGroupingModel, aggregationModel: effective.aggregationModel })
        : ctrl
        ? buildServerResult(ctrl, stableGetRowId, {
            mode: paged ? 'pages' : 'lazy',
            page: effective.paginationModel.page,
            pageSize,
            detailIds,
          })
        : null,
    // dsVersion is the cue that the controller's blocks changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctrl, tree, dsVersion, paged, effective.paginationModel.page, pageSize, detailIds, expandedSet, effective.expandAllByDefault, effective.rowGroupingModel, effective.aggregationModel],
  )

  return { ctrl, tree, live, dsVersion, serverResult, pageSize }
}

/** tell the controller which rows are wanted: the page, or the window of rows near the viewport */
export function useServerView<R>(server: ReturnType<typeof useServerData<R>>, paged: boolean, page: number, rowRange: Range) {
  const { ctrl, tree, dsVersion, pageSize } = server
  useEffect(() => {
    if (!ctrl) return
    if (tree) tree.setView(rowRange.start, Math.max(rowRange.start, rowRange.end - 1))
    else if (paged) ctrl.setView(page * pageSize, page * pageSize + pageSize - 1, true)
    else ctrl.setView(rowRange.start, Math.max(rowRange.start, rowRange.end - 1))
    // the levels that are open decide which rows are at which position, so a new layout asks again
  }, [ctrl, tree, dsVersion, paged, page, pageSize, rowRange.start, rowRange.end])
}

/** the state of the data source as the UI shows it (loading, error, row count), or null for client-side data */
export function useServerInfo<R>(server: ReturnType<typeof useServerData<R>>, paged: boolean): ServerInfo | null {
  const { live, tree, dsVersion } = server
  return useMemo<ServerInfo | null>(() => {
    if (!live) return null
    const snap = live.snapshot()
    return { tree: !!tree, mode: paged ? 'pages' : 'lazy', rowCount: snap.rowCount, hasNextPage: snap.hasNextPage, loading: snap.loading, error: snap.error, loadedEnd: snap.loadedEnd }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, tree, dsVersion, paged])
}
