import { useEffect, useRef } from 'react'
import { Grid, type GridApi, type UIColumnDef } from 'data-grid-kit'
import 'data-grid-kit/styles.css'
import type { Person } from './data'
import type { AdapterProps } from './types'

const columns: UIColumnDef<Person>[] = [
  { field: 'name', headerName: 'Name', width: 160 },
  { field: 'email', headerName: 'Email', width: 260 },
  { field: 'city', headerName: 'City', width: 130 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'age', headerName: 'Age', type: 'number', width: 90 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 120 },
  { field: 'joined', headerName: 'Joined', type: 'date', width: 130 },
  { field: 'active', headerName: 'Active', type: 'boolean', width: 100 },
]

const text = (el: Element | null) => el?.textContent ?? ''

export default function GridKitAdapter({ rows, onReady }: AdapterProps) {
  const api = useRef<GridApi<Person> | null>(null)
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    onReady({
      sort: (field, direction) => api.current!.setSortModel([{ field, direction }]),
      quickFilter: (t) => api.current!.setQuickFilter(t),
      scroller: () => host.current!.querySelector('.gk-scroller'),
      signature: () => [0, 1, 2].map((i) => text(host.current!.querySelector(`.gk-row[data-rowindex="${i}"] .gk-cell`))).join('|'),
      rowElements: () => host.current!.querySelectorAll('.gk-row').length,
    })
  }, [onReady])
  return (
    <div ref={host} style={{ height: 600 }}>
      <Grid<Person> rows={rows} columns={columns} rowHeight={36} headerHeight={40} height={600} pagination={false} onReady={(a) => (api.current = a)} />
    </div>
  )
}
