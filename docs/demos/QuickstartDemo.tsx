import { Grid, type UIColumnDef } from '../../src'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(50)

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 160 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'role', headerName: 'Role', width: 120 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 120 },
]

export default function QuickstartDemo() {
  return <Grid rows={rows} columns={columns} height={320} pagination={false} />
}
