import { type ColumnDef, type CustomAggregation, type FilterModel, type PaginationModel, type RenderRow, type RowId, type SortItem } from '../types'
import { type RowChanges, type UpdateKind } from './nodes'

/* ---------------------------------------------------------------- pipeline */

export interface PipelineResult<R> {
  rows: RenderRow<R>[]
  /** top-level nodes after filtering (what pagination counts) */
  rootCount: number
  /** data rows that survived filtering */
  filteredCount: number
  /** ids of visible data rows under a node (the id itself for a leaf) */
  getLeafIds(id: RowId): RowId[]
  /** ids of every expandable visible node, for "expand all" (computed on first access) */
  readonly expandableIds: RowId[]
  /** the data row behind an id (group rows have none) */
  getRow(id: RowId): R | undefined
  /** position of an id in `rows`, or -1 when it is not on the current page / is collapsed away */
  indexOf(id: RowId): number
  /** every row that passes the filter, in sorted tree order, ignoring pagination and expansion */
  getVisibleDataRows(): R[]
  /**
   * Every node that passes the filter, in display order, whatever is expanded or on the page: group rows with their
   * aggregates, tree parents, leaves. What an export writes. Pivot mode stops at the deepest group level.
   */
  getExportRows(): RenderRow<R>[]
  /** open detail panels that are in `rows`, top to bottom: the row id and its index in `rows` */
  detailRows: { id: RowId; index: number }[]
  /** position of a row in the data order (before any filtering, sorting or paging), or -1; flat grids only */
  dataIndexOf(id: RowId): number
  /** the row at a position of the data order, if any; flat grids only */
  dataIdAt(index: number): RowId | undefined
  /** number of rows in the data order; flat grids only (0 otherwise) */
  readonly dataCount: number
  /** aggregated value per field over every row passing the filter; undefined without an aggregation model */
  getTotals(): Record<string, unknown> | undefined
  /** pivot mode: the value columns that exist for the current data, in display order (empty otherwise) */
  pivotColumns: PivotColumn[]
}

/** separates the parts of a pivot column's field name */
export const PIVOT_SEP = '\u241f'
/** every pivot value column's field starts with this, and every total column's with the other */
export const PIVOT_VALUE_PREFIX = '__pv'
export const PIVOT_TOTAL_PREFIX = '__pt'
export const isPivotValueField = (field: string) => field.startsWith(PIVOT_VALUE_PREFIX) || field.startsWith(PIVOT_TOTAL_PREFIX)

/** One value column of a pivot table: the aggregate of one value field for one combination of column values. */
export interface PivotColumn {
  /** the field under which group rows carry this aggregate (`aggregates[field]`) */
  field: string
  valueField: string
  aggFunc: string
  /** display labels of the column groups above it, outermost first (empty for the totals) */
  path: string[]
  /** a total over all column values */
  total: boolean
}

export interface PivotInput {
  columns: { field: string; sort?: 'asc' | 'desc' }[]
  values: { field: string; aggFunc: string }[]
  /** also give every value a total column over all column values */
  totals?: boolean
}

import type { QuickFilterOptions } from './filter'

export interface PipelineInput<R> {
  rows: R[]
  columns: ColumnDef<R>[]
  /** Treated as pure: a new function identity does not invalidate anything. */
  getRowId: (row: R) => RowId
  /**
   * Tree data on/off is what matters: swapping one path function for another does not by itself
   * rebuild the hierarchy (change `rows` for that).
   */
  getTreeDataPath?: (row: R) => string[]
  sortModel: SortItem[]
  filterModel: FilterModel
  /** match letters with and without accents ("cafe" finds "café") in the filters and the quick filter */
  ignoreDiacritics?: boolean
  /** how the quick filter reads its input and where it looks */
  quickFilter?: QuickFilterOptions
  rowGroupingModel: string[]
  expandedIds: ReadonlySet<RowId>
  expandAllByDefault: boolean
  pagination?: PaginationModel
  /** rows kept out of the main list (pinned rows). Only top-level (flat) rows are supported. */
  hiddenIds?: ReadonlySet<RowId>
  /** rows whose detail panel is open; the result lists where they are */
  detailIds?: ReadonlySet<RowId>
  /** field → aggregation function name; shown on group rows and in the totals */
  aggregationModel?: Record<string, string>
  aggregationFunctions?: Record<string, CustomAggregation<R>>
  /**
   * Pivot mode: `rowGroupingModel` gives the row groups, only group rows are produced (no leaves), and
   * their aggregates are keyed by the fields of `result.pivotColumns`. `aggregationModel` is ignored.
   */
  pivot?: PivotInput
  /**
   * Pivot mode: order the groups of every level by this pivot column's aggregate (`field` is a `pivotColumns` field).
   * Empty values come last. It only changes the order of the list, so it never rebuilds the hierarchy.
   */
  aggSort?: { field: string; direction: 'asc' | 'desc' }
}

export interface Pipeline<R> {
  (input: PipelineInput<R>): PipelineResult<R>
  /**
   * Queue row changes. They are applied incrementally on the next run, touching only the nodes on
   * the changed rows' paths. A later change of the `rows` identity discards them (your data wins).
   */
  patch(changes: RowChanges<R>): void
  /** what the last run did: a full rebuild, an incremental update, or nothing */
  readonly lastUpdate: UpdateKind
}
