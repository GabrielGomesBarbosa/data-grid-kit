import { useMemo, useRef, useState } from 'react'
import { Grid, type GridApi, type PivotModel, type UIColumnDef } from 'data-grid-kit'
import { COUNTRIES, ROLES, TEAMS, makeEmployees, type Employee } from '@data-grid-kit/sample-data'

const money = (v: unknown) => `$${Math.round(Number(v)).toLocaleString('en-US')}`

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 240, editable: true },
  { field: 'team', headerName: 'Team', width: 160, type: 'singleSelect', valueOptions: TEAMS, editable: true },
  { field: 'role', headerName: 'Role', width: 160, type: 'singleSelect', valueOptions: ROLES, editable: true },
  { field: 'country', headerName: 'Country', width: 160, type: 'singleSelect', valueOptions: COUNTRIES, editable: true },
  { field: 'salary', headerName: 'Salary', width: 150, type: 'number', editable: true, valueFormatter: money },
  { field: 'hired', headerName: 'Hired', width: 150, type: 'date', editable: true },
  { field: 'remote', headerName: 'Remote', width: 130, type: 'boolean', editable: true },
]

const pivot: PivotModel = {
  rows: ['team'],
  columns: [{ field: 'role' }],
  values: [{ field: 'salary', aggFunc: 'avg' }],
}

/** A typical admin screen: sorting, filtering, editing, pagination, export, and two "advanced" switches. */
export function TeamPage() {
  const [rows, setRows] = useState(() => makeEmployees(300))
  const [grouped, setGrouped] = useState(false)
  const [pivoted, setPivoted] = useState(false)
  const api = useRef<GridApi<Employee>>()
  const total = useMemo(() => rows.reduce((s, r) => s + r.salary, 0), [rows])
  const remote = useMemo(() => Math.round((rows.filter((r) => r.remote).length / rows.length) * 100), [rows])

  return (
    <>
      <h1 className="page-title">People directory</h1>
      <p className="lead">A typical admin screen built on the grid: sort, filter, edit in place, group, pivot and export, with the data kept in your own state.</p>
      <div className="kpis">
        <div className="kpi">
          <span>Headcount</span>
          <strong>{rows.length}</strong>
          <em>across {new Set(rows.map((r) => r.team)).size} teams</em>
        </div>
        <div className="kpi">
          <span>Total payroll</span>
          <strong>{money(total)}</strong>
          <em>updates as you edit</em>
        </div>
        <div className="kpi">
          <span>Average salary</span>
          <strong>{money(Math.round(total / rows.length))}</strong>
          <em>per person</em>
        </div>
        <div className="kpi">
          <span>Remote</span>
          <strong>{remote}%</strong>
          <em>of the team</em>
        </div>
      </div>
      <div className="bar">
        <button
          aria-pressed={grouped}
          disabled={pivoted}
          onClick={() => {
            setGrouped(!grouped)
            api.current?.setRowGroupingModel(grouped ? [] : ['team', 'role'])
          }}
        >
          Group by team → role
        </button>
        <button
          aria-pressed={pivoted}
          onClick={() => {
            setPivoted(!pivoted)
            api.current?.setPivotModel(pivot)
            api.current?.setPivotMode(!pivoted)
          }}
        >
          Pivot: average salary
        </button>
        <button className="primary" onClick={() => api.current?.exportXlsx({ fileName: 'team.xlsx', numFmts: { salary: '$#,##0' } })}>
          Download Excel
        </button>
        <span className="stat">Double-click a cell to edit</span>
      </div>
      <div className="card">
        <Grid<Employee>
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          height={520}
          toolbar
          pivoting
          checkboxSelection
          initialState={{ paginationModel: { page: 0, pageSize: 25 }, aggregationModel: { salary: 'avg' } }}
          // keep your own copy of the data in sync with edits
          processRowUpdate={(next) => {
            setRows((all) => all.map((r) => (r.id === next.id ? next : r)))
            return next
          }}
          onReady={(a) => (api.current = a)}
        />
      </div>
      <p className="foot">
        Source: <code>apps/react-example/src/TeamPage.tsx</code>. Copy it into your project as a starting point.
      </p>
    </>
  )
}
