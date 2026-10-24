import { useRef, useState } from 'react'
import { Grid, type GridApi, type UIColumnDef } from '../../src'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(300)

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 150 },
  { field: 'team', headerName: 'Team', width: 110 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 110, editable: true },
  { field: 'age', headerName: 'Age', type: 'number', width: 90, editable: true },
  { field: 'country', headerName: 'Country', width: 120 },
  { field: 'id', headerName: 'ID', type: 'number', width: 90 },
]

export default function CellSelectionDemo() {
  const api = useRef<GridApi<Employee>>()
  const [stats, setStats] = useState({ cells: 0, numbers: 0, sum: 0 })

  // a spreadsheet-style status bar, built only from the public API
  const update = () => {
    const a = api.current
    if (!a) return
    const cells = a.getCellRects().reduce((n, r) => n + (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1), 0)
    const nums = a
      .copySelection()
      .split(/[\t\n]/)
      .filter((t) => t.trim() !== '' && Number.isFinite(Number(t)))
      .map(Number)
    setStats({ cells, numbers: nums.length, sum: nums.reduce((s, n) => s + n, 0) })
  }

  return (
    <>
      <p className="muted">
        Drag across cells, Shift+click or Shift+arrows to extend, Ctrl/Cmd+click to add another block, Ctrl/Cmd+A for everything, Esc to clear.{' '}
        <strong>
          {stats.cells.toLocaleString()} cells · {stats.numbers} numbers · sum {stats.sum.toLocaleString()}
        </strong>
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={320}
        pagination={false}
        cellSelection
        onReady={(a) => (api.current = a)}
        onStateChange={(next, prev) => {
          if (next.cellSelection !== prev.cellSelection || next.focusedCell !== prev.focusedCell) queueMicrotask(update)
        }}
      />
    </>
  )
}
