import { useMemo, useRef, useState } from 'react'
import { Grid, type DataSource, type UIColumnDef } from 'data-grid-kit'
import { makeEmployees, TEAMS } from '../data'

/** a team (top level) or a person (its children): both are rows of the one shape the grid shows */
interface Item {
  id: string
  /** unique among its siblings: part of the path sent as `groupKeys` */
  key: string
  name: string
  team: string
  salary: number
  /** how many children: 0 for a person */
  children: number
}

const people = makeEmployees(600)
const teamOf = (team: string) => people.filter((p) => p.team === team)
const average = (team: string) => Math.round(teamOf(team).reduce((s, p) => s + p.salary, 0) / teamOf(team).length)

const columns: UIColumnDef<Item>[] = [
  { field: 'name', headerName: 'Name', width: 220 },
  { field: 'team', headerName: 'Team', width: 110 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 130, valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
]

/** A server that knows the tree: it answers for one level at a time, the one the `groupKeys` path points to. */
function createTreeServer(log: (line: string) => void): DataSource<Item> {
  const wait = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms)
      signal.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('Aborted', 'AbortError'))))
    })
  return {
    async getRows({ groupKeys = [], start, end, sortModel, signal }) {
      log(`getRows groupKeys=${JSON.stringify(groupKeys)} ${start}-${end}`)
      await wait(350, signal)
      let rows: Item[] =
        groupKeys.length === 0
          ? TEAMS.map((t) => ({ id: `team:${t}`, key: t, name: t, team: t, salary: average(t), children: teamOf(t).length }))
          : teamOf(groupKeys[0]!).map((p) => ({ id: `p:${p.id}`, key: String(p.id), name: p.name, team: p.team, salary: p.salary, children: 0 }))
      const sort = sortModel[0]
      if (sort) rows = [...rows].sort((a, b) => (String(a[sort.field as keyof Item]) > String(b[sort.field as keyof Item]) ? 1 : -1) * (sort.direction === 'desc' ? -1 : 1))
      return { rows: rows.slice(start, end + 1), rowCount: rows.length }
    },
    getGroupKey: (row) => row.key,
    getChildrenCount: (row) => row.children,
    // what a group row shows in the aggregated column: computed by the server, not by the grid
    getAggregatedValue: (row, field) => (field === 'salary' ? average(row.team) : undefined),
  }
}

export default function ServerTreeDemo() {
  const [lines, setLines] = useState<string[]>([])
  const lastLog = useRef(0)
  const dataSource = useMemo(
    () => createTreeServer((line) => setLines((l) => [`${++lastLog.current}. ${line}`, ...l].slice(0, 6))),
    [],
  )
  return (
    <div className="split">
      <div>
        <p className="muted">Open a team: its people are requested then, with the team in the path. Open it again and nothing is sent (cache).</p>
        <Grid
          columns={columns}
          dataSource={dataSource}
          getRowId={(r) => r.id}
          pagination={false}
          height={320}
          initialState={{ aggregationModel: { salary: 'avg' } }}
        />
      </div>
      <ol className="request-log" aria-label="Requests">
        {lines.length === 0 && <li className="muted">No requests yet.</li>}
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ol>
    </div>
  )
}
