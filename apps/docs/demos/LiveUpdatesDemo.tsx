import { useEffect, useMemo, useRef, useState } from 'react'
import { Grid, type GridApi, type UIColumnDef } from 'data-grid-kit'
import { makeEmployees, type Employee } from '../data'

const columns: UIColumnDef<Employee>[] = [
  { field: 'id', headerName: 'ID', type: 'number', width: 90 },
  { field: 'name', headerName: 'Name', width: 150 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'salary', headerName: 'Salary (live)', type: 'number', width: 140, valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { field: 'age', headerName: 'Age', type: 'number', width: 80 },
]

const SIZE = 50_000

export default function LiveUpdatesDemo() {
  // `rows` never changes: the feed goes through api.updateRows, which patches the hierarchy in place
  const rows = useMemo(() => makeEmployees(SIZE), [])
  const api = useRef<GridApi<Employee>>()
  const data = useRef(new Map(rows.map((r) => [r.id, r])))
  const nextId = useRef(SIZE + 1)
  const timer = useRef<ReturnType<typeof setInterval>>()
  const [running, setRunning] = useState(false)
  const [stats, setStats] = useState({ ticks: 0, changes: 0, frameMs: 0 })

  const tick = () => {
    const g = api.current
    if (!g) return
    const ids = [...data.current.keys()]
    const update: Employee[] = []
    for (let i = 0; i < 200; i++) {
      const id = ids[Math.floor(Math.random() * ids.length)]!
      const next = { ...data.current.get(id)!, salary: Math.round(3000 + Math.random() * 12000) }
      data.current.set(id, next)
      update.push(next)
    }
    const insert = Array.from({ length: 3 }, () => {
      const row = { ...rows[0]!, id: nextId.current++, name: `New ${nextId.current}`, salary: Math.round(3000 + Math.random() * 12000) }
      data.current.set(row.id, row)
      return row
    })
    const remove = Array.from({ length: 3 }, () => ids[Math.floor(Math.random() * ids.length)]!)
    remove.forEach((id) => data.current.delete(id))
    const started = performance.now()
    g.updateRows({ update, insert, remove })
    // the next frame is when the grid has re-rendered with the new data
    requestAnimationFrame(() =>
      setStats((s) => ({ ticks: s.ticks + 1, changes: s.changes + update.length + insert.length + remove.length, frameMs: performance.now() - started })),
    )
  }

  useEffect(() => {
    if (running) timer.current = setInterval(tick, 100)
    return () => clearInterval(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  return (
    <div>
      <p>
        <button type="button" onClick={() => setRunning((r) => !r)}>
          {running ? 'Stop feed' : 'Start feed'}
        </button>{' '}
        <span className="muted">
          {SIZE.toLocaleString()} rows sorted by salary · ~2,000 changes/s · {stats.changes.toLocaleString()} applied in {stats.ticks} ticks · last
          tick to next screen refresh: <strong>{stats.frameMs.toFixed(1)} ms</strong> (includes waiting for the refresh itself)
        </span>
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={320}
        pagination={false}
        initialState={{ sortModel: [{ field: 'salary', direction: 'desc' }] }}
        onReady={(a) => (api.current = a)}
      />
    </div>
  )
}
