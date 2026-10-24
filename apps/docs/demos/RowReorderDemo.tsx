import { useState } from 'react'
import { Grid, moveItem, type UIColumnDef } from 'data-grid-kit'

interface Task {
  id: number
  title: string
  owner: string
  points: number
}

const initial: Task[] = [
  { id: 1, title: 'Design the schema', owner: 'Ana', points: 5 },
  { id: 2, title: 'Write the importer', owner: 'Bruno', points: 8 },
  { id: 3, title: 'Review the pull request', owner: 'Carla', points: 2 },
  { id: 4, title: 'Fix flaky test', owner: 'Davi', points: 3 },
  { id: 5, title: 'Update the docs', owner: 'Eva', points: 1 },
  { id: 6, title: 'Plan the release', owner: 'Ana', points: 3 },
  { id: 7, title: 'Triage the backlog', owner: 'Bruno', points: 2 },
  { id: 8, title: 'Profile the slow query', owner: 'Carla', points: 5 },
]

const columns: UIColumnDef<Task>[] = [
  { field: 'title', headerName: 'Task', width: 240 },
  { field: 'owner', headerName: 'Owner', width: 120 },
  { field: 'points', headerName: 'Points', type: 'number', width: 100 },
]

export default function RowReorderDemo() {
  // your rows are the source of truth: apply the same move the grid reports
  const [rows, setRows] = useState(initial)
  const [log, setLog] = useState('')

  return (
    <>
      <p className="muted">
        Drag a row by its grip ⋮⋮, or focus a cell and press Alt+Shift+↑ / ↓. Esc cancels a drag. Sorting turns reordering off (the order would be
        decided by the sort), so try clearing it.
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={340}
        pagination={false}
        rowReordering
        onRowOrderChange={({ row, oldIndex, targetIndex }) => {
          setRows((current) => moveItem(current, oldIndex, targetIndex))
          setLog(`“${row.title}” moved from position ${oldIndex + 1} to ${targetIndex + 1}`)
        }}
      />
      <p aria-live="polite">
        <strong>{log || 'Nothing moved yet.'}</strong>
      </p>
      <p className="muted">Your array now reads: {rows.map((r) => r.id).join(', ')}</p>
    </>
  )
}
