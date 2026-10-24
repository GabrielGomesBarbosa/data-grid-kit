import { useMemo, useState } from 'react'
import { Grid, type UIColumnDef } from 'data-grid-kit'
import { RequestLog } from '../components/RequestLog'
import { createFakeServer } from '../fakeServer'
import type { Employee } from '../data'

const columns: UIColumnDef<Employee>[] = [
  { field: 'id', headerName: 'ID', type: 'number', width: 90 },
  { field: 'name', headerName: 'Name', width: 150 },
  { field: 'team', headerName: 'Team', width: 110 },
  { field: 'country', headerName: 'Country', width: 110 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 110, valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { field: 'age', headerName: 'Age', type: 'number', width: 80 },
]

export default function ServerScrollDemo() {
  const [knownCount, setKnownCount] = useState(true)
  const server = useMemo(() => createFakeServer(200_000, knownCount), [knownCount])
  return (
    <div className="split">
      <div>
        <p>
          <label>
            <input type="checkbox" checked={knownCount} onChange={(e) => setKnownCount(e.target.checked)} /> The server knows the row count
          </label>{' '}
          <span className="muted">
            Drag the scrollbar around: rows you skip over are never requested. Untick it to see infinite scrolling (no count).
          </span>
        </p>
        <Grid
          // the key remounts the grid when the server changes
          key={String(knownCount)}
          columns={columns}
          height={360}
          toolbar
          pagination={false}
          dataSource={server.source}
          // blocks of 100 rows are fetched, cached and kept; the 400 nearest stay in memory
          dataSourceChunkSize={100}
        />
      </div>
      <RequestLog server={server} />
    </div>
  )
}
