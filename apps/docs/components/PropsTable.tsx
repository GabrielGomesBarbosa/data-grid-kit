export interface PropRow {
  name: string
  type: string
  default?: string
  description: string
}

export function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <div className="table-wrap">
      <table className="props">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>
                <code>{r.name}</code>
              </td>
              <td>
                <code className="type">{r.type}</code>
              </td>
              <td>{r.default ? <code>{r.default}</code> : <span className="muted">-</span>}</td>
              <td>{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
