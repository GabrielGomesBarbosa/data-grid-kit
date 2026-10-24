'use client'

// The grid uses state, effects and event handlers, so it must run in a Client Component.
// "use client" is needed in the file that imports it; a Server Component can pass plain rows down as props.
import { Grid, type UIColumnDef } from 'data-grid-kit'
import type { Employee } from '../lib/data'

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 170 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'role', headerName: 'Role', width: 120 },
  { field: 'country', headerName: 'Country', width: 120 },
  { field: 'salary', headerName: 'Salary', width: 120, type: 'number', valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { field: 'hired', headerName: 'Hired', width: 120 },
]

export function TeamGrid({ rows }: { rows: Employee[] }) {
  return (
    <Grid<Employee>
      rows={rows}
      columns={columns}
      getRowId={(r) => r.id}
      height={460}
      toolbar
      initialState={{ paginationModel: { page: 0, pageSize: 25 } }}
    />
  )
}
