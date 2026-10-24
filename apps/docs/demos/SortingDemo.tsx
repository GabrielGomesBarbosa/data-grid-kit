import { Grid, type UIColumnDef } from 'data-grid-kit'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(1000)

const columns: UIColumnDef<Employee>[] = [
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'role', headerName: 'Role', width: 120 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 120 },
  { field: 'age', headerName: 'Age', type: 'number', width: 90 },
  {
    // a custom comparator replaces the default ordering for this column
    field: 'country',
    headerName: 'Country (shortest first)',
    width: 190,
    sortComparator: (a, b) => String(a).length - String(b).length,
  },
]

export default function SortingDemo() {
  return (
    <>
      <p className="muted">Click a header to sort, Shift+click to add a second key. Empty values always sort last.</p>
      <Grid
        rows={rows}
        columns={columns}
        height={320}
        pagination={false}
        initialState={{
          sortModel: [
            { field: 'team', direction: 'asc' },
            { field: 'salary', direction: 'desc' },
          ],
        }}
      />
    </>
  )
}
