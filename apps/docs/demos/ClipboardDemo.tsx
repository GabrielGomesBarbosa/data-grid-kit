import { useRef, useState } from 'react'
import { Grid, type ApplyResult, type GridApi, type UIColumnDef } from 'data-grid-kit'
import { COUNTRIES, ROLES, makeEmployees, type Employee } from '../data'

const rows = makeEmployees(200)

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 140, editable: true },
  { field: 'role', headerName: 'Role', type: 'singleSelect', valueOptions: ROLES, width: 120, editable: true },
  { field: 'country', headerName: 'Country', type: 'singleSelect', valueOptions: COUNTRIES, width: 120, editable: true },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 110, editable: true },
  { field: 'hired', headerName: 'Hired', type: 'date', width: 130, editable: true },
  { field: 'remote', headerName: 'Remote', type: 'boolean', width: 100, editable: true },
  { field: 'id', headerName: 'ID (read-only)', type: 'number', width: 120 },
]

export default function ClipboardDemo() {
  const api = useRef<GridApi<Employee>>()
  const [text, setText] = useState('Ana\tDesigner\tBrazil\t5200\t2024-03-01\ttrue\nBruno\tManager\tPortugal\tabc\t2023-12-24\tno')
  const [result, setResult] = useState<ApplyResult | null>(null)

  return (
    <>
      <p className="muted">
        Select cells, then Ctrl/Cmd+C, X and V work with other apps (try a spreadsheet). The box below shows the same text the clipboard carries, and
        lets you paste text into the grid without leaving the page. Drag the small square at the corner of a selection to fill.
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={300}
        pagination={false}
        cellSelection
        onReady={(a) => (api.current = a)}
        processRowUpdate={(next) => next}
      />
      <p>
        <button type="button" onClick={() => setText(api.current?.copySelection() ?? '')}>
          Copy selection → box
        </button>{' '}
        <button
          type="button"
          onClick={async () => setResult((await api.current?.pasteText(text)) ?? null)}
          title="Pastes at the selection, or at the focused cell"
        >
          Paste box → grid
        </button>{' '}
        {result && (
          <span className="muted" aria-live="polite">
            {result.applied} written, {result.skipped} skipped, {result.rejected} refused
          </span>
        )}
      </p>
      <textarea aria-label="Clipboard text" value={text} onChange={(e) => setText(e.target.value)} rows={4} style={{ width: '100%', font: '12px ui-monospace, monospace' }} />
      <p className="muted">
        The second line has a value that isn't a number (<code>abc</code>) and a boolean written as <code>no</code>: invalid cells are skipped and
        counted, the rest is applied. ID is read-only, so it is never written.
      </p>
    </>
  )
}
