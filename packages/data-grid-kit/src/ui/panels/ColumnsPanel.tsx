import { useState } from 'react'
import { useBase } from '../base'
import { type ColumnDef } from '../../core'
import { title } from './shared'
import { cx } from '../cx'
import type { PanelProps } from './types'

/* ----------------------------------------------------------- columns panel */

export interface ColumnsPanelProps<R> extends PanelProps<R> {
  /** leave out the Show/Hide All checkbox */
  disableShowHideToggle?: boolean
  /** leave out the Reset button */
  disableResetButton?: boolean
  /** the fields the panel lets the user toggle (default: every column). A column with `hideable: false` can never be hidden. */
  getTogglableColumns?: (columns: ColumnDef<R>[]) => string[]
  /** `'filteredOnly'`: Show/Hide All acts only on the columns the search leaves in the list (default `'all'`) */
  toggleAllMode?: 'all' | 'filteredOnly'
}

/** Show and hide columns: a search box, one checkbox per column, one Show/Hide All checkbox and Reset. Every column can be hidden unless it says `hideable: false`. */
export function ColumnsPanel<R>({ grid, className, disableShowHideToggle, disableResetButton, getTogglableColumns, toggleAllMode = 'all' }: ColumnsPanelProps<R>) {
  const { Button, Checkbox, Input } = useBase()
  const { api, state, options, text: t } = grid
  const [query, setQuery] = useState('')
  const visible = (c: ColumnDef) => state.columnVisibility[c.field] ?? !c.hidden
  const togglable = getTogglableColumns ? new Set(getTogglableColumns(options.columns)) : null
  const all = togglable ? options.columns.filter((c) => togglable.has(c.field)) : options.columns
  const q = query.trim().toLowerCase()
  const list = q ? all.filter((c) => title(c).toLowerCase().includes(q)) : all
  // what Show/Hide All acts on: the listed columns that may be hidden
  const target = (toggleAllMode === 'filteredOnly' ? list : all).filter((c) => c.hideable !== false)
  const shown = target.filter(visible).length
  return (
    <div className={cx('gk-panel', className)}>
      <Input type="search" className="gk-columns-search" placeholder={t.columnsSearch} aria-label={t.columnsSearchLabel} value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="gk-column-list">
        {list.map((c) => (
          <li key={c.field}>
            <label>
              <Checkbox type="checkbox" checked={visible(c)} disabled={c.hideable === false} onChange={(e) => api.setColumnVisibility(c.field, e.target.checked)} />
              {title(c)}
            </label>
          </li>
        ))}
        {list.length === 0 && <li className="gk-muted">{t.columnsNoMatch}</li>}
      </ul>
      {(!disableShowHideToggle || !disableResetButton) && (
        <div className="gk-panel-actions gk-columns-footer">
          {!disableShowHideToggle && (
            <label>
              <Checkbox
                type="checkbox"
                checked={target.length > 0 && shown === target.length}
                disabled={target.length === 0}
                ref={(el) => {
                  if (el) el.indeterminate = shown > 0 && shown < target.length
                }}
                onChange={(e) => api.setColumnVisibilityModel({ ...state.columnVisibility, ...Object.fromEntries(target.map((c) => [c.field, e.target.checked])) })}
              />
              {t.columnsToggleAll}
            </label>
          )}
          {!disableResetButton && (
            <Button type="button" disabled={Object.keys(state.columnVisibility).length === 0} onClick={() => api.setColumnVisibilityModel({})}>
              {t.columnsReset}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
