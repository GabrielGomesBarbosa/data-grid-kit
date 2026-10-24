// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Grid } from '../ui/Grid'
import { useGrid } from './useGrid'

// Server-side rendering (Next.js and friends): no DOM exists, effects don't run, and React needs a server snapshot
// for every external store. These tests render in a plain Node environment.
const rows = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}`, age: 20 + i }))
const columns = [{ field: 'name' }, { field: 'age', type: 'number' as const }]

describe('server-side rendering', () => {
  it('renders the first rows of a client-side grid into the HTML, without warnings', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const html = renderToString(<Grid rows={rows} columns={columns} getRowId={(r) => r.id} toolbar initialState={{ paginationModel: { page: 0, pageSize: 10 } }} />)
    expect(html).toContain('role="grid"')
    expect(html).toContain('Person 1')
    expect(html).toContain('Person 10')
    expect(html).not.toContain('Person 11') // the page size applies on the server too
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('renders a server-side-data grid (skeleton slots, nothing requested)', () => {
    const getRows = vi.fn(async () => ({ rows: [], rowCount: 0 }))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const html = renderToString(<Grid columns={columns} dataSource={{ getRows }} pagination={false} />)
    expect(html).toContain('role="grid"')
    expect(getRows).not.toHaveBeenCalled() // requests start in effects, which never run on the server
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('the headless hook can be called on the server too', () => {
    function Probe() {
      const grid = useGrid({ rows, columns, getRowId: (r) => r.id, pagination: false })
      return <span>{grid.rows.length}</span>
    }
    expect(renderToString(<Probe />)).toContain('50')
  })

  it('pivot, grouping and pinned rows render on the server', () => {
    const html = renderToString(
      <Grid rows={rows} columns={columns} getRowId={(r) => r.id} pagination={false} initialState={{ rowGroupingModel: ['age'], expandAllByDefault: true }} />,
    )
    expect(html).toContain('role="grid"')
  })
})
