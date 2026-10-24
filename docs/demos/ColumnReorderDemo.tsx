import { Grid, type UIColumnDef } from '../../src'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(100)

const columns: UIColumnDef<Employee>[] = [
  { field: 'id', headerName: 'ID (fixed place)', type: 'number', width: 130, reorderable: false },
  { field: 'name', headerName: 'Name', width: 150 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'role', headerName: 'Role', width: 120 },
  { field: 'country', headerName: 'Country', width: 120 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 110 },
  { field: 'age', headerName: 'Age', type: 'number', width: 80 },
  { field: 'email', headerName: 'Email', width: 220 },
]

export default function ColumnReorderDemo() {
  return (
    <>
      <p className="muted">
        Drag a header to move it; the line shows where it will land and the edges auto-scroll. A column only moves inside its own group (pinned
        left, scrolling, pinned right). No mouse? Use <strong>Move left / Move right</strong> in the ⋮ menu.
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={300}
        pagination={false}
        initialState={{ pinnedColumns: { left: ['name', 'team'], right: [] } }}
      />
    </>
  )
}
