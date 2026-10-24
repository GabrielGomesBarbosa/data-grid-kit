import { useRef, useState } from 'react'
import { Grid, type GridApi, type UIColumnDef } from 'data-grid-kit'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(20_000)

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 210 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'role', headerName: 'Role', width: 120 },
  { field: 'country', headerName: 'Country', width: 120 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 110 },
]

const FIELDS = ['team', 'role', 'country']

export default function GroupingDemo() {
  const api = useRef<GridApi<Employee>>()
  const [by, setBy] = useState<string[]>(['team', 'role'])

  const toggle = (field: string) => {
    const next = by.includes(field) ? by.filter((f) => f !== field) : [...by, field]
    setBy(next)
    api.current?.setRowGroupingModel(next)
  }

  return (
    <>
      <p>
        Group by (order = click order):{' '}
        {FIELDS.map((f) => (
          <label key={f} style={{ marginRight: 12 }}>
            <input type="checkbox" checked={by.includes(f)} onChange={() => toggle(f)} /> {f}
            {by.includes(f) && <sup> {by.indexOf(f) + 1}</sup>}
          </label>
        ))}
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={340}
        pagination={false}
        checkboxSelection
        toolbar
        initialState={{ rowGroupingModel: ['team', 'role'] }}
        onReady={(a) => (api.current = a)}
      />
    </>
  )
}
