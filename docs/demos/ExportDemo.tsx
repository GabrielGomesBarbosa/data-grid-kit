import { useRef, useState } from 'react'
import { Grid, type GridApi, type UIColumnDef } from '../../src'
import { makeEmployees, type Employee } from '../data'

const rows = [
  ...makeEmployees(30),
  // text that spreadsheets would execute as a formula, and a value with a comma and quotes
  { ...makeEmployees(1, 7)[0]!, id: 9001, name: '=HYPERLINK("http://evil.test","click")', email: 'a,b@example.com' },
]

const columns: UIColumnDef<Employee>[] = [
  { field: 'id', headerName: 'ID', type: 'number', width: 80 },
  { field: 'name', headerName: 'Name', width: 220 },
  { field: 'email', headerName: 'Email', width: 200 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 110 },
  { field: 'hired', headerName: 'Hired', type: 'date', width: 120 },
]

export default function ExportDemo() {
  const api = useRef<GridApi<Employee>>()
  const [csv, setCsv] = useState('')
  return (
    <>
      <p>
        <button type="button" onClick={() => setCsv(api.current?.getCsv({ bom: false }).split('\r\n').slice(0, 6).join('\n') ?? '')}>
          Preview CSV (first rows)
        </button>{' '}
        <span className="muted">Use the toolbar's Export menu to download the real file. Sort or filter first: the export follows the view.</span>
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={280}
        toolbar
        pagination={false}
        csvFileName="employees.csv"
        onReady={(a) => (api.current = a)}
      />
      {csv && <pre className="preview">{csv}</pre>}
    </>
  )
}
