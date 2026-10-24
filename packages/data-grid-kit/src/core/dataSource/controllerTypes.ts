import type { RowId } from '../types'
import type { DataSource, DataSourceError } from './contract'
import type { DataSourceCache } from './cache'

/** what the server groups and aggregates by (tree data and row grouping on the server) */
export interface Grouping {
  groupFields?: string[]
  aggregationModel?: Record<string, string>
}

export interface DataSourceControllerOptions<R> {
  /** read on every request, so a new `dataSource` prop takes effect without recreating the controller */
  getSource: () => DataSource<R> | undefined
  getRowId: (row: R) => RowId
  /** rows per block: the unit of fetching, caching and loading. Default 100. */
  chunkSize?: number
  /** `null` = no cache */
  cache?: DataSourceCache<R> | null
  /** requests in flight at once (default 4) */
  maxConcurrent?: number
  /** consecutive blocks fetched with a single request, at most (default 4) */
  maxRunChunks?: number
  /** wait this long after the visible range stops moving before asking for blocks (default 60 ms; 0 for pages) */
  settleMs?: number
  /** a failed block is retried when it comes into view again after this long (default 3 s) */
  retryAfterMs?: number
  /** blocks fetched beyond the visible ones, each side (default 1) */
  prefetchChunks?: number
  /** blocks kept in memory; the farthest from the view are dropped (they stay in the cache). Default 400. */
  maxLoadedChunks?: number
  /** keep showing the old rows (instead of skeletons) while a new sort / filter loads */
  keepPreviousData?: boolean
  /** re-read the visible rows this often, in the background (0 / undefined = off) */
  revalidateMs?: number
  /** tree data: the keys of the path to the parent whose children this controller loads (`[]` for the top level) */
  groupKeys?: string[]
  onError?: (error: DataSourceError) => void
  now?: () => number
}

export interface DataSourceSnapshot {
  /** rows in the data set, or -1 when the server hasn't said */
  rowCount: number
  hasNextPage: boolean
  /** a request for rows that are in view (or about to be) is waiting or running */
  loading: boolean
  error: DataSourceError | null
  chunkSize: number
  /** bumps on every change that can alter what is shown */
  version: number
  /** one past the last loaded row position */
  loadedEnd: number
}
