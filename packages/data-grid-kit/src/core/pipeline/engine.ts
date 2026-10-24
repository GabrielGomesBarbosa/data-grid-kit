import { type BuiltinAggregation } from '../aggregation'
import { type ColumnDef, type RowId } from '../types'
import { makePlan, type TreeNode, type Model, type RowChanges, type UpdateKind, type SortPlan } from './nodes'
import { type PipelineResult, type PivotColumn, type PivotInput, type PipelineInput } from './contract'
import { type AggItem } from './aggStage'
import { type PivotKey } from './pivotStage'

/** Everything the pipeline keeps between runs. The stage modules read and write it through `S`. */
export interface Engine<R> {
  model: Model<R> | null
  structDeps: unknown[]
  filterDeps: unknown[]
  sortDeps: unknown[]
  flatDeps: unknown[]
  passes: ((row: R) => boolean) | null
  byField: Map<string, ColumnDef<R>>
  getters: Map<string, (row: R) => unknown>
  lastColumns: ColumnDef<R>[] | null
  plan: SortPlan<R>
  derivedOk: boolean
  keysValid: boolean
  version: number
  result: PipelineResult<R> | undefined
  queue: RowChanges<R>[]
  overlay: { upsert: Map<RowId, R>; remove: Set<RowId>; moved: boolean; }
  input: PipelineInput<R>
  lastUpdate: UpdateKind
  stampCounter: number
  rawCmps: Map<number[], (a: TreeNode<R>, b: TreeNode<R>) => number>
  aggItems: AggItem<R>[]
  aggDeps: unknown[]
  pivot: PivotInput | undefined
  pivotKeys: Map<string, PivotKey>
  pivotValues: { col: ColumnDef<R>; kind: BuiltinAggregation }[]
  pivotKeyCols: ColumnDef<R>[]
  totalIdx: number[]
  pivotColsCache: PivotColumn[]
  pivotLive: number[]
  customRoot: { v: number; out: Record<string, unknown> } | undefined
  lastTotals: Record<string, unknown> | undefined
}

export function createEngine<R>(): Engine<R> {
  const byField = new Map<string, ColumnDef<R>>()
  return {
    model: null,
    structDeps: [],
    filterDeps: [],
    sortDeps: [],
    flatDeps: [],
    passes: null,
    byField,
    getters: new Map<string, (row: R) => unknown>(),
    lastColumns: null,
    plan: makePlan([], byField),
    derivedOk: false,
    keysValid: false,
    version: 0,
    result: undefined,
    queue: [],
    overlay: {
      upsert: new Map<RowId, R>(),
      remove: new Set<RowId>(),
      /** rows were moved by hand: on a rebuild the data order is carried over from the old hierarchy */
      moved: false,
    },
    input: undefined as never, // set on every run before anything reads it
    lastUpdate: 'rebuild',
    stampCounter: 0,
    rawCmps: new Map<number[], (a: TreeNode<R>, b: TreeNode<R>) => number>(),
    aggItems: [],
    aggDeps: [],
    pivot: undefined,
    pivotKeys: new Map<string, PivotKey>(),
    pivotValues: [],
    pivotKeyCols: [],
    totalIdx: [],
    pivotColsCache: [],
    pivotLive: [],
    customRoot: undefined,
    lastTotals: undefined,
  }
}
