import { useBase } from '../base'
import { useIcons } from '../icons'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { aggregationLabel, availableAggregations, isBuiltinAggregation, movePivotField, type ColumnDef, type GridInstance, type PivotModel, type PivotSection } from '../../core'
import { pointerDrag } from '../pointerDrag'
import { title } from './shared'
import { cx } from '../cx'
import type { PanelProps } from './types'

/* ------------------------------------------------------------- pivot panel */

type Target = { section: PivotSection | 'fields'; before: string | null }

/**
 * Choose what the pivot table is made of: row groups, column values and the aggregated values. Fields move by dragging
 * their grip between the lists (or by the buttons, which do the same for keyboard users).
 */
export function PivotPanel<R>({ grid, className }: PanelProps<R>) {
  const { Button, Checkbox, Select } = useBase()
  const icons = useIcons()
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
    let over: Target | null = null
    const stop = pointerDrag(
      { x: e.clientX, y: e.clientY },
      {
        threshold: 4,
        cancelOnEscape: true,
        onMove: (x, y) => {
          over = targetAt(x, y, field)
          setDrag({ field, x, y, over })
        },
        onFinish: () => {
          cancel.current = null
          setDrag(null)
        },
        onEnd: (outcome) => {
          if (outcome === 'dropped' && over) place(field, over.section === 'fields' ? null : over.section, over.before)
        },
      },
    )
    cancel.current = stop
  }

  const grip = (field: string) => (
    <span
      className="gk-pivot-grip"
      aria-hidden="true"
      title={`Drag ${name(field)} to another list`}
      onPointerDown={(e) => startDrag(field, e)}
    >
      <icons.dragHandle />
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
        <Button type="button" aria-label={`Move ${name(field)} up`} disabled={i === 0} onClick={() => place(field, section, list[i - 1]!)}>
          <icons.moveUp />
        </Button>
        <Button type="button" aria-label={`Move ${name(field)} down`} disabled={i === list.length - 1} onClick={() => place(field, section, list[i + 2] ?? null)}>
          <icons.moveDown />
        </Button>
        <Button type="button" aria-label={`Remove ${name(field)}`} onClick={() => place(field, null)}>
          <icons.close />
        </Button>
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
    <div className={cx('gk-panel gk-pivot', className)} data-dragging={drag ? '' : undefined}>
      <label className="gk-pivot-mode">
        <Checkbox type="checkbox" checked={state.pivotMode} onChange={(e) => api.setPivotMode(e.target.checked)} /> Pivot mode
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
            <Select
              aria-label={`Sort ${name(c.field)} columns`}
              value={c.sort ?? 'asc'}
              onChange={(e) =>
                update((m) => ({ ...m, columns: m.columns.map((x) => (x.field === c.field ? { ...x, sort: e.target.value as 'asc' | 'desc' } : x)) }))
              }
            >
              <option value="asc">A → Z</option>
              <option value="desc">Z → A</option>
            </Select>
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
              <Select
                aria-label={`Function for ${name(v.field)}`}
                value={v.aggFunc}
                onChange={(e) => update((m) => ({ ...m, values: m.values.map((x) => (x.field === v.field ? { ...x, aggFunc: e.target.value } : x)) }))}
              >
                {fns.map((f) => (
                  <option key={f} value={f}>
                    {aggregationLabel(f)}
                  </option>
                ))}
              </Select>
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
                  <Button
                    key={sec}
                    type="button"
                    disabled={at === sec || (sec === 'values' && !canValue(c.field))}
                    aria-label={`Add ${title(c)} to ${sec}`}
                    onClick={() => place(c.field, sec)}
                  >
                    {sec === 'rows' ? 'Row' : sec === 'columns' ? 'Column' : 'Value'}
                  </Button>
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
          {drag.over ? '' : <icons.close />}
        </div>
      )}
    </div>
  )
}
