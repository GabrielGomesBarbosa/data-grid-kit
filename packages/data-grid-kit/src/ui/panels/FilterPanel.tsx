import { defaultFilterItem, getColumnType, getFilterOperators, operatorNeedsValue, optionLabel, optionValue, type ColumnDef, type FilterItem, type FilterOperator, type GridInstance } from '../../core'
import { title } from './shared'

/* ------------------------------------------------------------ filter panel */

function ValueInput({ col, item, onChange }: { col: ColumnDef; item: FilterItem; onChange: (v: string) => void }) {
  const type = getColumnType(col)
  const value = item.value == null ? '' : String(item.value)
  if (!operatorNeedsValue(item.operator)) return <span className="gk-muted">—</span>
  if (type === 'boolean') {
    return (
      <select aria-label="Value" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" />
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }
  if (type === 'singleSelect') {
    return (
      <select aria-label="Value" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" />
        {(col.valueOptions ?? []).map((o) => (
          <option key={String(optionValue(o))} value={String(optionValue(o))}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
    )
  }
  return (
    <input
      aria-label="Value"
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      placeholder="Value"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function FilterPanel<R>({ grid }: { grid: GridInstance<R> }) {
  const { api, state } = grid
  const columns = grid.options.columns.filter((c) => c.filterable !== false)
  const model = state.filterModel
  const setItems = (items: FilterItem[]) => api.setFilterModel({ ...model, items })

  const addItem = () => {
    const col = columns[0]
    if (col) setItems([...model.items, defaultFilterItem(col)])
  }
  return (
    <div className="gk-panel">
      {model.items.length === 0 && <p className="gk-muted">No filters. Add one to narrow the rows.</p>}
      {model.items.map((item, i) => {
        const col = columns.find((c) => c.field === item.field) ?? columns[0]!
        const operators = getFilterOperators(col)
        const update = (patch: Partial<FilterItem>) =>
          setItems(model.items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
        return (
          <div className="gk-filter-row" key={i}>
            {i === 1 && model.items.length > 1 ? (
              <select
                aria-label="Logic"
                value={model.logic ?? 'and'}
                onChange={(e) => api.setFilterModel({ ...model, logic: e.target.value as 'and' | 'or' })}
              >
                <option value="and">And</option>
                <option value="or">Or</option>
              </select>
            ) : (
              <span className="gk-filter-logic">{i === 0 ? 'Where' : (model.logic ?? 'and') === 'or' ? 'Or' : 'And'}</span>
            )}
            <select
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
            </select>
            <select
              aria-label="Operator"
              value={item.operator}
              onChange={(e) => update({ operator: e.target.value as FilterOperator })}
            >
              {operators.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ValueInput col={col} item={item} onChange={(value) => update({ value })} />
            <button
              type="button"
              className="gk-icon-btn"
              aria-label="Remove filter"
              onClick={() => setItems(model.items.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        )
      })}
      <div className="gk-panel-actions">
        <button type="button" onClick={addItem}>
          + Add filter
        </button>
        {model.items.length > 0 && (
          <button type="button" onClick={() => setItems([])}>
            Remove all
          </button>
        )}
      </div>
    </div>
  )
}
