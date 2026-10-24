import { useMemo, useRef, useState } from 'react'
import { Grid, type GridApi, type PivotModel, type UIColumnDef } from 'data-grid-kit'
import { COUNTRIES, ROLES, TEAMS, makeEmployees, type Employee } from '@data-grid-kit/sample-data'

const money = (v: unknown) => `$${Number(v).toLocaleString()}`

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 170, editable: true },
  { field: 'team', headerName: 'Team', width: 120, type: 'singleSelect', valueOptions: TEAMS, editable: true },
  { field: 'role', headerName: 'Role', width: 120, type: 'singleSelect', valueOptions: ROLES, editable: true },
  { field: 'country', headerName: 'Country', width: 120, type: 'singleSelect', valueOptions: COUNTRIES, editable: true },
  { field: 'salary', headerName: 'Salary', width: 120, type: 'number', editable: true, valueFormatter: money },
  { field: 'hired', headerName: 'Hired', width: 120, type: 'date', editable: true },
  { field: 'remote', headerName: 'Remote', width: 90, type: 'boolean', editable: true },
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

  return (
    <>
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
          Pivot: average salary by team and role
        </button>
        <button onClick={() => api.current?.exportXlsx({ fileName: 'team.xlsx', numFmts: { salary: '$#,##0' } })}>Download Excel</button>
        <span className="stat">
          {rows.length} people · payroll {money(total)} · double-click a cell to edit
        </span>
      </div>
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
    </>
  )
}
