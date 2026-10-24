import { useState } from 'react'
import { Grid, type GridState, type UIColumnDef } from 'data-grid-kit'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(300)

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 180 },
  { field: 'team', headerName: 'Team', width: 130 },
  { field: 'role', headerName: 'Role', width: 130 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 110 },
]

export default function SelectionDemo() {
  const [selected, setSelected] = useState<GridState['selection']>([])
  const [byClick, setByClick] = useState(true)
  const [multiple, setMultiple] = useState(true)
  return (
    <>
      <p>
        <label style={{ marginRight: 16 }}>
          <input type="checkbox" checked={byClick} onChange={(e) => setByClick(e.target.checked)} /> rowSelectionOnClick
        </label>
        <label>
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} /> multipleRowSelection
        </label>
      </p>
      <p className="muted" aria-live="polite">
        {selected.length} selected{selected.length > 0 && `: ${selected.slice(0, 8).join(', ')}${selected.length > 8 ? '…' : ''}`}
        {' · '}rows of the Platform team cannot be selected (isRowSelectable)
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={300}
        pagination={false}
        checkboxSelection
        rowSelectionOnClick={byClick}
        multipleRowSelection={multiple}
        isRowSelectable={({ row }) => row.team !== 'Platform'}
        onStateChange={(next, prev) => {
          if (next.selection !== prev.selection) setSelected(next.selection)
        }}
      />
    </>
  )
}
