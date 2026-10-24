import { useMemo, useRef } from 'react'
import { Grid, type GridApi, type UIColumnDef } from '../../src'
import { RequestLog } from '../components/RequestLog'
import { createFakeServer } from '../fakeServer'
import type { Employee } from '../data'

const columns: UIColumnDef<Employee>[] = [
  { field: 'id', headerName: 'ID', type: 'number', width: 90 },
  { field: 'name', headerName: 'Name', width: 150, editable: true },
  { field: 'team', headerName: 'Team', width: 110 },
  { field: 'role', headerName: 'Role', width: 110 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 110, valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { field: 'hired', headerName: 'Hired', type: 'date', width: 120 },
]

export default function ServerPagesDemo() {
  const server = useMemo(() => createFakeServer(100_000), [])
  const api = useRef<GridApi<Employee>>()
  return (
    <div className="split">
      <div>
        <p>
          <button type="button" onClick={() => api.current?.refreshData()}>
            Refresh
          </button>{' '}
          <span className="muted">Sort, filter, change page, then go back to a page you've seen.</span>
        </p>
        <Grid
          rows={undefined}
          columns={columns}
          height={360}
          toolbar
          // the whole contract: a function that returns the rows between `start` and `end` for this sort and filter
          dataSource={server.source}
          initialState={{ paginationModel: { page: 0, pageSize: 25 } }}
          dataSourceRevalidateMs={0}
          onReady={(a) => (api.current = a)}
        />
      </div>
      <RequestLog server={server} />
    </div>
  )
}
