import { useEffect, useMemo, useRef, useState } from 'react'
import { Grid, type UIColumnDef } from '../../src'
import { makeEmployees, type Employee } from '../data'

const columns: UIColumnDef<Employee>[] = Array.from({ length: 30 }, (_, i) => ({
  field: i === 0 ? 'name' : `c${i}`,
  headerName: i === 0 ? 'Name' : `Column ${i}`,
  width: 130,
  valueGetter: (r: Employee) => (i === 0 ? r.name : `${r.id}·${i}`),
}))

export default function VirtualizationDemo() {
  const [count, setCount] = useState(100_000)
  const rows = useMemo(() => makeEmployees(count), [count])
  const box = useRef<HTMLDivElement>(null)
  const [dom, setDom] = useState({ rows: 0, cells: 0 })

  // count what is really in the DOM, a few times per second
  useEffect(() => {
    const id = setInterval(() => {
      const el = box.current
      if (el) setDom({ rows: el.querySelectorAll('.gk-row').length, cells: el.querySelectorAll('.gk-cell').length })
    }, 250)
    return () => clearInterval(id)
  }, [])

  return (
    <div ref={box}>
      <p>
        <label>
          Rows{' '}
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1_000, 100_000, 500_000].map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()}
              </option>
            ))}
          </select>
        </label>{' '}
        <span className="muted">
          × {columns.length} columns = {(count * columns.length).toLocaleString()} cells · in the DOM right now:{' '}
          <strong>{dom.rows}</strong> rows, <strong>{dom.cells}</strong> cells
        </span>
      </p>
      <Grid rows={rows} columns={columns} height={320} pagination={false} />
    </div>
  )
}
