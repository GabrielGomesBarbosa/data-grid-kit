import { useState } from 'react'
import { Grid, type GridState, type UIColumnDef } from '../../src'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(300)

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 180 },
  { field: 'team', headerName: 'Team', width: 130 },
  { field: 'role', headerName: 'Role', width: 130 },
]

export default function SelectionDemo() {
  const [selected, setSelected] = useState<GridState['selection']>([])
  return (
    <>
      <p className="muted" aria-live="polite">
        {selected.length} selected{selected.length > 0 && `: ${selected.slice(0, 8).join(', ')}${selected.length > 8 ? '…' : ''}`}
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={300}
        pagination={false}
        checkboxSelection
        onStateChange={(next, prev) => {
          if (next.selection !== prev.selection) setSelected(next.selection)
        }}
      />
    </>
  )
}
