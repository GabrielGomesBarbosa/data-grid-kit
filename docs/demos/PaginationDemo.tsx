import { Grid, type UIColumnDef } from '../../src'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(95)

const columns: UIColumnDef<Employee>[] = [
  { field: 'id', headerName: 'ID', type: 'number', width: 80 },
  { field: 'name', headerName: 'Name', width: 160 },
  { field: 'team', headerName: 'Team', width: 130 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 120 },
]

export default function PaginationDemo() {
  return (
    <Grid
      rows={rows}
      columns={columns}
      height={340}
      pagination
      initialState={{ paginationModel: { page: 0, pageSize: 10 } }}
    />
  )
}
