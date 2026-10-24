import type { FilterModel, RowId, SortItem } from '../types'

/** What the grid asks the server for. `start` and `end` are row positions, both inclusive. */
export interface GetRowsParams {
  start: number
  end: number
  sortModel: SortItem[]
  filterModel: FilterModel
  /**
   * Cursor-paginated APIs: the `pageInfo.nextCursor` the server sent with the rows just before `start`
   * (`undefined` for the first rows). The grid keeps the cursors; the app never has to.
   */
  cursor?: unknown
  /**
   * Tree data and row grouping on the server (the source has `getChildrenCount`): the keys (`getGroupKey`) of the path
   * to the rows' parent. `[]` asks for the top level.
   */
  groupKeys?: string[]
  /** the row grouping model, outermost first, when rows are grouped (a request at depth `n` is for `groupFields[n]`'s groups, or the leaves) */
  groupFields?: string[]
  /** field → aggregation function, for the group rows' values (`getAggregatedValue`) */
  aggregationModel?: Record<string, string>
  /** aborted when the answer is no longer wanted (the sort / filter changed, or a refresh). Pass it to `fetch`. */
  signal: AbortSignal
}

export interface PageInfo {
  /** `false` marks the end when `rowCount` is unknown */
  hasNextPage?: boolean
  /**
   * For APIs that continue from a cursor instead of an offset: where to continue after the *last* row of this response,
   * sent back as `cursor` with the request for the following rows. `null` means this was the last page. The grid then
   * fetches blocks in order, so jumping ahead loads the pages in between (each one is cached).
   */
  nextCursor?: unknown
}

export interface GetRowsResponse<R> {
  rows: R[]
  /** total rows for this sort + filter. Omit it, or send -1, when the server doesn't know (infinite scrolling). */
  rowCount?: number
  pageInfo?: PageInfo
}

export interface UpdateRowParams<R> {
  rowId: RowId
  updatedRow: R
  previousRow: R
}

export interface DataSource<R = any> {
  getRows(params: GetRowsParams): Promise<GetRowsResponse<R>>
  /**
   * With `getChildrenCount`, rows form a tree and are loaded level by level: `getRows` is called with the `groupKeys` of a
   * parent when it is expanded. The key of a row among its siblings (unique within the parent).
   */
  getGroupKey?(row: R): string
  /** how many children a row has: 0 for a leaf, -1 when it has some and the count is not known */
  getChildrenCount?(row: R): number
  /** the aggregated value of `field` shown on a group row (`aggregationModel` says which function) */
  getAggregatedValue?(row: R, field: string): unknown
  /** Called instead of `processRowUpdate` when a cell is edited. Resolve with the row the server stored. */
  updateRow?(params: UpdateRowParams<R>): Promise<R | void>
}

export class DataSourceError extends Error {
  readonly kind: 'getRows' | 'updateRow'
  readonly params: GetRowsParams | UpdateRowParams<any>
  override readonly cause: unknown
  constructor(kind: 'getRows' | 'updateRow', params: GetRowsParams | UpdateRowParams<any>, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = kind === 'getRows' ? 'GridGetRowsError' : 'GridUpdateRowError'
    this.kind = kind
    this.params = params
    this.cause = cause
  }
}
