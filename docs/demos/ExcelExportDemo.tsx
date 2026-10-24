import { useRef, useState } from 'react'
import { Grid, type GridApi, type UIColumnDef } from '../../src'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(100_000)
const money = (v: unknown) => `$${Number(v).toLocaleString()}`

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 170 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'role', headerName: 'Role', width: 120 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 130, valueFormatter: money },
  { field: 'age', headerName: 'Age', type: 'number', width: 90 },
  { field: 'hired', headerName: 'Hired', type: 'date', width: 120 },
  { field: 'remote', headerName: 'Remote', type: 'boolean', width: 100 },
]

export default function ExcelExportDemo() {
  const api = useRef<GridApi<Employee>>()
  const [status, setStatus] = useState('')

  const run = async (label: string, options: Parameters<GridApi<Employee>['exportXlsx']>[0] = {}) => {
    const started = performance.now()
    setStatus(`${label}: writing…`)
    try {
      await api.current!.exportXlsx({
        fileName: 'employees.xlsx',
        // salary keeps its number format in Excel; dates default to yyyy-mm-dd
        numFmts: { salary: '$#,##0' },
        autoFilter: true,
        onProgress: (n) => setStatus(`${label}: ${n.toLocaleString()} rows written…`),
        ...options,
      })
      setStatus(`${label}: done in ${Math.round(performance.now() - started)} ms`)
    } catch (e) {
      setStatus(`${label}: ${(e as Error).message}`)
    }
  }

  return (
    <>
      <p>
        <button type="button" onClick={() => run('Excel')}>
          Download .xlsx
        </button>{' '}
        <button type="button" onClick={() => run('Formatted', { formatted: true })}>
          As formatted text
        </button>{' '}
        <button type="button" onClick={() => run('Selected', { selectedOnly: true })}>
          Selected rows only
        </button>{' '}
        <span className="muted" role="status">
          {status || 'Group, sort or filter first: the file follows what the grid shows.'}
        </span>
      </p>
      <Grid
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        height={380}
        toolbar
        checkboxSelection
        initialState={{ rowGroupingModel: ['team'], aggregationModel: { salary: 'avg', age: 'avg' } }}
        onReady={(a) => (api.current = a)}
      />
    </>
  )
}
