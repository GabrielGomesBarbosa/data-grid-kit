import { useRef } from 'react'
import { Grid, type GridApi, type UIColumnDef } from 'data-grid-kit'

interface Order {
  id: number
  customer: string
  status: 'open' | 'shipped' | 'cancelled'
  total: number
  items: { sku: string; qty: number; price: number }[]
}

const customers = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark']
const rows: Order[] = Array.from({ length: 300 }, (_, i) => {
  const count = 1 + ((i * 7) % 5)
  const items = Array.from({ length: count }, (_, j) => ({ sku: `SKU-${i + 1}-${j + 1}`, qty: 1 + ((i + j) % 4), price: 10 + ((i * 13 + j * 7) % 90) }))
  return {
    id: i + 1,
    customer: customers[i % customers.length]!,
    status: (['open', 'shipped', 'cancelled'] as const)[i % 3]!,
    total: items.reduce((s, it) => s + it.qty * it.price, 0),
    items,
  }
})

const columns: UIColumnDef<Order>[] = [
  { field: 'id', headerName: 'Order', type: 'number', width: 110 },
  { field: 'customer', headerName: 'Customer', width: 160 },
  { field: 'status', headerName: 'Status', width: 120 },
  { field: 'total', headerName: 'Total', type: 'number', width: 120, valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
]

export default function DetailPanelDemo() {
  const api = useRef<GridApi<Order>>()
  return (
    <>
      <p>
        <button type="button" onClick={() => api.current?.setDetailPanelExpanded([1, 2, 3])}>
          Open the first three
        </button>{' '}
        <button type="button" onClick={() => api.current?.setDetailPanelExpanded([])}>
          Close all
        </button>{' '}
        <span className="muted">Click ›, press Alt+↓ / Alt+↑ on a row, or Enter on a cell that can't be edited. Cancelled orders have no panel.</span>
      </p>
      <Grid
        rows={rows}
        columns={columns}
        height={380}
        pagination={false}
        // 'auto': the panel is as tall as its content (measured). A number, or a function of the row, is faster to lay out.
        detailPanelHeight="auto"
        isDetailPanelAvailable={(row) => row.status !== 'cancelled'}
        renderDetailPanel={({ row }) => (
          <table className="plain" style={{ maxWidth: 520 }}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {row.items.map((it) => (
                <tr key={it.sku}>
                  <td>{it.sku}</td>
                  <td>{it.qty}</td>
                  <td>${it.price}</td>
                  <td>${it.qty * it.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        onReady={(a) => (api.current = a)}
      />
    </>
  )
}
