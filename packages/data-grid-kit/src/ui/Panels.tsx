import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  aggregationLabel,
  availableAggregations,
  defaultFilterItem,
  getColumnType,
  getFilterOperators,
  isBuiltinAggregation,
  movePivotField,
  neighborInGroup,
  operatorNeedsValue,
  optionLabel,
  optionValue,
  type ColumnDef,
  type FilterItem,
  type FilterOperator,
  type GridInstance,
  type PivotModel,
  type PivotSection,
} from '../core'

const title = (c: ColumnDef) => c.headerName ?? c.field

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

/* ------------------------------------------------------------- column menu */

function Item({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="menuitem" className="gk-menu-item" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

export function ColumnMenu<R>({
  grid,
  field,
  onClose,
  onFilter,
  aggregation = true,
}: {
  grid: GridInstance<R>
  field: string
  onClose: () => void
  onFilter: (field: string) => void
  aggregation?: boolean
}) {
  const { api, state, layout, options } = grid
  const col = options.columns.find((c) => c.field === field)
  if (!col) return null
  const sort = state.sortModel.find((s) => s.field === field)
  const side = layout.pinnedSide.get(field)
  const visibleCount = layout.all.length
  const aggChoices = availableAggregations(col, options.aggregationFunctions)
  const currentAgg = state.aggregationModel[field]
  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }
  return (
    <>
      {col.sortable !== false && (
        <>
          <Item disabled={sort?.direction === 'asc'} onClick={run(() => api.setSortModel([{ field, direction: 'asc' }]))}>
            Sort ascending
          </Item>
          <Item disabled={sort?.direction === 'desc'} onClick={run(() => api.setSortModel([{ field, direction: 'desc' }]))}>
            Sort descending
          </Item>
          {sort && (
            <Item onClick={run(() => api.setSortModel(state.sortModel.filter((s) => s.field !== field)))}>Unsort</Item>
          )}
          <hr className="gk-menu-sep" />
        </>
      )}
      {col.filterable !== false && <Item onClick={() => onFilter(field)}>Filter…</Item>}
      {col.pinnable !== false && (
        <>
          <Item disabled={side === 'left'} onClick={run(() => api.pinColumn(field, 'left'))}>
            Pin to left
          </Item>
          <Item disabled={side === 'right'} onClick={run(() => api.pinColumn(field, 'right'))}>
            Pin to right
          </Item>
          {side && <Item onClick={run(() => api.pinColumn(field, null))}>Unpin</Item>}
        </>
      )}
      {col.reorderable !== false && (
        <>
          <Item disabled={!neighborInGroup(layout, field, -1)} onClick={run(() => api.moveColumnBy(field, -1))}>
            Move left
          </Item>
          <Item disabled={!neighborInGroup(layout, field, 1)} onClick={run(() => api.moveColumnBy(field, 1))}>
            Move right
          </Item>
        </>
      )}
      {aggregation && aggChoices.length > 0 && (
        <>
          <hr className="gk-menu-sep" />
          <div className="gk-menu-heading" role="presentation">
            Aggregate
          </div>
          <Item onClick={run(() => api.setAggregation(field, null))}>
            {currentAgg ? '\u00a0\u00a0' : '✓ '}None
          </Item>
          {aggChoices.map((name) => (
            <Item key={name} onClick={run(() => api.setAggregation(field, name))}>
              {currentAgg === name ? '✓ ' : '\u00a0\u00a0'}
              {aggregationLabel(name, options.aggregationFunctions)}
            </Item>
          ))}
        </>
      )}
      <hr className="gk-menu-sep" />
      <Item disabled={visibleCount <= 1} onClick={run(() => api.setColumnVisibility(field, false))}>
        Hide column
      </Item>
    </>
  )
}

/* ------------------------------------------------------------- pivot panel */

type Target = { section: PivotSection | 'fields'; before: string | null }

/**
 * Choose what the pivot table is made of: row groups, column values and the aggregated values. Fields move by dragging
 * their grip between the lists (or by the buttons, which do the same for keyboard users).
 */
export function PivotPanel<R>({ grid }: { grid: GridInstance<R> }) {
  const { api, state, options } = grid
  const model = state.pivotModel
  const fields: ColumnDef[] = (grid.pivot?.sourceColumns ?? options.columns).filter((c) => !c.pivot)
  const byField = new Map(fields.map((c) => [c.field, c]))
  const name = (field: string) => (byField.has(field) ? title(byField.get(field)!) : field)
  const canValue = (field: string) => {
    const c = byField.get(field)
    return !!c && c.aggregable !== false && availableAggregations(c).some(isBuiltinAggregation)
  }
  const defaultFunc = (field: string) => {
    const c = byField.get(field)
    return (c ? availableAggregations(c) : []).find(isBuiltinAggregation) ?? 'count'
  }
  const place = (field: string, to: PivotSection | null, before: string | null = null) =>
    api.setPivotModel((m) => movePivotField(m, field, to, before, defaultFunc))
  const update = (fn: (m: PivotModel) => PivotModel) => api.setPivotModel(fn)

  /* ---- dragging a field by its grip ---- */
  const [drag, setDrag] = useState<{ field: string; x: number; y: number; over: Target | null } | null>(null)
  const cancel = useRef<(() => void) | null>(null)
  useEffect(() => () => cancel.current?.(), [])

  const targetAt = (x: number, y: number, field: string): Target | null => {
    const el = document.elementFromPoint(x, y)
    const list = el?.closest<HTMLElement>('[data-pivot-section]')
    if (!list) return null
    const section = list.dataset.pivotSection as PivotSection | 'fields'
    if (section === 'values' && !canValue(field)) return null
    if (section === 'fields') return { section, before: null }
    const item = el!.closest<HTMLElement>('[data-pivot-field]')
    if (!item || !list.contains(item)) return { section, before: null }
    const r = item.getBoundingClientRect()
    if (y < r.top + r.height / 2) return { section, before: item.dataset.pivotField! }
    return { section, before: (item.nextElementSibling as HTMLElement | null)?.dataset.pivotField ?? null }
  }

  const startDrag = (field: string, e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    let active = false
    let over: Target | null = null
    const move = (ev: PointerEvent) => {
      if (!active && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return
      active = true
      over = targetAt(ev.clientX, ev.clientY, field)
      setDrag({ field, x: ev.clientX, y: ev.clientY, over })
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', abort)
      window.removeEventListener('keydown', key, true)
      cancel.current = null
      setDrag(null)
    }
    const up = () => {
      const drop = active ? over : null
      end()
      if (drop) place(field, drop.section === 'fields' ? null : drop.section, drop.before)
    }
    const abort = () => end()
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      ev.stopPropagation() // cancel the drag, not the panel
      end()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', abort)
    window.addEventListener('keydown', key, true)
    cancel.current = end
  }

  const grip = (field: string) => (
    <span
      className="gk-pivot-grip"
      aria-hidden="true"
      title={`Drag ${name(field)} to another list`}
      onPointerDown={(e) => startDrag(field, e)}
    >
      ⋮⋮
    </span>
  )
  const overOf = (section: PivotSection | 'fields') => (drag?.over?.section === section ? drag.over : null)
  const dropMark = (section: PivotSection, field: string) => {
    const o = overOf(section)
    return o && o.before === field && drag!.field !== field ? 'before' : undefined
  }

  const arrows = (list: string[], field: string, section: PivotSection) => {
    const i = list.indexOf(field)
    return (
      <span className="gk-pivot-actions">
        <button type="button" aria-label={`Move ${name(field)} up`} disabled={i === 0} onClick={() => place(field, section, list[i - 1]!)}>
          ↑
        </button>
        <button type="button" aria-label={`Move ${name(field)} down`} disabled={i === list.length - 1} onClick={() => place(field, section, list[i + 2] ?? null)}>
          ↓
        </button>
        <button type="button" aria-label={`Remove ${name(field)}`} onClick={() => place(field, null)}>
          ✕
        </button>
      </span>
    )
  }
  const empty = (text: string) => <li className="gk-muted">{text}</li>
  const list = (section: PivotSection, label: string) => ({
    className: 'gk-pivot-list',
    'aria-label': label,
    'data-pivot-section': section,
    'data-over': overOf(section) ? '' : undefined,
    'data-drop-end': overOf(section)?.before === null ? '' : undefined,
  })
  const rowFields = model.rows
  const columnFields = model.columns.map((c) => c.field)
  const valueFields = model.values.map((v) => v.field)
  const where = (f: string): PivotSection | null => (rowFields.includes(f) ? 'rows' : columnFields.includes(f) ? 'columns' : valueFields.includes(f) ? 'values' : null)

  return (
    <div className="gk-panel gk-pivot" data-dragging={drag ? '' : undefined}>
      <label className="gk-pivot-mode">
        <input type="checkbox" checked={state.pivotMode} onChange={(e) => api.setPivotMode(e.target.checked)} /> Pivot mode
      </label>

      <h4>Rows</h4>
      <ul {...list('rows', 'Pivot rows')}>
        {model.rows.length === 0 && empty('Drag a field here to group the rows by it')}
        {model.rows.map((f) => (
          <li key={f} data-pivot-field={f} data-drop={dropMark('rows', f)} data-dragged={drag?.field === f ? '' : undefined}>
            {grip(f)}
            <span>{name(f)}</span>
            {arrows(rowFields, f, 'rows')}
          </li>
        ))}
      </ul>

      <h4>Columns</h4>
      <ul {...list('columns', 'Pivot columns')}>
        {model.columns.length === 0 && empty('Drag a field here to spread it into columns')}
        {model.columns.map((c) => (
          <li key={c.field} data-pivot-field={c.field} data-drop={dropMark('columns', c.field)} data-dragged={drag?.field === c.field ? '' : undefined}>
            {grip(c.field)}
            <span>{name(c.field)}</span>
            <select
              aria-label={`Sort ${name(c.field)} columns`}
              value={c.sort ?? 'asc'}
              onChange={(e) =>
                update((m) => ({ ...m, columns: m.columns.map((x) => (x.field === c.field ? { ...x, sort: e.target.value as 'asc' | 'desc' } : x)) }))
              }
            >
              <option value="asc">A → Z</option>
              <option value="desc">Z → A</option>
            </select>
            {arrows(columnFields, c.field, 'columns')}
          </li>
        ))}
      </ul>

      <h4>Values</h4>
      <ul {...list('values', 'Pivot values')}>
        {model.values.length === 0 && empty('Drag a field here to aggregate it')}
        {model.values.map((v) => {
          const col = byField.get(v.field)
          const fns = (col ? availableAggregations(col) : []).filter(isBuiltinAggregation)
          return (
            <li key={v.field} data-pivot-field={v.field} data-drop={dropMark('values', v.field)} data-dragged={drag?.field === v.field ? '' : undefined}>
              {grip(v.field)}
              <span>{name(v.field)}</span>
              <select
                aria-label={`Function for ${name(v.field)}`}
                value={v.aggFunc}
                onChange={(e) => update((m) => ({ ...m, values: m.values.map((x) => (x.field === v.field ? { ...x, aggFunc: e.target.value } : x)) }))}
              >
                {fns.map((f) => (
                  <option key={f} value={f}>
                    {aggregationLabel(f)}
                  </option>
                ))}
              </select>
              {arrows(valueFields, v.field, 'values')}
            </li>
          )
        })}
      </ul>

      <h4>Fields</h4>
      <ul className="gk-pivot-list gk-pivot-fields" aria-label="Available fields" data-pivot-section="fields" data-over={overOf('fields') ? '' : undefined}>
        {fields.map((c) => {
          const at = where(c.field)
          return (
            <li key={c.field} data-pivot-field={c.field} data-used={at ? '' : undefined} data-dragged={drag?.field === c.field ? '' : undefined}>
              {grip(c.field)}
              <span>{title(c)}</span>
              <span className="gk-pivot-actions">
                {(['rows', 'columns', 'values'] as PivotSection[]).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    disabled={at === sec || (sec === 'values' && !canValue(c.field))}
                    aria-label={`Add ${title(c)} to ${sec}`}
                    onClick={() => place(c.field, sec)}
                  >
                    {sec === 'rows' ? 'Row' : sec === 'columns' ? 'Column' : 'Value'}
                  </button>
                ))}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="gk-pivot-hint">Drag a field's grip to a list, or onto Fields to remove it. Esc cancels.</p>
      {drag && (
        <div className="gk-pivot-ghost" style={{ left: drag.x + 10, top: drag.y + 10 }} aria-hidden="true">
          {name(drag.field)}
          {drag.over ? '' : ' ✕'}
        </div>
      )}
    </div>
  )
}
