import { memo, useEffect, useRef, useState } from 'react'
import { Grid, type GridApi, type UIColumnDef } from 'data-grid-kit'

interface Stock {
  id: string
  symbol: string
  company: string
  color: string
  /** the price the day opened at: the change is measured from it */
  open: number
  price: number
  volume: number
  /** the last 40 prices, oldest first (the trend column draws them) */
  history: number[]
  /** counts the updates this stock got, so the price cell can replay its flash */
  tick: number
  /** direction of the last update */
  dir: 'up' | 'down'
}

const SEED: [string, string, string, number][] = [
  ['MSFT', 'Microsoft Corporation', '#00a4ef', 662.86],
  ['GOOGL', 'Alphabet Inc.', '#ea4335', 529.62],
  ['META', 'Meta Platforms, Inc.', '#0866ff', 644.62],
  ['NVDA', 'NVIDIA Corporation', '#4d8c00', 913.78],
  ['TSLA', 'Tesla, Inc.', '#e31937', 648.74],
  ['NFLX', 'Netflix, Inc.', '#c20710', 380.06],
  ['CSCO', 'Cisco Systems, Inc.', '#049fd9', 712.35],
  ['INTC', 'Intel Corporation', '#0071c5', 507.83],
  ['ORCL', 'Oracle Corporation', '#c74634', 1039.46],
  ['IBM', 'International Business Machines', '#1f70c1', 1155.57],
  ['SAP', 'SAP SE', '#0a8ad6', 902.15],
  ['AMZN', 'Amazon.com, Inc.', '#d98200', 750.2],
]

/** a small deterministic generator, so the demo looks the same every time it loads */
function rng(seed: number) {
  let s = seed
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32
}

function makeStocks(): Stock[] {
  const rand = rng(11)
  return SEED.map(([symbol, company, color, end]) => {
    const history = [end]
    for (let i = 0; i < 39; i++) history.unshift(history[0]! * (1 + (rand() - 0.5) * 0.02))
    return { id: symbol, symbol, company, color, open: history[0]!, price: end, volume: Math.round(100_000 + rand() * 9_000_000), history, tick: 0, dir: 'up' }
  })
}

const Sparkline = memo(function Sparkline({ values }: { values: number[] }) {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 118 + 1},${26 - ((v - lo) / (hi - lo || 1)) * 24}`).join(' ')
  const up = values[values.length - 1]! >= values[0]!
  return (
    <svg className="rt-spark" width="120" height="28" viewBox="0 0 120 28" aria-hidden="true">
      <polyline points={points} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
})

const money = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const signed = (v: number, digits = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`

const columns: UIColumnDef<Stock>[] = [
  {
    field: 'symbol',
    headerName: 'Symbol',
    width: 120,
    renderCell: ({ row }) => (
      <span className="rt-symbol">
        <span className="rt-logo" style={{ background: row.color }} aria-hidden="true">
          {row.symbol[0]}
        </span>
        <strong>{row.symbol}</strong>
      </span>
    ),
  },
  { field: 'company', headerName: 'Company', width: 220 },
  { field: 'trend', headerName: 'Trend', width: 140, sortable: false, filterable: false, valueGetter: (r) => r.history[r.history.length - 1], renderCell: ({ row }) => <Sparkline values={row.history} /> },
  {
    field: 'price',
    headerName: 'Price',
    type: 'number',
    width: 120,
    align: 'right',
    // the key changes with every update, so the element is new and its flash plays again
    renderCell: ({ row }) => (
      <span key={row.tick} className="rt-pill" data-flash={row.tick ? row.dir : undefined} data-down={row.price < row.open ? '' : undefined}>
        ${money(row.price)}
      </span>
    ),
  },
  {
    field: 'change',
    headerName: 'Change',
    type: 'number',
    width: 100,
    valueGetter: (r) => r.price - r.open,
    renderCell: ({ value }) => <span className={Number(value) >= 0 ? 'rt-up' : 'rt-down'}>{signed(Number(value))}</span>,
  },
  {
    field: 'pct',
    headerName: '% Change',
    type: 'number',
    width: 110,
    valueGetter: (r) => ((r.price - r.open) / r.open) * 100,
    renderCell: ({ value }) => <span className={Number(value) >= 0 ? 'rt-up' : 'rt-down'}>{signed(Number(value))}%</span>,
  },
  { field: 'volume', headerName: 'Volume', type: 'number', width: 120, valueFormatter: (v) => Number(v).toLocaleString('en-US') },
]

const rows = makeStocks()

/** Prices change a few times a second through `api.updateRows`; only the rows that changed render again. */
export default function RealTimeDemo() {
  const api = useRef<GridApi<Stock>>()
  const [running, setRunning] = useState(true)
  const [rate, setRate] = useState(700)
  const [sent, setSent] = useState(0)
  const current = useRef(new Map(rows.map((r) => [r.id, r])))
  const rand = useRef(rng(5))

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const next: Stock[] = []
      const count = 3 + Math.floor(rand.current() * 3)
      for (let k = 0; k < count; k++) {
        const prev = current.current.get(SEED[Math.floor(rand.current() * SEED.length)]![0])!
        if (next.some((n) => n.id === prev.id)) continue
        const price = Math.max(1, prev.price * (1 + (rand.current() - 0.5) * 0.006))
        next.push({
          ...prev,
          price,
          volume: prev.volume + Math.round(rand.current() * 8000),
          history: [...prev.history.slice(-39), price],
          tick: prev.tick + 1,
          dir: price >= prev.price ? 'up' : 'down',
        })
      }
      for (const n of next) current.current.set(n.id, n)
      api.current?.updateRows({ update: next })
      setSent((n) => n + next.length)
    }, rate)
    return () => clearInterval(id)
  }, [running, rate])

  return (
    <>
      <div className="demo-head">
        <h3>Stock Market</h3>
        <span className="spacer" />
        <label className="muted">
          Update every{' '}
          <select value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Update interval">
            <option value={100}>100 ms</option>
            <option value={300}>300 ms</option>
            <option value={700}>700 ms</option>
            <option value={1500}>1.5 s</option>
          </select>
        </label>
        <button type="button" className="demo-chip" aria-pressed={running} onClick={() => setRunning((r) => !r)}>
          {running ? 'Pause' : 'Resume'}
        </button>
        <span className="muted" role="status">
          {sent.toLocaleString()} row updates
        </span>
      </div>
      <Grid rows={rows} columns={columns} getRowId={(r) => r.id} height={470} rowHeight={52} pagination={false} toolbar onReady={(a) => (api.current = a)} />
    </>
  )
}
