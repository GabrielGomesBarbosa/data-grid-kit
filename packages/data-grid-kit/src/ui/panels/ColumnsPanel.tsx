import { type ColumnDef, type GridInstance } from '../../core'
import { title } from './shared'

/* ----------------------------------------------------------- columns panel */

export function ColumnsPanel<R>({ grid }: { grid: GridInstance<R> }) {
  const { api, state, options } = grid
  const visible = (c: ColumnDef) => state.columnVisibility[c.field] ?? !c.hidden
  const all = options.columns
  const setAll = (on: boolean) => all.forEach((c) => api.setColumnVisibility(c.field, on))
  // keep at least one column visible so the grid never becomes unreachable
  const shown = all.filter(visible).length
  return (
    <div className="gk-panel">
      <ul className="gk-column-list">
        {all.map((c) => (
          <li key={c.field}>
            <label>
              <input
                type="checkbox"
                checked={visible(c)}
                disabled={visible(c) && shown === 1}
                onChange={(e) => api.setColumnVisibility(c.field, e.target.checked)}
              />
              {title(c)}
            </label>
          </li>
        ))}
      </ul>
      <div className="gk-panel-actions">
        <button type="button" onClick={() => setAll(true)}>
          Show all
        </button>
        <button type="button" onClick={() => all.slice(1).forEach((c) => api.setColumnVisibility(c.field, false))}>
          Hide all
        </button>
      </div>
    </div>
  )
}
