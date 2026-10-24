import { formatCellValue, useGrid, type ColumnDef } from 'data-grid-kit/core'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(500)

const columns: ColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name' },
  { field: 'team', headerName: 'Team' },
  { field: 'salary', headerName: 'Salary', type: 'number' },
]

/** No data-grid-kit UI at all: your own <table>, driven by the headless core. */
export default function HeadlessDemo() {
  const grid = useGrid<Employee>({
    rows,
    columns,
    initialState: { paginationModel: { page: 0, pageSize: 6 } },
  })
  const { api, state, layout } = grid
  const sortOf = (field: string) => state.sortModel.find((s) => s.field === field)?.direction
  const { page, pageSize } = state.paginationModel
  const pages = Math.ceil(grid.result.rootCount / pageSize)

  return (
    <div>
      <input
        type="search"
        placeholder="Filter…"
        aria-label="Filter"
        value={state.filterModel.quickFilter ?? ''}
        onChange={(e) => api.setQuickFilter(e.target.value)}
      />
      <table className="plain">
        <thead>
          <tr>
            {layout.all.map((c) => (
              <th key={c.field} aria-sort={sortOf(c.field) === 'asc' ? 'ascending' : sortOf(c.field) === 'desc' ? 'descending' : 'none'}>
                <button type="button" onClick={() => api.toggleSort(c.field)}>
                  {c.headerName} {sortOf(c.field) === 'asc' ? '↑' : sortOf(c.field) === 'desc' ? '↓' : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((r) => (
            <tr key={r.id}>
              {layout.all.map((c) => (
                <td key={c.field}>{formatCellValue(c, r.row!)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        {grid.result.filteredCount} rows · page {page + 1} of {Math.max(1, pages)}{' '}
        <button type="button" disabled={page === 0} onClick={() => api.setPage(page - 1)}>
          Prev
        </button>{' '}
        <button type="button" disabled={page >= pages - 1} onClick={() => api.setPage(page + 1)}>
          Next
        </button>
      </p>
    </div>
  )
}
