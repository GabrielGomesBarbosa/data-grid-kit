'use client'

import { Grid, type DataSource, type UIColumnDef } from 'data-grid-kit'
import type { Employee } from '../lib/data'

const columns: UIColumnDef<Employee>[] = [
  { field: 'id', headerName: 'ID', width: 90, type: 'number' },
  { field: 'name', headerName: 'Name', width: 170 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'role', headerName: 'Role', width: 120 },
  { field: 'country', headerName: 'Country', width: 120 },
  { field: 'salary', headerName: 'Salary', width: 120, type: 'number', valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
]

// The grid asks for the rows it needs; the Route Handler at /api/employees answers.
const dataSource: DataSource<Employee> = {
  async getRows({ start, end, sortModel, filterModel, signal }) {
    const params = new URLSearchParams({ start: String(start), end: String(end) })
    if (sortModel[0]) {
      params.set('sort', sortModel[0].field)
      params.set('dir', sortModel[0].direction)
    }
    if (filterModel.quickFilter) params.set('q', filterModel.quickFilter)
    const res = await fetch(`/api/employees?${params}`, { signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
}

export function ServerGrid() {
  return <Grid<Employee> columns={columns} height={460} toolbar pagination={false} dataSource={dataSource} dataSourceChunkSize={100} />
}
