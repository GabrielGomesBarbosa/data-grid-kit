import { useRef, useState } from 'react'
import { Grid, type CustomAggregation, type GridApi, type UIColumnDef } from 'data-grid-kit'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(20_000)

// a custom function gets every value of the group; its name is what the model refers to
const aggregationFunctions: Record<string, CustomAggregation<Employee>> = {
  spread: {
    label: 'spread',
    columnTypes: ['number'],
    apply: ({ values }) => {
      const n = values.filter((v): v is number => typeof v === 'number')
      return n.length ? Math.max(...n) - Math.min(...n) : null
    },
  },
}

const money = (v: unknown) => `$${Number(v).toLocaleString()}`

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 210 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'role', headerName: 'Role', width: 120 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 150, valueFormatter: money },
  { field: 'age', headerName: 'Age', type: 'number', width: 130 },
  { field: 'hired', headerName: 'Hired', type: 'date', width: 150 },
]

const FUNCTIONS = ['sum', 'avg', 'min', 'max', 'count', 'size', 'spread']

export default function AggregationDemo() {
  const api = useRef<GridApi<Employee>>()
  const [salary, setSalary] = useState('sum')
  const [age, setAge] = useState('avg')
  const [grouped, setGrouped] = useState(true)

  const pick = (field: string, set: (v: string) => void) => (
    <select
      aria-label={`${field} aggregation`}
      value={field === 'salary' ? salary : age}
      onChange={(e) => {
        set(e.target.value)
        api.current?.setAggregation(field, e.target.value)
      }}
    >
      {FUNCTIONS.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </select>
  )

  return (
    <>
      <p>
        Salary: {pick('salary', setSalary)} Age: {pick('age', setAge)}{' '}
        <label>
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => {
              setGrouped(e.target.checked)
              api.current?.setRowGroupingModel(e.target.checked ? ['team', 'role'] : [])
            }}
          />{' '}
          group by team → role
        </label>
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={360}
        pagination={false}
        toolbar
        aggregationFunctions={aggregationFunctions}
        initialState={{
          rowGroupingModel: ['team', 'role'],
          aggregationModel: { salary: 'sum', age: 'avg', hired: 'min' },
        }}
        onReady={(a) => (api.current = a)}
      />
    </>
  )
}
