import type { ReactNode } from 'react'
import { useBase } from '../base'
import { useIcons } from '../icons'
import { defaultFilterItem, getColumnType, getFilterOperators, operatorNeedsValue, optionLabel, optionValue, type ColumnDef, type FilterItem, type FilterOperator, type GridInstance, type GridLocaleText } from '../../core'
import { title } from './shared'
import { cx } from '../cx'
import type { UIColumnDef } from '../types'
import { useLocaleText } from '../localeContext'
import type { PanelProps } from './types'

/* ------------------------------------------------------------ filter panel */

/** the operator names core gives, by the key that translates them (the symbols = > ≥ < ≤ are the same everywhere) */
const OPERATOR_TEXT: Record<string, keyof GridLocaleText> = {
  contains: 'filterContains',
  'does not contain': 'filterDoesNotContain',
  'does not equal': 'filterDoesNotEqual',
  'is not': 'filterIsNot',
  'is any of': 'filterIsAnyOf',
  equals: 'filterEquals',
  'starts with': 'filterStartsWith',
  'ends with': 'filterEndsWith',
  'is empty': 'filterIsEmpty',
  'is not empty': 'filterIsNotEmpty',
  is: 'filterIs',
}

function ValueInput({ col, item, onChange, first }: { col: UIColumnDef; item: FilterItem; onChange: (v: unknown) => void; first?: boolean }) {
  const { Input, Select } = useBase()
  const { text: t } = useLocaleText()
  const type = getColumnType(col)
  const value = item.value == null ? '' : String(item.value)
  const focus = first ? { 'data-autofocus': '' } : undefined // the popover puts the focus here when it opens
  if (!operatorNeedsValue(item.operator, col)) return <span className="gk-muted">-</span>
  // an operator the column brought brings its own input, if it wants one
  const own = col.filterOperators?.find((o) => o.value === item.operator)
  if (own?.renderInput) return <>{own.renderInput({ item, onChange, focusProps: focus ?? {} })}</>
  if (item.operator === 'isAnyOf') {
    return <Input aria-label={t.filterValue} type="text" placeholder={t.filterListHint} value={Array.isArray(item.value) ? item.value.join(', ') : value} onChange={(e) => onChange(e.target.value)} {...focus} />
  }
  if (type === 'boolean') {
    return (
      <Select aria-label={t.filterValue} value={value} onChange={(e) => onChange(e.target.value)} {...focus}>
        <option value="" />
        <option value="true">{t.filterTrue}</option>
        <option value="false">{t.filterFalse}</option>
      </Select>
    )
  }
  if (type === 'singleSelect') {
    return (
      <Select aria-label={t.filterValue} value={value} onChange={(e) => onChange(e.target.value)} {...focus}>
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
      aria-label={t.filterValue}
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'dateTime' ? 'datetime-local' : 'text'}
      placeholder={t.filterValue}
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

export function FilterPanel<R>({ grid, className, onClose }: PanelProps<R>) {
  const { Button, Select } = useBase()
  const icons = useIcons()
  const { api, state, text: t } = grid
  const columns = (grid.options.columns as UIColumnDef[]).filter((c) => c.filterable !== false)
  const model = state.filterModel
  // With no filter yet the panel opens on one ready row, so there is something to fill in at once. The row is only shown:
  // it becomes a filter in the model when you change something in it.
  const blank = model.items.length === 0 && columns[0] ? [defaultFilterItem(columns[0])] : []
  const items = model.items.length ? model.items : blank
  const setItems = (next: FilterItem[]) => api.setFilterModel({ ...model, items: next })

  // taking away the last row (a filter, or the blank one) is done with the panel: it closes, like a dialog you are finished with
  const remove = (i: number) => {
    if (items.length === 1) {
      if (model.items.length) setItems([])
      onClose?.()
    } else setItems(items.filter((_, j) => j !== i))
  }

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
            <Button type="button" className="gk-icon-btn" aria-label={t.filterRemove} title={t.filterRemove} onClick={() => remove(i)}>
              <icons.close />
            </Button>
            {i === 1 && items.length > 1 ? (
              <Select
                aria-label={t.filterLogic}
                value={model.logic ?? 'and'}
                onChange={(e) => api.setFilterModel({ ...model, logic: e.target.value as 'and' | 'or' })}
              >
                <option value="and">{t.filterAnd}</option>
                <option value="or">{t.filterOr}</option>
              </Select>
            ) : (
              <span className="gk-filter-logic">{i === 0 ? t.filterWhere : (model.logic ?? 'and') === 'or' ? t.filterOr : t.filterAnd}</span>
            )}
            <Field label={t.filterColumn}>
              <Select
                aria-label={t.filterColumn}
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
            <Field label={t.filterOperator}>
              <Select aria-label={t.filterOperator} value={item.operator} onChange={(e) => update({ operator: e.target.value as FilterOperator })}>
                {operators.map((o) => (
                  <option key={o.value} value={o.value}>
                    {OPERATOR_TEXT[o.label] ? t[OPERATOR_TEXT[o.label]!] as string : o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.filterValue}>
              <ValueInput col={col} item={item} first={i === 0} onChange={(value) => update({ value })} />
            </Field>
          </div>
        )
      })}
      <div className="gk-panel-actions gk-filter-actions">
        <Button type="button" className="gk-link-btn" onClick={addItem}>
          <icons.add /> {t.filterAdd}
        </Button>
        {model.items.length > 0 && (
          <Button type="button" className="gk-link-btn" onClick={() => setItems([])}>
            <icons.trash /> {t.filterRemoveAll}
          </Button>
        )}
      </div>
    </div>
  )
}
