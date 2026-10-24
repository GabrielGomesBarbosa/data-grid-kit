import { useRef } from 'react'
import { Grid, type GridApi, type UIColumnDef } from 'data-grid-kit'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(200)

const columns: UIColumnDef<Employee>[] = [
  // flex shares the width the other columns leave free (here: all of it, between 200px and 320px)
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 200, maxWidth: 320, description: 'The full name of the person' },
  // type drives alignment, filter operators, the editor and CSV output
  { field: 'salary', headerName: 'Salary', type: 'number', width: 120, valueFormatter: (v) => `$${Number(v).toLocaleString()}`, cellClassName: ({ value }) => ((value as number) > 12000 ? 'demo-high' : undefined) },
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
  // renderHeader replaces the title; the sort and menu buttons stay
  { field: 'email', headerName: 'Email (not sortable)', width: 220, sortable: false, renderHeader: () => <em>Email ✉</em> },
  // an actions column: buttons per row, some of them in a ⋮ menu
  {
    field: 'actions',
    headerName: '',
    type: 'actions',
    width: 90,
    getActions: ({ row }) => [
      { label: `Message ${row.name}`, icon: '✉', onClick: () => alert(`Message to ${row.email}`) },
      { label: 'Copy email', showInMenu: true, onClick: () => void navigator.clipboard?.writeText(row.email) },
      { label: 'Remove', showInMenu: true, disabled: true },
    ],
  },
  { field: 'id', headerName: 'ID (hidden)', hidden: true },
]

export default function ColumnsDemo() {
  const api = useRef<GridApi<Employee>>()
  return (
    <>
      <p>
        <button type="button" className="demo-chip" onClick={() => api.current?.autosizeColumns({ columns: ['salary', 'hired', 'seniority', 'email'] })}>
          Fit columns to their content
        </button>{' '}
        <span className="muted">or double-click a column's divider</span>
      </p>
      <Grid rows={rows} columns={columns} height={340} toolbar densitySelector pagination={false} onReady={(a) => (api.current = a)} getRowClassName={({ row }) => (row?.age === 30 ? 'demo-age-30' : undefined)} />
    </>
  )
}
