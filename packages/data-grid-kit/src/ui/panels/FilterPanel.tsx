import { useBase } from '../base'
import { useIcons } from '../icons'
import { defaultFilterItem, getColumnType, getFilterOperators, operatorNeedsValue, optionLabel, optionValue, type ColumnDef, type FilterItem, type FilterOperator, type GridInstance } from '../../core'
import { title } from './shared'
import { cx } from '../cx'
import type { PanelProps } from './types'

/* ------------------------------------------------------------ filter panel */

function ValueInput({ col, item, onChange }: { col: ColumnDef; item: FilterItem; onChange: (v: string) => void }) {
  const { Input, Select } = useBase()
  const type = getColumnType(col)
  const value = item.value == null ? '' : String(item.value)
  if (!operatorNeedsValue(item.operator)) return <span className="gk-muted">-</span>
  if (type === 'boolean') {
    return (
      <Select aria-label="Value" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" />
        <option value="true">true</option>
        <option value="false">false</option>
      </Select>
    )
  }
  if (type === 'singleSelect') {
    return (
      <Select aria-label="Value" value={value} onChange={(e) => onChange(e.target.value)}>
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
    />
  )
}

export function FilterPanel<R>({ grid, className }: PanelProps<R>) {
  const { Button, Select, Input } = useBase()
  const icons = useIcons()
  const { api, state } = grid
  const columns = grid.options.columns.filter((c) => c.filterable !== false)
  const model = state.filterModel
  const setItems = (items: FilterItem[]) => api.setFilterModel({ ...model, items })

  const addItem = () => {
    const col = columns[0]
    if (col) setItems([...model.items, defaultFilterItem(col)])
  }
  return (
    <div className={cx('gk-panel', className)}>
      {model.items.length === 0 && <p className="gk-muted">No filters. Add one to narrow the rows.</p>}
      {model.items.map((item, i) => {
        const col = columns.find((c) => c.field === item.field) ?? columns[0]!
        const operators = getFilterOperators(col)
        const update = (patch: Partial<FilterItem>) =>
          setItems(model.items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
        return (
          <div className="gk-filter-row" key={i}>
            {i === 1 && model.items.length > 1 ? (
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
            <Select
              aria-label="Operator"
              value={item.operator}
              onChange={(e) => update({ operator: e.target.value as FilterOperator })}
            >
              {operators.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <ValueInput col={col} item={item} onChange={(value) => update({ value })} />
            <Button
              type="button"
              className="gk-icon-btn"
              aria-label="Remove filter"
              onClick={() => setItems(model.items.filter((_, j) => j !== i))}
            >
              <icons.close />
            </Button>
          </div>
        )
      })}
      <div className="gk-panel-actions">
        <Button type="button" onClick={addItem}>
          + Add filter
        </Button>
        {model.items.length > 0 && (
          <Button type="button" onClick={() => setItems([])}>
            Remove all
          </Button>
        )}
      </div>
    </div>
  )
}
