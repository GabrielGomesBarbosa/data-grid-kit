import type { ReactNode } from 'react'
import { useBase } from '../base'
import { useIcons } from '../icons'
import { defaultFilterItem, getColumnType, getFilterOperators, operatorNeedsValue, optionLabel, optionValue, type ColumnDef, type FilterItem, type FilterOperator, type GridInstance } from '../../core'
import { title } from './shared'
import { cx } from '../cx'
import type { PanelProps } from './types'

/* ------------------------------------------------------------ filter panel */

function ValueInput({ col, item, onChange, first }: { col: ColumnDef; item: FilterItem; onChange: (v: string) => void; first?: boolean }) {
  const { Input, Select } = useBase()
  const type = getColumnType(col)
  const value = item.value == null ? '' : String(item.value)
  const focus = first ? { 'data-autofocus': '' } : undefined // the popover puts the focus here when it opens
  if (!operatorNeedsValue(item.operator)) return <span className="gk-muted">-</span>
  if (type === 'boolean') {
    return (
      <Select aria-label="Value" value={value} onChange={(e) => onChange(e.target.value)} {...focus}>
        <option value="" />
        <option value="true">true</option>
        <option value="false">false</option>
      </Select>
    )
  }
  if (type === 'singleSelect') {
    return (
      <Select aria-label="Value" value={value} onChange={(e) => onChange(e.target.value)} {...focus}>
        <option value="" />
        {(col.valueOptions ?? []).map((o) => (
          <option key={String(optionValue(o))} value={String(optionValue(o))}>
            {optionLabel(o)}
          </option>
        ))}
      </Select>
    )
  }
  return (
    <Input
      aria-label="Value"
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      placeholder="Value"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...focus}
    />
  )
}

/** a control with its name written on its border, like an outlined field; the control keeps its own accessible name */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="gk-field">
      <span aria-hidden="true">{label}</span>
      {children}
    </div>
  )
}

export function FilterPanel<R>({ grid, className }: PanelProps<R>) {
  const { Button, Select } = useBase()
  const icons = useIcons()
  const { api, state } = grid
  const columns = grid.options.columns.filter((c) => c.filterable !== false)
  const model = state.filterModel
  // With no filter yet the panel opens on one ready row, so there is something to fill in at once. The row is only shown:
  // it becomes a filter in the model when you change something in it.
  const blank = model.items.length === 0 && columns[0] ? [defaultFilterItem(columns[0])] : []
  const items = model.items.length ? model.items : blank
  const setItems = (next: FilterItem[]) => api.setFilterModel({ ...model, items: next })

  const addItem = () => {
    const col = columns[0]
    if (col) setItems([...items, defaultFilterItem(col)])
  }
  return (
    <div className={cx('gk-panel gk-filter-panel', className)}>
      {items.map((item, i) => {
        const col = columns.find((c) => c.field === item.field) ?? columns[0]!
        const operators = getFilterOperators(col)
        const update = (patch: Partial<FilterItem>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
        return (
          <div className="gk-filter-row" key={i}>
            <Button type="button" className="gk-icon-btn" aria-label="Remove filter" title="Remove filter" disabled={model.items.length === 0} onClick={() => setItems(items.filter((_, j) => j !== i))}>
              <icons.close />
            </Button>
            {i === 1 && items.length > 1 ? (
              <Select
                aria-label="Logic"
                value={model.logic ?? 'and'}
                onChange={(e) => api.setFilterModel({ ...model, logic: e.target.value as 'and' | 'or' })}
              >
                <option value="and">And</option>
                <option value="or">Or</option>
              </Select>
            ) : (
              <span className="gk-filter-logic">{i === 0 ? 'Where' : (model.logic ?? 'and') === 'or' ? 'Or' : 'And'}</span>
            )}
            <Field label="Column">
              <Select
                aria-label="Column"
                value={item.field}
                onChange={(e) => {
                  const next = columns.find((c) => c.field === e.target.value)!
                  update({ ...defaultFilterItem(next) })
                }}
              >
                {columns.map((c) => (
                  <option key={c.field} value={c.field}>
                    {title(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Operator">
              <Select aria-label="Operator" value={item.operator} onChange={(e) => update({ operator: e.target.value as FilterOperator })}>
                {operators.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Value">
              <ValueInput col={col} item={item} first={i === 0} onChange={(value) => update({ value })} />
            </Field>
          </div>
        )
      })}
      <div className="gk-panel-actions gk-filter-actions">
        <Button type="button" className="gk-link-btn" onClick={addItem}>
          <icons.add /> Add filter
        </Button>
        {model.items.length > 0 && (
          <Button type="button" className="gk-link-btn" onClick={() => setItems([])}>
            <icons.trash /> Remove all
          </Button>
        )}
      </div>
    </div>
  )
}
