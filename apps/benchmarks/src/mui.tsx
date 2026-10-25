import { useEffect, useRef } from 'react'
import { DataGridPro, useGridApiRef, type GridColDef } from '@mui/x-data-grid-pro'
import type { Person } from './data'
import type { AdapterProps } from './types'

const columns: GridColDef<Person>[] = [
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

export default function MuiAdapter({ rows, onReady }: AdapterProps) {
  const apiRef = useGridApiRef()
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    onReady({
      sort: (field, direction) => apiRef.current!.setSortModel([{ field, sort: direction }]),
      quickFilter: (t) => apiRef.current!.setQuickFilterValues(t.split(' ').filter(Boolean)),
      scroller: () => host.current!.querySelector('.MuiDataGrid-virtualScroller'),
      signature: () => [0, 1, 2].map((i) => text(host.current!.querySelector(`.MuiDataGrid-row[data-rowindex="${i}"] .MuiDataGrid-cell`))).join('|'),
      rowElements: () => host.current!.querySelectorAll('.MuiDataGrid-row').length,
    })
  }, [onReady, apiRef])
  return (
    <div ref={host} style={{ height: 600 }}>
      <DataGridPro rowHeight={36} columnHeaderHeight={40} rows={rows} columns={columns} apiRef={apiRef} hideFooter disableColumnMenu />
    </div>
  )
}
