import { Grid } from 'data-grid-kit'
import { makeEmployees } from '../../lib/data'

// A Server Component importing the grid directly: no wrapper file with "use client" is needed, because the package
// marks its entry as a Client Module. Props must be serializable (plain columns and rows, no functions).
export default function Page() {
  const rows = makeEmployees(200)
  return (
    <>
      <p className="note">
        A Server Component that imports <code>Grid</code> straight from <code>data-grid-kit</code>.
      </p>
      <Grid
        rows={rows}
        columns={[
          { field: 'name', headerName: 'Name', width: 170 },
          { field: 'team', headerName: 'Team', width: 120 },
          { field: 'salary', headerName: 'Salary', type: 'number', width: 120 },
        ]}
        height={320}
        pagination={false}
      />
    </>
  )
}
