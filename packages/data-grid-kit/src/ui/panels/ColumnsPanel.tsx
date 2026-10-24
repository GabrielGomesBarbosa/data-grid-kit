import { useState } from 'react'
import { useBase } from '../base'
import { type ColumnDef } from '../../core'
import { title } from './shared'
import { cx } from '../cx'
import type { PanelProps } from './types'

/* ----------------------------------------------------------- columns panel */

/** Show and hide columns: a search box, one checkbox per column, one Show/Hide All checkbox and Reset. Every column can be hidden. */
export function ColumnsPanel<R>({ grid, className }: PanelProps<R>) {
  const { Button, Checkbox, Input } = useBase()
  const { api, state, options } = grid
  const [query, setQuery] = useState('')
  const visible = (c: ColumnDef) => state.columnVisibility[c.field] ?? !c.hidden
  const all = options.columns
  const shown = all.filter(visible).length
  const q = query.trim().toLowerCase()
  const list = q ? all.filter((c) => title(c).toLowerCase().includes(q)) : all
  return (
    <div className={cx('gk-panel', className)}>
      <Input type="search" className="gk-columns-search" placeholder="Search" aria-label="Search columns" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="gk-column-list">
        {list.map((c) => (
          <li key={c.field}>
            <label>
              <Checkbox type="checkbox" checked={visible(c)} onChange={(e) => api.setColumnVisibility(c.field, e.target.checked)} />
              {title(c)}
            </label>
          </li>
        ))}
        {list.length === 0 && <li className="gk-muted">No column matches</li>}
      </ul>
      <div className="gk-panel-actions gk-columns-footer">
        <label>
          <Checkbox
            type="checkbox"
            checked={shown === all.length}
            ref={(el) => {
              if (el) el.indeterminate = shown > 0 && shown < all.length
            }}
            onChange={(e) => api.setColumnVisibilityModel(Object.fromEntries(all.map((c) => [c.field, e.target.checked])))}
          />
          Show/Hide All
        </label>
        <Button type="button" disabled={Object.keys(state.columnVisibility).length === 0} onClick={() => api.setColumnVisibilityModel({})}>
          Reset
        </Button>
      </div>
    </div>
  )
}
