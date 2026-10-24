import { useState } from 'react'
import { createPipeline, type ColumnDef, type PipelineInput } from '../../src/core'
import { makeEmployees, type Employee } from '../data'

const columns: ColumnDef<Employee>[] = ['name', 'team', 'role', 'country', 'salary', 'age'].map((field) => ({ field }))

interface Result {
  label: string
  ms: number
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
const tick = () => new Promise((r) => setTimeout(r, 0))

async function run(n: number, onProgress: (r: Result[]) => void): Promise<void> {
  const rows = makeEmployees(n)
  const base: PipelineInput<Employee> = {
    rows,
    columns,
    getRowId: (r) => r.id,
    sortModel: [],
    filterModel: { items: [] },
    rowGroupingModel: [],
    expandedIds: new Set(),
    expandAllByDefault: false,
  }
  const out: Result[] = []
  const measure = async (label: string, work: () => void, runs = 3, prepare?: (i: number) => void) => {
    const t: number[] = []
    for (let i = 0; i < runs; i++) {
      prepare?.(i) // not timed
      const s = performance.now()
      work()
      t.push(performance.now() - s)
    }
    out.push({ label, ms: median(t) })
    onProgress([...out])
    await tick() // let the table repaint between scenarios
  }
  const cold = (over: Partial<PipelineInput<Employee>>) => () => void createPipeline<Employee>()({ ...base, ...over })

  await measure('Build rows (no sort / filter)', cold({}))
  await measure('Sort by 1 numeric column', cold({ sortModel: [{ field: 'salary', direction: 'asc' }] }))
  await measure('Sort by 2 text columns', cold({ sortModel: [{ field: 'team', direction: 'asc' }, { field: 'name', direction: 'desc' }] }))
  await measure('Filter (number) + quick filter', cold({ filterModel: { items: [{ field: 'age', operator: 'gt', value: 40 }], quickFilter: 'person 1' } }))
  await measure('Group by team → role', cold({ rowGroupingModel: ['team', 'role'] }))
  await measure(
    'Group + filter + sort',
    cold({
      rowGroupingModel: ['team', 'role'],
      sortModel: [{ field: 'salary', direction: 'desc' }],
      filterModel: { items: [{ field: 'age', operator: 'gt', value: 30 }] },
    }),
  )
  await measure(
    'Pivot: team × role, sum + average',
    cold({
      rowGroupingModel: ['team'],
      expandAllByDefault: true,
      pivot: { columns: [{ field: 'role' }], values: [{ field: 'salary', aggFunc: 'sum' }, { field: 'age', aggFunc: 'avg' }] },
    }),
  )
  await measure('Tree data (3 levels)', cold({ getTreeDataPath: (r) => [r.team, r.role, r.name] }))

  // incremental stages: build once, then change only one input
  const warm = createPipeline<Employee>()
  const grouped = { ...base, rowGroupingModel: ['team', 'role'] }
  warm(grouped)
  let i = 0
  await measure('Expand / collapse a group (warm)', () => void warm({ ...grouped, expandedIds: new Set([`group/team:Platform`, String(i++)]) }), 9)
  // live edits: a new rows array arrives with one row replaced (what a React state update looks like)
  const liveInput: PipelineInput<Employee> = { ...base, sortModel: [{ field: 'salary', direction: 'asc' }] }
  const live = createPipeline<Employee>()
  live(liveInput)
  let cur = rows
  const next = (i: number, change: (r: Employee) => Employee) => {
    cur = cur.slice()
    const at = (i * 7919) % cur.length
    cur[at] = change(cur[at]!)
  }
  await measure('Edit one row, sorted flat list (warm)', () => void live({ ...liveInput, rows: cur }), 9, (i) => next(i, (r) => ({ ...r, name: 'x' + i })))
  await measure('Edit the sort key of one row (warm)', () => void live({ ...liveInput, rows: cur }), 9, (i) => next(i, (r) => ({ ...r, salary: (i * 37) % 15000 })))
  const liveGrouped: PipelineInput<Employee> = { ...liveInput, rowGroupingModel: ['team', 'role'] }
  const live2 = createPipeline<Employee>()
  live2(liveGrouped)
  cur = rows
  await measure('Edit the sort key, grouped (warm)', () => void live2({ ...liveGrouped, rows: cur }), 9, (i) => next(i, (r) => ({ ...r, salary: (i * 37) % 15000 })))
  let s = 0
  await measure('Change sort (tree & filter cached)', () => void warm({ ...grouped, sortModel: [{ field: 'salary', direction: s++ % 2 ? 'asc' : 'desc' }] }), 5)
}

export default function BenchmarkDemo() {
  const [n, setN] = useState(100_000)
  const [results, setResults] = useState<Result[]>([])
  const [running, setRunning] = useState(false)

  const start = async () => {
    setRunning(true)
    setResults([])
    await tick()
    try {
      await run(n, setResults)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <p>
        <label>
          Rows{' '}
          <select value={n} onChange={(e) => setN(Number(e.target.value))} disabled={running}>
            {[10_000, 100_000, 500_000].map((v) => (
              <option key={v} value={v}>
                {v.toLocaleString()}
              </option>
            ))}
          </select>
        </label>{' '}
        <button type="button" onClick={start} disabled={running}>
          {running ? 'Running…' : 'Run benchmark'}
        </button>{' '}
        <span className="muted">Runs on this tab's main thread, so the page may stutter for a moment.</span>
      </p>
      {results.length > 0 && (
        <div className="table-wrap">
          <table className="props">
            <thead>
              <tr>
                <th>Scenario</th>
                <th style={{ textAlign: 'right' }}>Median (ms)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.ms < 0.01 ? '<0.01' : r.ms < 10 ? r.ms.toFixed(2) : r.ms.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
