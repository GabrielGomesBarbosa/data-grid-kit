import { Grid, type UIColumnDef } from '../../src'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(300)

const wide: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 170 },
  ...Array.from({ length: 14 }, (_, i) => ({
    field: `metric${i}`,
    headerName: `Metric ${i + 1}`,
    type: 'number' as const,
    width: 120,
    valueGetter: (r: Employee) => ((r.id * (i + 3)) % 997) + i,
  })),
  { field: 'salary', headerName: 'Salary', type: 'number', width: 120 },
]

export default function PinningDemo() {
  return (
    <Grid
      rows={rows}
      columns={wide}
      height={320}
      pagination={false}
      // pin from code with initialState, or at runtime from the column menu (⋮)
      initialState={{ pinnedColumns: { left: ['name'], right: ['salary'] } }}
    />
  )
}
