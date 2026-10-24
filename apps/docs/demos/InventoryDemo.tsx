import { useRef, useState } from 'react'
import { Grid, type GridApi, type UIColumnDef } from 'data-grid-kit'

type Status = 'In Stock' | 'Out of Stock' | 'Restocking'

interface Product {
  id: string
  name: string
  sku: string
  status: Status
  stock: number
  price: number
  cost: number
  /** 1 to 5 */
  rating: number
  sales: number
  emoji: string
  hue: number
  description: string
  /** units sold in each of the last 8 weeks */
  weekly: number[]
}

const PRODUCTS: Product[] = [
  { id: '1', name: 'Sony Alpha A7 IV', sku: 'SON-A7IV', status: 'In Stock', stock: 15, price: 2400, cost: 1800, rating: 4, sales: 13, emoji: '📷', hue: 160, description: 'Full-frame mirrorless camera with a 33 MP sensor.', weekly: [1, 2, 1, 2, 3, 1, 2, 1] },
  { id: '2', name: 'Dell XPS 15', sku: 'DEL-XPS15', status: 'Restocking', stock: 8, price: 1599, cost: 1200, rating: 4, sales: 48, emoji: '💻', hue: 215, description: '15-inch laptop with an OLED display.', weekly: [4, 6, 5, 7, 6, 8, 6, 6] },
  { id: '3', name: 'Samsung Odyssey G9', sku: 'SAM-ODG9', status: 'Out of Stock', stock: 0, price: 1299, cost: 950, rating: 4, sales: 52, emoji: '🖥️', hue: 260, description: '49-inch curved gaming monitor, 240 Hz.', weekly: [8, 7, 9, 6, 8, 7, 4, 3] },
  { id: '4', name: 'Blue Yeti X', sku: 'BLU-YETIX', status: 'In Stock', stock: 25, price: 149, cost: 110, rating: 4, sales: 21, emoji: '🎙️', hue: 30, description: 'USB condenser microphone with a level meter.', weekly: [2, 3, 2, 4, 3, 2, 3, 2] },
  { id: '5', name: 'Sony WH-1000XM5', sku: 'SON-WH1000XM5', status: 'In Stock', stock: 12, price: 399, cost: 280, rating: 5, sales: 17, emoji: '🎧', hue: 50, description: 'Wireless headphones with noise cancelling.', weekly: [1, 3, 2, 2, 3, 2, 2, 2] },
  { id: '6', name: 'Apple MacBook Pro 14', sku: 'APP-MBP14', status: 'In Stock', stock: 8, price: 1999, cost: 1450, rating: 5, sales: 95, emoji: '💻', hue: 200, description: '14-inch laptop with the M-series chip.', weekly: [10, 12, 11, 13, 12, 14, 12, 11] },
  { id: '7', name: 'Elgato Stream Deck MK.2', sku: 'ELG-SDMK2', status: 'Restocking', stock: 1, price: 149, cost: 95, rating: 4, sales: 38, emoji: '🎛️', hue: 290, description: '15 customisable LCD keys for streaming.', weekly: [5, 4, 6, 5, 5, 6, 4, 3] },
  { id: '8', name: 'Logitech MX Master 3S', sku: 'LOG-MXM3S', status: 'In Stock', stock: 14, price: 99, cost: 60, rating: 4, sales: 79, emoji: '🖱️', hue: 340, description: 'Wireless mouse with a quiet, precise wheel.', weekly: [9, 10, 11, 9, 10, 12, 9, 9] },
  { id: '9', name: 'Canon EOS R6 Mark II', sku: 'CAN-EOSR6', status: 'Out of Stock', stock: 0, price: 2499, cost: 1900, rating: 5, sales: 15, emoji: '📷', hue: 10, description: 'Full-frame camera with fast autofocus.', weekly: [2, 2, 3, 1, 2, 3, 1, 1] },
  { id: '10', name: 'Razer Seiren Mini', sku: 'RAZ-SMINI', status: 'In Stock', stock: 30, price: 49, cost: 28, rating: 3, sales: 64, emoji: '🎙️', hue: 120, description: 'Compact USB microphone for streaming.', weekly: [7, 8, 9, 8, 8, 9, 8, 7] },
  { id: '11', name: 'Keychron Q1', sku: 'KEY-Q1', status: 'In Stock', stock: 18, price: 179, cost: 120, rating: 5, sales: 41, emoji: '⌨️', hue: 85, description: 'Hot-swappable mechanical keyboard, aluminium case.', weekly: [4, 5, 5, 6, 5, 5, 6, 5] },
  { id: '12', name: 'LG UltraFine 5K', sku: 'LG-UF5K', status: 'Restocking', stock: 3, price: 1299, cost: 980, rating: 3, sales: 22, emoji: '🖥️', hue: 240, description: '27-inch 5K display for the Mac.', weekly: [3, 3, 2, 4, 3, 3, 2, 2] },
]

const STATUS_ICON: Record<Status, string> = { 'In Stock': '✓', Restocking: '⏳', 'Out of Stock': '⊗' }
const money = (v: unknown) => `$${Number(v).toLocaleString('en-US')}`

function Chart({ values }: { values: number[] }) {
  const hi = Math.max(...values, 1)
  return (
    <svg width="160" height="48" viewBox="0 0 160 48" aria-label="Units sold per week">
      {values.map((v, i) => (
        <rect key={i} x={i * 20 + 2} y={46 - (v / hi) * 44} width="16" height={(v / hi) * 44} rx="2" fill="var(--accent)" opacity={0.35 + (i / values.length) * 0.65} />
      ))}
    </svg>
  )
}

const columns: UIColumnDef<Product>[] = [
  {
    field: 'name',
    headerName: 'Product',
    width: 270,
    renderCell: ({ row }) => (
      <span className="inv-product">
        <span className="inv-tile" style={{ background: `linear-gradient(135deg, hsl(${row.hue} 55% 42%), hsl(${row.hue} 55% 62%))` }} aria-hidden="true">
          {row.emoji}
        </span>
        {row.name}
      </span>
    ),
  },
  { field: 'sku', headerName: 'SKU', width: 150 },
  {
    field: 'status',
    headerName: 'Status',
    type: 'singleSelect',
    valueOptions: ['In Stock', 'Restocking', 'Out of Stock'],
    width: 150,
    renderCell: ({ row }) => (
      <span className="inv-status" data-status={row.status.replace(/ /g, '-').toLowerCase()}>
        <span aria-hidden="true">{STATUS_ICON[row.status]}</span> {row.status}
      </span>
    ),
  },
  { field: 'stock', headerName: 'Stock', type: 'number', width: 90 },
  { field: 'price', headerName: 'Price', type: 'number', width: 110, valueFormatter: money },
  { field: 'cost', headerName: 'Cost\nprofit', type: 'number', width: 110, valueFormatter: money },
  {
    field: 'rating',
    headerName: 'Rating',
    type: 'number',
    width: 130,
    align: 'left',
    renderCell: ({ row }) => (
      <span className="inv-stars" aria-label={`${row.rating} out of 5`}>
        {'★'.repeat(row.rating)}
        <span className="inv-off">{'★'.repeat(5 - row.rating)}</span>
      </span>
    ),
  },
  { field: 'sales', headerName: 'Sales\nsum', type: 'number', width: 100 },
]

const TABS: ('All' | Status)[] = ['All', 'In Stock', 'Out of Stock', 'Restocking']

/** A product table with filter tabs, rich cells, a detail panel and a footer that adds up profit and sales. */
export default function InventoryDemo() {
  const api = useRef<GridApi<Product>>()
  const [tab, setTab] = useState<'All' | Status>('All')
  const [revision, setRevision] = useState(0) // a restock changes a row: the detail panel reads it again

  const choose = (t: 'All' | Status) => {
    setTab(t)
    api.current?.setFilterModel({ items: t === 'All' ? [] : [{ field: 'status', operator: 'equals', value: t }] })
  }
  const restock = (p: Product) => {
    api.current?.updateRows({ update: [{ ...p, stock: p.stock + 10, status: 'In Stock' }] })
    setRevision((r) => r + 1)
  }

  return (
    <div className="inv" data-revision={revision}>
      <div className="demo-head">
        <span role="tablist" aria-label="Filter by status">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" className="demo-chip" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => choose(t)}>
              {t}
            </button>
          ))}
        </span>
        <span className="spacer" />
        <input type="search" placeholder="Search…" aria-label="Search products" onChange={(e) => api.current?.setQuickFilter(e.target.value)} />
      </div>
      <Grid
        rows={PRODUCTS}
        columns={columns}
        getRowId={(r) => r.id}
        height={520}
        rowHeight={64}
        headerHeight={52}
        pagination={false}
        columnReorder={false}
        detailPanelHeight={170}
        renderDetailPanel={({ row }) => (
          <div className="inv-detail">
            <span className="inv-tile big" style={{ background: `linear-gradient(135deg, hsl(${row.hue} 55% 42%), hsl(${row.hue} 55% 62%))` }} aria-hidden="true">
              {row.emoji}
            </span>
            <div>
              <strong>{row.name}</strong>
              <p>{row.description}</p>
              <p className="muted">
                Margin {Math.round(((row.price - row.cost) / row.price) * 100)}% · {row.stock} in stock
              </p>
              <button type="button" className="demo-chip" onClick={() => restock(row)}>
                Restock 10 units
              </button>
            </div>
            <div>
              <span className="muted">Units sold, last 8 weeks</span>
              <Chart values={row.weekly} />
            </div>
          </div>
        )}
        aggregationFunctions={{
          profit: { label: 'profit', columnTypes: ['number'], apply: ({ rows }) => rows.reduce((sum, r) => sum + (r.price - r.cost) * r.sales, 0) },
        }}
        initialState={{ aggregationModel: { cost: 'profit', sales: 'sum' } }}
        onReady={(a) => (api.current = a)}
      />
    </div>
  )
}
