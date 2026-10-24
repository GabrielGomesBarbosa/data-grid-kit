import { useMemo, useRef, useState } from 'react'
import { Grid, type GridApi, type UIColumnDef } from 'data-grid-kit'

interface Employee {
  id: number
  name: string
  team: string
  role: string
  country: string
  salary: number
  age: number
  hired: Date
  email: string
  path: string[]
}

const teams = ['Platform', 'Growth', 'Payments', 'Design', 'Data']
const roles = ['Engineer', 'Manager', 'Analyst', 'Designer']
const countries = ['Brazil', 'Portugal', 'Spain', 'Germany', 'Japan', 'Canada']

function makeRows(n: number): Employee[] {
  let seed = 42
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  return Array.from({ length: n }, (_, i) => {
    const team = teams[Math.floor(rand() * teams.length)]!
    const role = roles[Math.floor(rand() * roles.length)]!
    const name = `Person ${i + 1}`
    return {
      id: i + 1,
      name,
      team,
      role,
      country: countries[Math.floor(rand() * countries.length)]!,
      salary: Math.round(3000 + rand() * 12000),
      age: 20 + Math.floor(rand() * 40),
      hired: new Date(2015 + Math.floor(rand() * 10), Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)),
      email: `person${i + 1}@example.com`,
      path: [team, role, name],
    }
  })
}

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 220, editable: true },
  { field: 'team', headerName: 'Team', width: 130, type: 'singleSelect', valueOptions: teams, editable: true },
  { field: 'role', headerName: 'Role', width: 130, type: 'singleSelect', valueOptions: roles, editable: true },
  { field: 'country', headerName: 'Country', width: 120, editable: true },
  { field: 'salary', headerName: 'Salary', width: 110, type: 'number', editable: true, valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { field: 'age', headerName: 'Age', width: 80, type: 'number', editable: true },
  { field: 'hired', headerName: 'Hired', width: 130, type: 'date', editable: true },
  { field: 'email', headerName: 'Email', width: 240 },
  { field: 'id', headerName: 'ID', width: 90, type: 'number' },
]

export function StressPage() {
  const [count, setCount] = useState(100_000)
  const rows = useMemo(() => makeRows(count), [count])
  const [mode, setMode] = useState<'flat' | 'group' | 'tree'>('flat')
  const apiRef = useRef<GridApi<Employee>>()
  const [q, setQ] = useState('')

  return (
    <>
      <h1 className="page-title">Stress test</h1>
      <p className="lead">Up to half a million rows with grouping, tree data, pinning, detail panels, cell selection and live editing. Everything stays virtualized.</p>
      <div className="bar">
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Row count">
          {[1_000, 10_000, 100_000, 500_000].map((n) => (
            <option key={n} value={n}>{n.toLocaleString()} rows</option>
          ))}
        </select>
        {(['flat', 'group', 'tree'] as const).map((m) => (
          <button
            key={m}
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m)
              apiRef.current?.setRowGroupingModel(m === 'group' ? ['team', 'role'] : [])
            }}
          >
            {m === 'flat' ? 'Flat' : m === 'group' ? 'Row grouping (team → role)' : 'Tree data'}
          </button>
        ))}
        <button onClick={() => apiRef.current?.expandAll()}>Expand all</button>
        <button onClick={() => apiRef.current?.collapseAll()}>Collapse all</button>
        <button onClick={() => { apiRef.current?.pinColumn('name', 'left'); apiRef.current?.pinColumn('id', 'right') }}>
          Pin name ⇤ / id ⇥
        </button>
        <input
          type="search"
          placeholder="Quick filter…"
          value={q}
          onChange={(e) => { setQ(e.target.value); apiRef.current?.setQuickFilter(e.target.value) }}
        />
        <span className="stat">Shift+click a header to multi-sort</span>
      </div>
      <div className="card">
      <Grid<Employee>
        key={mode === 'tree' ? 'tree' : 'rows'}
        rows={rows}
        columns={columns}
        height={560}
        checkboxSelection
        toolbar
        rowPinning
        cellSelection
        rowReordering
        detailPanelHeight="auto"
        renderDetailPanel={({ row }) => (
          <div>
            <strong>{row.name}</strong>: {row.role} in {row.team}, {row.country}.
            <p style={{ margin: '8px 0 0' }}>Hired {row.hired.toLocaleDateString()} · salary ${row.salary.toLocaleString()} · {row.email}</p>
          </div>
        )}
        processRowUpdate={(row) => row}
        pagination={false}
        getTreeDataPath={mode === 'tree' ? (r) => r.path : undefined}
        initialState={{ rowGroupingModel: mode === 'group' ? ['team', 'role'] : [], aggregationModel: { salary: 'sum', age: 'avg' } }}
        onReady={(api) => { apiRef.current = api }}
      />
      </div>
    </>
  )
}

