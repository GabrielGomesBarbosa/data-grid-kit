import { useMemo, useRef, useState } from 'react'
import { Grid, type GridApi, type UIColumnDef } from 'data-grid-kit'

type LeaveType = 'holiday' | 'vacation' | 'sick'

interface Leave {
  type: LeaveType
  /** a vacation is drawn as a bar: these say where it begins and ends */
  start: boolean
  end: boolean
  flag?: string
}

interface Row {
  id: string
  name: string
  dept: string
  color: string
  /** leave by day of the month */
  days: Record<number, Leave | undefined>
  /** the pinned row on top counts the people out each day */
  counts?: Record<number, number>
}

const PEOPLE: [string, string][] = [
  ['Faustino Shields', 'Engineering'],
  ['Pat Schneider', 'Engineering'],
  ['Aliya Schinner', 'Product'],
  ['Daan Aarden', 'Design'],
  ['Marie Renault', 'Design'],
  ['Loraine Stracke', 'People'],
  ['Luis Lopez', 'Engineering'],
  ['Amy Kovacek', 'Engineering'],
  ['Giulio Rossi', 'Operations'],
  ['Renee Smith', 'Marketing'],
  ['Victor Tavares', 'Product'],
  ['Julio Hernandez', 'Engineering'],
  ['Mia Johnson', 'People'],
  ['Cillian McGrath', 'Engineering'],
]
const COLORS = ['#7c3aed', '#0891b2', '#c2410c', '#15803d', '#be185d', '#1d4ed8', '#a16207']

/** [person, from day, to day, type, flag] for October; other months get a pattern made from the month number */
const OCTOBER: [number, number, number, LeaveType, string?][] = [
  [0, 12, 12, 'holiday', '🇺🇸'],
  [1, 3, 3, 'holiday', '🇩🇪'],
  [1, 10, 12, 'vacation'],
  [2, 8, 8, 'sick'],
  [4, 15, 15, 'sick'],
  [5, 12, 12, 'holiday', '🇺🇸'],
  [7, 5, 6, 'vacation'],
  [8, 12, 12, 'holiday', '🇧🇷'],
  [9, 12, 12, 'holiday', '🇺🇸'],
  [10, 5, 5, 'holiday', '🇦🇺'],
  [11, 9, 9, 'holiday', '🇪🇸'],
]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const YEAR = 2026

function leaveFor(month: number): [number, number, number, LeaveType, string?][] {
  if (month === 9) return OCTOBER
  let s = month * 7919 + 13
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32
  const out: [number, number, number, LeaveType, string?][] = []
  for (let i = 0; i < 9; i++) {
    const day = 1 + Math.floor(rand() * 26)
    const type: LeaveType = rand() < 0.5 ? 'vacation' : rand() < 0.5 ? 'sick' : 'holiday'
    out.push([Math.floor(rand() * PEOPLE.length), day, type === 'vacation' ? day + Math.floor(rand() * 4) : day, type, type === 'holiday' ? ['🇺🇸', '🇩🇪', '🇪🇸'][Math.floor(rand() * 3)] : undefined])
  }
  return out
}

function buildRows(month: number, shown: ReadonlySet<LeaveType>, hideOutToday: number | null): Row[] {
  const days = new Date(YEAR, month + 1, 0).getDate()
  const people: Row[] = PEOPLE.map(([name, dept], i) => ({ id: `p${i}`, name, dept, color: COLORS[i % COLORS.length]!, days: {} }))
  for (const [who, from, to, type, flag] of leaveFor(month)) {
    if (!shown.has(type)) continue
    for (let d = from; d <= Math.min(to, days); d++) people[who]!.days[d] = { type, start: d === from, end: d === Math.min(to, days), flag }
  }
  const visible = hideOutToday === null ? people : people.filter((p) => !p.days[hideOutToday])
  const counts: Record<number, number> = {}
  for (let d = 1; d <= days; d++) counts[d] = visible.filter((p) => p.days[d]).length
  return [{ id: '__summary', name: 'Out of office:', dept: '', color: '', days: {}, counts }, ...visible]
}

const initials = (name: string) => name.split(' ').map((w) => w[0]).join('')

function DayCell({ row, day, weekend }: { row: Row; day: number; weekend: boolean }) {
  if (row.counts) return <span className="cal-count">{row.counts[day]}</span>
  const leave = row.days[day]
  return (
    <span className="cal-day" data-weekend={weekend ? '' : undefined}>
      {leave?.type === 'vacation' && (
        <span className="cal-bar" data-start={leave.start ? '' : undefined} data-end={leave.end ? '' : undefined}>
          {leave.start && <span aria-label="Vacation">🏖️</span>}
        </span>
      )}
      {leave?.type === 'sick' && (
        <span className="cal-tile" data-kind="sick" aria-label="Sick leave">
          🌡️
        </span>
      )}
      {leave?.type === 'holiday' && (
        <span className="cal-tile" data-kind="holiday" aria-label="Public holiday">
          {leave.flag}
        </span>
      )}
    </span>
  )
}

/** Leave by employee and day. Nothing here is special to the grid: the days are ordinary columns with a cell renderer. */
export default function TimeOffDemo() {
  const api = useRef<GridApi<Row>>()
  const root = useRef<HTMLDivElement>(null)
  const today = new Date()
  const [month, setMonth] = useState(9)
  const [comfortable, setComfortable] = useState(false)
  const [shown, setShown] = useState<Set<LeaveType>>(new Set(['holiday', 'vacation', 'sick']))
  const [hideToday, setHideToday] = useState(false)
  const isThisMonth = today.getFullYear() === YEAR && today.getMonth() === month
  const rows = useMemo(() => buildRows(month, shown, hideToday && isThisMonth ? today.getDate() : null), [month, shown, hideToday, isThisMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => {
    const total = new Date(YEAR, month + 1, 0).getDate()
    const cols: UIColumnDef<Row>[] = [
      {
        field: 'employee',
        headerName: `Employees (${rows.length - 1})`,
        width: 220,
        sortable: true,
        valueGetter: (r) => r.name,
        renderCell: ({ row }) =>
          row.counts ? (
            <span className="muted">{row.name}</span>
          ) : (
            <span className="cal-person">
              <span className="cal-avatar" style={{ background: row.color }} aria-hidden="true">
                {initials(row.name)}
              </span>
              <span>
                <strong>{row.name}</strong>
                <small>{row.dept}</small>
              </span>
            </span>
          ),
      },
    ]
    for (let d = 1; d <= total; d++) {
      const wd = new Date(YEAR, month, d).getDay()
      cols.push({
        field: `d${d}`,
        headerName: `${WEEKDAYS[wd]}\n${d}`,
        width: 52,
        align: 'center',
        sortable: false,
        filterable: false,
        reorderable: false,
        valueGetter: (r) => (r.counts ? r.counts[d] : (r.days[d]?.type ?? '')),
        renderCell: ({ row }) => <DayCell row={row} day={d} weekend={wd === 0 || wd === 6} />,
      })
    }
    return cols
  }, [month, rows.length])

  const toggle = (type: LeaveType) =>
    setShown((s) => {
      const next = new Set(s)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  const goToday = () => {
    if (isThisMonth) api.current?.scrollToColumn(`d${today.getDate()}`, 'center')
  }

  return (
    <div className="cal" ref={root} data-comfortable={comfortable ? '' : undefined}>
      <div className="demo-head">
        <h3>Time Off Calendar</h3>
        <span className="spacer" />
        <span role="group" aria-label="Density">
          <button type="button" className="demo-chip" aria-pressed={!comfortable} onClick={() => setComfortable(false)}>
            Compact
          </button>{' '}
          <button type="button" className="demo-chip" aria-pressed={comfortable} onClick={() => setComfortable(true)}>
            Comfortable
          </button>
        </span>
      </div>
      <div className="demo-head">
        {(['holiday', 'vacation', 'sick'] as LeaveType[]).map((t) => (
          <button key={t} type="button" className="demo-chip" aria-pressed={shown.has(t)} onClick={() => toggle(t)}>
            {t === 'holiday' ? 'Public holidays' : t === 'vacation' ? 'Vacation' : 'Sick leave'}
          </button>
        ))}
        <label className="muted">
          <input type="checkbox" checked={hideToday} disabled={!isThisMonth} onChange={(e) => setHideToday(e.target.checked)} /> Hide out today
        </label>
        <span className="spacer" />
        <input type="search" placeholder="Search…" aria-label="Search employees" onChange={(e) => api.current?.setQuickFilter(e.target.value)} />
        <button type="button" className="demo-chip" onClick={goToday} disabled={!isThisMonth}>
          Today
        </button>
        <select value={month} aria-label="Month" onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
        <button type="button" className="demo-chip" aria-label="Previous month" onClick={() => setMonth((m) => (m + 11) % 12)}>
          ‹
        </button>
        <button type="button" className="demo-chip" aria-label="Next month" onClick={() => setMonth((m) => (m + 1) % 12)}>
          ›
        </button>
      </div>
      <Grid
        key={month}
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        height={comfortable ? 760 : 560}
        rowHeight={comfortable ? 56 : 44}
        headerHeight={54}
        pagination={false}
        columnReorder={false}
        columnControls={false}
        initialState={{ pinnedColumns: { left: ['employee'], right: [] }, pinnedRows: { top: ['__summary'], bottom: [] } }}
        onReady={(a) => (api.current = a)}
      />
    </div>
  )
}
