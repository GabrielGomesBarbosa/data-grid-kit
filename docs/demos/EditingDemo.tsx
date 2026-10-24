import { useState } from 'react'
import { Grid, type UIColumnDef } from '../../src'
import { COUNTRIES, ROLES, makeEmployees, type Employee } from '../data'

const rows = makeEmployees(100)

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 150, editable: true },
  { field: 'role', headerName: 'Role', type: 'singleSelect', valueOptions: ROLES, width: 130, editable: true },
  { field: 'country', headerName: 'Country', type: 'singleSelect', valueOptions: COUNTRIES, width: 130, editable: true },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 120, editable: true },
  { field: 'hired', headerName: 'Hired', type: 'date', width: 140, editable: true },
  { field: 'remote', headerName: 'Remote', type: 'boolean', width: 100, editable: true },
  { field: 'id', headerName: 'ID (read-only)', type: 'number', width: 120 },
]

export default function EditingDemo() {
  const [log, setLog] = useState<string[]>([])
  const note = (line: string) => setLog((l) => [line, ...l].slice(0, 4))

  return (
    <>
      <p className="muted">
        Double-click, press Enter / F2, or just start typing. Enter saves and moves down, Tab saves and moves right, Escape discards.
        Salaries below 1000 are rejected by <code>processRowUpdate</code>.
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={300}
        pagination={false}
        // the validated row is what the grid keeps; throwing keeps the editor open
        processRowUpdate={async (next, prev) => {
          await new Promise((r) => setTimeout(r, 150)) // pretend to call a server
          if (next.salary < 1000) throw new Error('Salary must be at least 1000')
          note(`saved #${next.id}`)
          return next
        }}
        onProcessRowUpdateError={(e) => note(`rejected: ${(e as Error).message}`)}
      />
      <ul className="log" aria-live="polite">
        {log.map((l, i) => (
          <li key={`${i}-${l}`}>{l}</li>
        ))}
      </ul>
    </>
  )
}
