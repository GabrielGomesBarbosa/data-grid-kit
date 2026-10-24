import { createPipeline, type PipelineInput } from '../src/core/pipeline'
import type { ColumnDef } from '../src/core/types'

interface Row { id: number; name: string; team: string; role: string; salary: number; age: number; path: string[] }
const teams = ['Platform', 'Growth', 'Payments', 'Design', 'Data']
const roles = ['Engineer', 'Manager', 'Analyst', 'Designer']
let seed = 7
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const make = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => {
    const team = teams[Math.floor(rand() * teams.length)]!
    const role = roles[Math.floor(rand() * roles.length)]!
    return { id: i, name: `Person ${i}`, team, role, salary: Math.round(rand() * 15000), age: 20 + Math.floor(rand() * 40), path: [team, role, `Person ${i}`] }
  })
const columns: ColumnDef<Row>[] = ['name', 'team', 'role', 'salary', 'age'].map((field) => ({ field }))

const time = (fn: () => void, runs = 5) => {
  const t: number[] = []
  for (let i = 0; i < runs; i++) { const s = performance.now(); fn(); t.push(performance.now() - s) }
  t.sort((a, b) => a - b)
  return t[Math.floor(t.length / 2)]!
}

for (const n of [100_000, 500_000]) {
  const rows = make(n)
  const base: PipelineInput<Row> = {
    rows, columns, getRowId: (r) => r.id, sortModel: [], filterModel: { items: [] },
    rowGroupingModel: [], expandedIds: new Set(), expandAllByDefault: false,
  }
  const out: Record<string, string> = {}
  const cold = (over: Partial<PipelineInput<Row>>) => time(() => createPipeline<Row>()({ ...base, ...over }))

  out['flat: build'] = cold({}).toFixed(1)
  out['flat: sort salary'] = cold({ sortModel: [{ field: 'salary', direction: 'asc' }] }).toFixed(1)
  out['flat: sort 2 keys'] = cold({ sortModel: [{ field: 'team', direction: 'asc' }, { field: 'salary', direction: 'desc' }] }).toFixed(1)
  out['flat: filter + quick'] = cold({ filterModel: { items: [{ field: 'age', operator: 'gt', value: 40 }], quickFilter: 'person 1' } }).toFixed(1)
  out['group 2 levels (collapsed)'] = cold({ rowGroupingModel: ['team', 'role'] }).toFixed(1)
  out['group 2 levels + sort + filter'] = cold({ rowGroupingModel: ['team', 'role'], sortModel: [{ field: 'salary', direction: 'desc' }], filterModel: { items: [{ field: 'age', operator: 'gt', value: 30 }] } }).toFixed(1)
  out['tree data (collapsed)'] = cold({ getTreeDataPath: (r) => r.path }).toFixed(1)
  out['tree data expandAll + sort'] = cold({ getTreeDataPath: (r) => r.path, expandAllByDefault: true, sortModel: [{ field: 'salary', direction: 'asc' }] }).toFixed(1)

  // incremental stages, the common interactions
  const run = createPipeline<Row>()
  const grouped = { ...base, rowGroupingModel: ['team', 'role'] }
  run(grouped)
  let ex = 0
  out['warm: expand/collapse a group'] = time(() => run({ ...grouped, expandedIds: new Set([`group/team:Platform`, String(ex++)]) }), 9).toFixed(2)
  let q = 0
  out['warm: change filter (tree cached)'] = time(() => run({ ...grouped, filterModel: { items: [{ field: 'age', operator: 'gt', value: 20 + (q++ % 30) }] } }), 9).toFixed(1)
  let s = 0
  out['warm: toggle sort (tree+filter cached)'] = time(() => run({ ...grouped, sortModel: [{ field: 'salary', direction: s++ % 2 ? 'asc' : 'desc' }] }), 9).toFixed(1)

  // ---- live updates: one change at a time against a warm pipeline ----
  const live = (label: string, over: Partial<PipelineInput<Row>>, ops: Array<(rows: Row[], i: number) => Row[]>) => {
    const run = createPipeline<Row>()
    let cur = rows
    run({ ...base, ...over, rows: cur })
    const times: number[] = []
    for (let i = 0; i < 15; i++) {
      for (const op of ops) {
        cur = op(cur, i)
        const t = performance.now()
        run({ ...base, ...over, rows: cur })
        times.push(performance.now() - t)
      }
    }
    times.sort((a, b) => a - b)
    out[label] = `${times[Math.floor(times.length / 2)]!.toFixed(2)} (${run.lastUpdate})`
  }
  const sorted = { sortModel: [{ field: 'salary', direction: 'asc' as const }] }
  const editName = (r: Row[], i: number) => { const c = r.slice(); c[(i * 7919) % r.length] = { ...c[(i * 7919) % r.length]!, name: 'x' + i }; return c }
  const editSalary = (r: Row[], i: number) => { const c = r.slice(); c[(i * 7919) % r.length] = { ...c[(i * 7919) % r.length]!, salary: i * 37 % 15000 }; return c }
  const append = (r: Row[], i: number) => [...r, { id: n + i, name: 'new', team: 'Data', role: 'Engineer', salary: i * 91 % 15000, age: 30, path: ['Data', 'Engineer', 'new' + i] }]
  const dropOne = (r: Row[], i: number) => { const c = r.slice(); c.splice((i * 104729) % c.length, 1); return c }
  live('live (sorted): edit a non-key cell', sorted, [editName])
  live('live (sorted): edit the sort key', sorted, [editSalary])
  live('live (sorted): append 1 row', sorted, [append])
  live('live (sorted): remove 1 row', sorted, [dropOne])
  live('live (grouped+sorted): edit sort key', { ...sorted, rowGroupingModel: ['team', 'role'] }, [editSalary])
  live('live (tree+sorted): edit sort key', { ...sorted, getTreeDataPath: (r: Row) => r.path }, [editSalary])
  const agg = { aggregationModel: { salary: 'sum', age: 'avg' } }
  out['aggregation: build, grouped (cold)'] = cold({ ...agg, rowGroupingModel: ['team', 'role'] }).toFixed(1)
  out['aggregation: build, flat (cold)'] = cold({ ...agg }).toFixed(1)
  live('live (flat+sorted+totals): edit the sort key', { ...sorted, ...agg }, [editSalary])
  live('live (grouped+sorted+aggregates): edit the sort key', { ...sorted, ...agg, rowGroupingModel: ['team', 'role'] }, [editSalary])
  live('live (grouped+max): edit the sort key', { ...sorted, aggregationModel: { salary: 'max' }, rowGroupingModel: ['team', 'role'] }, [editSalary])
  // ---- pivot ----
  const pv = (cols: string[], values: { field: string; aggFunc: string }[]) => ({
    rowGroupingModel: ['team'], expandAllByDefault: true, pivot: { columns: cols.map((field) => ({ field })), values },
  })
  const narrow = pv(['role'], [{ field: 'salary', aggFunc: 'sum' }, { field: 'age', aggFunc: 'avg' }])
  const wide = pv(['age'], [{ field: 'salary', aggFunc: 'sum' }, { field: 'age', aggFunc: 'avg' }])
  out['pivot: build, 4 column values x 2 values'] = cold(narrow).toFixed(1)
  out['pivot: build, 40 column values x 2 values'] = cold(wide).toFixed(1)
  out['pivot: build, 2 row levels x 4 columns'] = cold({ ...narrow, rowGroupingModel: ['team', 'role'] }).toFixed(1)
  live('live (pivot 4 cols): edit a value', { ...narrow }, [editSalary])
  live('live (pivot 40 cols): edit a value', { ...wide }, [editSalary])
  live('live (pivot 4 cols): append 1 row', { ...narrow }, [append])
  live('live (pivot 4 cols): remove 1 row', { ...narrow }, [dropOne])
  // what MUI does before it aggregates: copy every row with one property per column path, then rebuild the column list
  out['(for scale) MUI-style pivot step: copy rows + per-row column keys'] = time(() => {
    const seen = new Map<string, true>()
    const copies = rows.map((row) => {
      const copy: Record<string, unknown> = { ...row }
      const key = [String(row.role)].join('>')
      seen.set(key, true)
      copy[`${key}>salary`] = row.salary
      copy[`${key}>age`] = row.age
      return copy
    })
    return void copies.length
  }).toFixed(1)
  out['(for scale) rebuild from scratch'] = cold({ ...sorted }).toFixed(1)

  console.log(`\n=== ${n.toLocaleString()} rows — median of runs, ms ===`)
  console.table(out)
}
