import { Grid, type UIColumnDef } from '../../src'
import { COUNTRIES, ROLES, makeEmployees, type Employee } from '../data'

const rows = makeEmployees(5000)

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 140 },
  { field: 'role', headerName: 'Role', type: 'singleSelect', valueOptions: ROLES, width: 130 },
  { field: 'country', headerName: 'Country', type: 'singleSelect', valueOptions: COUNTRIES, width: 130 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 120 },
  { field: 'hired', headerName: 'Hired', type: 'date', width: 130 },
  { field: 'remote', headerName: 'Remote', type: 'boolean', width: 100 },
]

export default function FilteringDemo() {
  return (
    <Grid
      rows={rows}
      columns={columns}
      height={380}
      toolbar
      pagination={false}
      initialState={{
        filterModel: { items: [{ field: 'salary', operator: 'gt', value: 12000 }] },
      }}
    />
  )
}
