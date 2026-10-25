import { useEffect, useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi } from 'ag-grid-community'
import type { Person } from './data'
import type { AdapterProps } from './types'

ModuleRegistry.registerModules([AllCommunityModule])

const columns: ColDef<Person>[] = [
  { field: 'name', headerName: 'Name', width: 160 },
  { field: 'email', headerName: 'Email', width: 260 },
  { field: 'city', headerName: 'City', width: 130 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'age', headerName: 'Age', type: 'numericColumn', width: 90 },
  { field: 'salary', headerName: 'Salary', type: 'numericColumn', width: 120 },
  { field: 'joined', headerName: 'Joined', width: 130, valueFormatter: (p) => (p.value as Date).toLocaleDateString() },
  { field: 'active', headerName: 'Active', width: 100, cellDataType: 'boolean' },
]

const ROW = 36
const HEADER = 40
const text = (el: Element | null) => el?.textContent ?? ''

export default function AgGridAdapter({ rows, onReady }: AdapterProps) {
  const api = useRef<GridApi<Person> | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true }), [])
  useEffect(() => {
    onReady({
      sort: (field, direction) => api.current!.applyColumnState({ state: [{ colId: field, sort: direction }], defaultState: { sort: null } }),
      quickFilter: (t) => api.current!.setGridOption('quickFilterText', t),
      scroller: () => host.current!.querySelector('.ag-grid-viewport'),
      signature: () => [0, 1, 2].map((i) => text(host.current!.querySelector(`.ag-row[row-index="${i}"] .ag-cell`))).join('|'),
      rowElements: () => host.current!.querySelectorAll('.ag-row').length,
    })
  }, [onReady])
  return (
    <div ref={host} style={{ height: 600 }}>
      <AgGridReact<Person> theme={themeQuartz} rowHeight={ROW} headerHeight={HEADER} rowData={rows} columnDefs={columns} defaultColDef={defaultColDef} onGridReady={(e) => (api.current = e.api)} getRowId={(p) => String(p.data.id)} />
    </div>
  )
}
