import { createRowFilter, compareValues, getCellValue, type ColumnDef, type DataSource, type FilterModel, type GetRowsParams, type SortItem } from 'data-grid-kit'
import { makeEmployees, type Employee } from './data'

export interface RequestRecord {
  id: number
  /** "rows 100–199 · sorted by salary ↓ · filter “eng”" */
  text: string
  status: 'pending' | 'done' | 'aborted' | 'failed'
  ms: number | null
}

/** Column definitions with types: the fake server filters with the same code the grid uses on the client. */
export const serverColumns: ColumnDef<Employee>[] = [
  { field: 'id', type: 'number' },
  { field: 'name' },
  { field: 'team' },
  { field: 'role' },
  { field: 'country' },
  { field: 'salary', type: 'number' },
  { field: 'age', type: 'number' },
  { field: 'hired', type: 'date' },
  { field: 'email' },
]

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })

export interface FakeServer {
  source: DataSource<Employee>
  total: number
  records: () => RequestRecord[]
  subscribe: (listener: () => void) => () => void
  setLatency: (ms: number) => void
  getLatency: () => number
  failNext: () => void
  reset: () => void
  counts: () => { sent: number; aborted: number; failed: number }
}

const cache = new Map<string, FakeServer>()

/**
 * An in-memory "server": real sorting and filtering over a data set, an artificial delay, abort support,
 * and a log of what was asked. `knownCount: false` makes it behave like an API that can't count.
 */
export function createFakeServer(total: number, knownCount = true): FakeServer {
  const key = `${total}:${knownCount}`
  const existing = cache.get(key)
  if (existing) {
    existing.reset()
    return existing
  }

  const all = makeEmployees(total, 7)
  const listeners = new Set<() => void>()
  let records: RequestRecord[] = []
  let nextId = 1
  let latency = 400
  let failNextRequest = false
  const indexes = new Map<string, Int32Array>()

  const emit = () => listeners.forEach((l) => l())
  const log = (r: RequestRecord) => {
    records = [r, ...records].slice(0, 40)
    emit()
    return (patch: Partial<RequestRecord>) => {
      Object.assign(r, patch)
      records = [...records]
      emit()
    }
  }

  /** the positions of the rows that match, in order: computed once per sort + filter and kept */
  const indexFor = (sort: SortItem[], filter: FilterModel): Int32Array => {
    const k = JSON.stringify([sort, filter])
    const hit = indexes.get(k)
    if (hit) return hit
    const keep = createRowFilter(filter, serverColumns)
    const ids: number[] = []
    for (let i = 0; i < all.length; i++) if (!keep || keep(all[i]!)) ids.push(i)
    const s = sort[0]
    if (s) {
      const col = serverColumns.find((c) => c.field === s.field)!
      const dir = s.direction === 'asc' ? 1 : -1
      const values = ids.map((i) => getCellValue(col, all[i]!))
      const order = ids.map((_, n) => n).sort((a, b) => dir * compareValues(values[a], values[b]) || a - b)
      const sorted = Int32Array.from(order.map((n) => ids[n]!))
      indexes.set(k, sorted)
      return sorted
    }
    const out = Int32Array.from(ids)
    indexes.set(k, out)
    return out
  }

  const describe = (p: GetRowsParams) => {
    const sort = p.sortModel[0] ? ` · by ${p.sortModel[0].field} ${p.sortModel[0].direction === 'asc' ? '↑' : '↓'}` : ''
    const f = p.filterModel.quickFilter ? ` · “${p.filterModel.quickFilter}”` : p.filterModel.items.length ? ` · ${p.filterModel.items.length} filter(s)` : ''
    return `rows ${p.start.toLocaleString()}–${p.end.toLocaleString()}${sort}${f}`
  }

  const server: FakeServer = {
    total,
    source: {
      async getRows(params) {
        const started = performance.now()
        const done = log({ id: nextId++, text: describe(params), status: 'pending', ms: null })
        try {
          await sleep(latency * (0.6 + Math.random() * 0.8), params.signal)
          if (failNextRequest) {
            failNextRequest = false
            throw new Error('503 Service Unavailable (simulated)')
          }
          const idx = indexFor(params.sortModel, params.filterModel)
          const rows: Employee[] = []
          for (let p = params.start; p <= params.end && p < idx.length; p++) rows.push(all[idx[p]!]!)
          done({ status: 'done', ms: Math.round(performance.now() - started) })
          return knownCount ? { rows, rowCount: idx.length } : { rows }
        } catch (error) {
          const aborted = error instanceof DOMException && error.name === 'AbortError'
          done({ status: aborted ? 'aborted' : 'failed', ms: Math.round(performance.now() - started) })
          throw error
        }
      },
      async updateRow({ updatedRow }) {
        await new Promise((r) => setTimeout(r, Math.min(latency, 500)))
        const saved = { ...updatedRow, name: updatedRow.name.trim() }
        all[saved.id - 1] = saved // ids are positions + 1 in this data set
        indexes.clear() // an edit can change the order, so what was sorted before is stale
        return saved
      },
    },
    records: () => records,
    subscribe: (l) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    setLatency: (ms) => (latency = ms),
    getLatency: () => latency,
    failNext: () => (failNextRequest = true),
    reset: () => {
      records = []
      nextId = 1
      failNextRequest = false
      emit()
    },
    counts: () => ({
      sent: records.length,
      aborted: records.filter((r) => r.status === 'aborted').length,
      failed: records.filter((r) => r.status === 'failed').length,
    }),
  }
  cache.set(key, server)
  return server
}
