import { useCallback, useMemo, useState } from 'react'
import { Grid, type UIColumnDef } from 'data-grid-kit'
import { makeEmployees, type Employee } from '../data'

const SENTENCE = 'Works across teams, writes the docs nobody asked for and reviews pull requests early. '

interface Person extends Employee {
  notes: string
}

const rows: Person[] = makeEmployees(20_000).map((e) => ({ ...e, notes: SENTENCE.repeat(1 + (e.id % 4)) }))

const columns: UIColumnDef<Person>[] = [
  { field: 'name', headerName: 'Name', width: 150 },
  { field: 'team', headerName: 'Team', width: 110 },
  { field: 'notes', headerName: 'Notes', width: 360 },
]

type Mode = 'fixed' | 'function' | 'auto'

/** The same data three ways: one height for all, a height per row, and rows that fit their content. */
export default function RowHeightDemo() {
  const [mode, setMode] = useState<Mode>('auto')
  // keep its identity: the grid reads it for every row whenever it changes
  const byFunction = useCallback(({ row }: { row: Person | undefined }) => (row && row.id % 4 === 0 ? 84 : null), [])
  const auto = useCallback(() => 'auto' as const, [])
  const getRowHeight = useMemo(() => (mode === 'fixed' ? undefined : mode === 'function' ? byFunction : auto), [mode, byFunction, auto])

  return (
    <>
      <p>
        {(['fixed', 'function', 'auto'] as Mode[]).map((m) => (
          <label key={m} style={{ marginRight: 16 }}>
            <input type="radio" name="row-height-mode" checked={mode === m} onChange={() => setMode(m)} />{' '}
            {m === 'fixed' ? 'rowHeight: 36' : m === 'function' ? 'getRowHeight: a number per row' : "getRowHeight: 'auto'"}
          </label>
        ))}
      </p>
      <Grid
        key={mode}
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        height={360}
        pagination={false}
        rowHeight={36}
        getRowHeight={getRowHeight}
        getEstimatedRowHeight={76}
      />
    </>
  )
}
