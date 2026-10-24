import type { FilterModel, RowId, SortItem } from '../types'

/** What the grid asks the server for. `start` and `end` are row positions, both inclusive. */
export interface GetRowsParams {
  start: number
  end: number
  sortModel: SortItem[]
  filterModel: FilterModel
  /** aborted when the answer is no longer wanted (the sort / filter changed, or a refresh). Pass it to `fetch`. */
  signal: AbortSignal
}

export interface GetRowsResponse<R> {
  rows: R[]
  /** total rows for this sort + filter. Omit it, or send -1, when the server doesn't know (infinite scrolling). */
  rowCount?: number
  /** `hasNextPage: false` marks the end when `rowCount` is unknown */
  pageInfo?: { hasNextPage?: boolean }
}

export interface UpdateRowParams<R> {
  rowId: RowId
  updatedRow: R
  previousRow: R
}

export interface DataSource<R = any> {
  getRows(params: GetRowsParams): Promise<GetRowsResponse<R>>
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
