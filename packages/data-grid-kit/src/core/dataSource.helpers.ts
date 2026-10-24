import { vi } from 'vitest'
import { DataSourceController, type DataSource, type DataSourceControllerOptions, type GetRowsParams, type GetRowsResponse } from './dataSource'
import type { FilterModel, SortItem } from './types'

export interface Row {
  id: number
  /** the query this row was produced for: proves a row on screen belongs to the current sort / filter */
  q: string
  v: number
}

export const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

export const tagOf = (sort: SortItem[], filter: FilterModel) => JSON.stringify([sort, filter.quickFilter ?? ''])

export interface Call {
  params: GetRowsParams
  /** answer with the real rows for the range */
  resolve(over?: Partial<GetRowsResponse<Row>>): void
  reject(error?: unknown): void
  settled: boolean
}

/** A server that answers only when told to, so tests control the order in which responses arrive. */
export function makeServer(total: number | ((filter: FilterModel) => number) = 1000, withCount = true, ignoreAbort = false) {
  const calls: Call[] = []
  const totalOf = (f: FilterModel) => (typeof total === 'function' ? total(f) : total)
  const build = (p: GetRowsParams): GetRowsResponse<Row> => {
    const n = totalOf(p.filterModel)
    const q = tagOf(p.sortModel, p.filterModel)
    const desc = p.sortModel[0]?.direction === 'desc'
    const rows: Row[] = []
    for (let pos = p.start; pos <= p.end && pos < n; pos++) rows.push({ id: desc ? n - pos : pos + 1, q, v: 0 })
    return withCount ? { rows, rowCount: n } : { rows }
  }
  const source: DataSource<Row> = {
    getRows(params) {
      return new Promise((resolve, reject) => {
        const call: Call = {
          params,
          settled: false,
          resolve: (over) => {
            call.settled = true
            resolve({ ...build(params), ...over })
          },
          reject: (e) => {
            call.settled = true
            reject(e ?? new Error('boom'))
          },
        }
        // a polite server stops when told to; a rude one (ignoreAbort) answers anyway, whenever it likes
        if (!ignoreAbort) {
          params.signal.addEventListener('abort', () => {
            if (call.settled) return
            call.settled = true
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }
        calls.push(call)
      })
    },
  }
  return { source, calls, build, open: () => calls.filter((c) => !c.settled) }
}

export const make = (server: ReturnType<typeof makeServer>, over: Partial<DataSourceControllerOptions<Row>> = {}) => {
  const c = new DataSourceController<Row>({
    getSource: () => server.source,
    getRowId: (r) => r.id,
    chunkSize: 10,
    settleMs: 0,
    prefetchChunks: 0,
    ...over,
  })
  c.resume()
  return c
}

export const asc: SortItem[] = [{ field: 'v', direction: 'asc' }]
export const desc: SortItem[] = [{ field: 'v', direction: 'desc' }]
export const none: FilterModel = { items: [] }
export const ids = (c: DataSourceController<Row>, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => c.rowAt(from + i)?.id)
