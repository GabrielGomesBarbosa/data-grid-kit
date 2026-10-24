import { Grid, type UIColumnDef } from '../../src'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(200)

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 150 },
  // type drives alignment, filter operators, the editor and CSV output
  { field: 'salary', headerName: 'Salary', type: 'number', width: 120, valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { field: 'hired', headerName: 'Hired', type: 'date', width: 120 },
  // valueGetter computes a column from the row; sorting and filtering use its value
  { field: 'seniority', headerName: 'Seniority', width: 120, valueGetter: (r) => (r.age >= 45 ? 'Senior' : r.age >= 30 ? 'Mid' : 'Junior') },
  // renderCell takes over the display (sorting still uses the raw value)
  {
    field: 'remote',
    headerName: 'Remote',
    type: 'boolean',
    width: 110,
    renderCell: ({ value }) => (
      <span style={{ color: value ? '#16a34a' : '#94a3b8' }}>{value ? '● Remote' : '○ Office'}</span>
    ),
  },
  { field: 'email', headerName: 'Email (not sortable)', width: 220, sortable: false, resizable: false },
  { field: 'id', headerName: 'ID (hidden)', hidden: true },
]

export default function ColumnsDemo() {
  return <Grid rows={rows} columns={columns} height={340} toolbar pagination={false} />
}
