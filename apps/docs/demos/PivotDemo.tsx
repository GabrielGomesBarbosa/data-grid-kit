import { useMemo, useRef, useState } from 'react'
import { Grid, type GridApi, type PivotModel, type UIColumnDef } from 'data-grid-kit'
import { makeEmployees, type Employee } from '../data'

const money = (v: unknown) => `$${Math.round(Number(v)).toLocaleString()}`

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 160 },
  { field: 'team', headerName: 'Team' },
  { field: 'role', headerName: 'Role' },
  { field: 'country', headerName: 'Country' },
  { field: 'salary', headerName: 'Salary', type: 'number', valueFormatter: money },
  { field: 'age', headerName: 'Age', type: 'number' },
  // a date column also offers "Hired (year)" and "Hired (quarter)" to the pivot panel
  { field: 'hired', headerName: 'Hired', type: 'date' },
]

const presets: Record<string, PivotModel> = {
  'Average salary by team and role': {
    rows: ['team'],
    columns: [{ field: 'role' }],
    values: [{ field: 'salary', aggFunc: 'avg' }],
  },
  'Headcount by country and hiring year': {
    rows: ['country'],
    columns: [{ field: 'hired-year' }],
    values: [{ field: 'name', aggFunc: 'size' }],
  },
  'Payroll by team, country and role': {
    rows: ['team', 'country'],
    columns: [{ field: 'role' }],
    values: [{ field: 'salary', aggFunc: 'sum' }, { field: 'age', aggFunc: 'avg' }],
  },
}

export default function PivotDemo() {
  const [rows, setRows] = useState(() => makeEmployees(50_000))
  const api = useRef<GridApi<Employee>>()
  const next = useRef(rows.length + 1)
  const first = Object.values(presets)[0]!
  const initial = useMemo(() => ({ pivotMode: true, pivotModel: first }), [first])

  // 200 new people: only the cells they land in change
  const hire = () => {
    const batch = makeEmployees(200, next.current).map((e, i) => ({ ...e, id: next.current + i }))
    next.current += 200
    api.current?.updateRows({ insert: batch })
    setRows((r) => [...r, ...batch])
  }

  return (
    <>
      <p>
        {Object.entries(presets).map(([label, model]) => (
          <button key={label} type="button" onClick={() => api.current?.setPivotModel(model)} style={{ marginRight: 8 }}>
            {label}
          </button>
        ))}
        <button type="button" onClick={hire}>
          Hire 200 people
        </button>
      </p>
      <p className="muted">Open <strong>Pivot</strong> in the toolbar to build your own: add fields as rows, columns or values.</p>
      <Grid
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        height={420}
        toolbar
        pagination={false}
        pivoting
        pivotTotals
        initialState={initial}
        onReady={(a) => (api.current = a)}
      />
    </>
  )
}
