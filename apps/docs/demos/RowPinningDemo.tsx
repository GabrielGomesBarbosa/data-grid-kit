import { Grid, type UIColumnDef } from 'data-grid-kit'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(2000)

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 190 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'role', headerName: 'Role', width: 120 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 120 },
  { field: 'age', headerName: 'Age', type: 'number', width: 80 },
]

export default function RowPinningDemo() {
  return (
    <>
      <p className="muted">
        Hover a row and use ▲ / ▼ to pin it to the top or bottom, ✕ to release it. Try sorting, filtering or scrolling: pinned rows stay put.
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={340}
        pagination={false}
        toolbar
        rowPinning
        // or pin from code: initialState, or api.pinRow(id, 'top' | 'bottom' | null)
        initialState={{ pinnedRows: { top: [1], bottom: [2000] } }}
      />
    </>
  )
}
