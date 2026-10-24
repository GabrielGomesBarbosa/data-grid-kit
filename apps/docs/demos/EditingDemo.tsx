import { useState } from 'react'
import { Grid, type UIColumnDef } from 'data-grid-kit'
import { COUNTRIES, ROLES, makeEmployees, type Employee } from '../data'

const rows = makeEmployees(100)

const columns: UIColumnDef<Employee>[] = [
  // validate: return a message to refuse the value (it shows on the editor, and the edit stays open); it may be async
  { field: 'name', headerName: 'Name', width: 150, editable: true, validate: ({ value }) => (String(value).trim() === '' ? 'A name is required' : null) },
  { field: 'role', headerName: 'Role', type: 'singleSelect', valueOptions: ROLES, width: 130, editable: true },
  { field: 'country', headerName: 'Country', type: 'singleSelect', valueOptions: COUNTRIES, width: 130, editable: true },
  {
    field: 'salary',
    headerName: 'Salary',
    type: 'number',
    width: 120,
    editable: true,
    validate: async ({ value }) => {
      await new Promise((r) => setTimeout(r, 120)) // pretend to ask a server
      return Number(value) < 1000 ? 'At least 1000' : null
    },
  },
  { field: 'hired', headerName: 'Hired', type: 'date', width: 140, editable: true },
  { field: 'remote', headerName: 'Remote', type: 'boolean', width: 100, editable: true },
  { field: 'id', headerName: 'ID (read-only)', type: 'number', width: 120 },
]

export default function EditingDemo() {
  const [log, setLog] = useState<string[]>([])
  const [mode, setMode] = useState<'cell' | 'row'>('cell')
  const note = (line: string) => setLog((l) => [line, ...l].slice(0, 4))

  return (
    <>
      <p>
        {(['cell', 'row'] as const).map((m) => (
          <label key={m} style={{ marginRight: 16 }}>
            <input type="radio" name="edit-mode" checked={mode === m} onChange={() => setMode(m)} /> editMode: '{m}'
          </label>
        ))}
      </p>
      <p className="muted">
        {mode === 'cell'
          ? 'Double-click, press Enter / F2, or just start typing. Enter saves and moves down, Tab saves and moves right, Escape discards.'
          : 'Double-click a row: every editable cell opens. Tab moves between them, Enter or a click outside the row saves it, Escape discards.'}{' '}
        A name cannot be empty and a salary must be at least 1000 (<code>validate</code>).
      </p>
      <Grid
        key={mode}
        rows={rows}
        columns={columns}
        height={300}
        pagination={false}
        editMode={mode}
        // the validated row is what the grid keeps; throwing keeps the editor open
        processRowUpdate={async (next) => {
          await new Promise((r) => setTimeout(r, 150)) // pretend to call a server
          note(`saved #${next.id}`)
          return next
        }}
        onProcessRowUpdateError={(e) => note(`rejected: ${(e as Error).message}`)}
        onCellEditStop={({ id, field, reason, cancelled }) => void (cancelled && note(`cell ${field} of #${id}: ${reason}`))}
        onRowEditStop={({ id, reason, cancelled }) => void (cancelled && note(`row #${id}: ${reason}`))}
      />
      <ul className="log" aria-live="polite">
        {log.map((l, i) => (
          <li key={`${i}-${l}`}>{l}</li>
        ))}
      </ul>
    </>
  )
}
