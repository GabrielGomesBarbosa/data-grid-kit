import { useBase } from '../base'
import { type ColumnDef, type GridInstance } from '../../core'
import { title } from './shared'
import { cx } from '../cx'
import type { PanelProps } from './types'

/* ----------------------------------------------------------- columns panel */

export function ColumnsPanel<R>({ grid, className }: PanelProps<R>) {
  const { Button, Checkbox } = useBase()
  const { api, state, options } = grid
  const visible = (c: ColumnDef) => state.columnVisibility[c.field] ?? !c.hidden
  const all = options.columns
  const setAll = (on: boolean) => all.forEach((c) => api.setColumnVisibility(c.field, on))
  // keep at least one column visible so the grid never becomes unreachable
  const shown = all.filter(visible).length
  return (
    <div className={cx('gk-panel', className)}>
      <ul className="gk-column-list">
        {all.map((c) => (
          <li key={c.field}>
            <label>
              <Checkbox
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
        <Button type="button" onClick={() => setAll(true)}>
          Show all
        </Button>
        <Button type="button" onClick={() => all.slice(1).forEach((c) => api.setColumnVisibility(c.field, false))}>
          Hide all
        </Button>
      </div>
    </div>
  )
}
