import type { PivotModel } from './types'

/** The model without what the user switched off: this is what the table is built from. */
export function visiblePivot(model: PivotModel): { rows: string[]; columns: PivotModel['columns']; values: PivotModel['values'] } {
  const off = model.hiddenRows
  return {
    rows: off?.length ? model.rows.filter((f) => !off.includes(f)) : model.rows,
    columns: model.columns.some((c) => c.hidden) ? model.columns.filter((c) => !c.hidden) : model.columns,
    values: model.values.some((v) => v.hidden) ? model.values.filter((v) => !v.hidden) : model.values,
  }
}

export type PivotEntry = { section: 'rows'; field: string } | { section: 'columns'; field: string } | { section: 'values'; index: number }

/** Switch one entry on or off. Returns the same object when nothing changes. */
export function setPivotHidden(model: PivotModel, entry: PivotEntry, hidden: boolean): PivotModel {
  if (entry.section === 'rows') {
    const off = (model.hiddenRows ?? []).filter((f) => f !== entry.field)
    if (hidden && model.rows.includes(entry.field)) off.push(entry.field)
    const same = off.length === (model.hiddenRows ?? []).length && off.every((f) => model.hiddenRows!.includes(f))
    return same ? model : { ...model, hiddenRows: off.length ? off : undefined }
  }
  const list = entry.section === 'columns' ? model.columns : model.values
  const at = entry.section === 'columns' ? list.findIndex((c) => c.field === entry.field) : entry.index
  const current = list[at]
  if (!current || !!current.hidden === hidden) return model
  const next = list.map((x, i) => (i === at ? { ...x, hidden: hidden || undefined } : x)) as typeof list
  return entry.section === 'columns' ? { ...model, columns: next as PivotModel['columns'] } : { ...model, values: next as PivotModel['values'] }
}

/**
 * Another entry for a field that is already a value, with a function it does not use yet (`aggFunc` when given). Placed
 * right after the entry it copies. Returns the same object when the field is not a value or the pair exists.
 */
export function addPivotValue(model: PivotModel, field: string, aggFunc: string): PivotModel {
  const at = model.values.map((v) => v.field).lastIndexOf(field)
  if (at < 0 || model.values.some((v) => v.field === field && v.aggFunc === aggFunc)) return model
  const values = model.values.slice()
  values.splice(at + 1, 0, { field, aggFunc })
  return { ...model, values }
}

/** Remove one value entry (the others of the same field stay). */
export function removePivotValue(model: PivotModel, index: number): PivotModel {
  if (index < 0 || index >= model.values.length) return model
  return { ...model, values: model.values.filter((_, i) => i !== index) }
}

/** Move the value entry `from` before the entry `before` (the end when null). */
export function moveValueEntry(model: PivotModel, from: number, before: number | null): PivotModel {
  const entry = model.values[from]
  if (!entry || before === from || before === from + 1) return model
  const values = model.values.filter((_, i) => i !== from)
  const at = before === null ? values.length : before > from ? before - 1 : before
  values.splice(at, 0, entry)
  return { ...model, values }
}

/** Change the function of one value entry; refused (same object) when that field already has it in another entry. */
export function setValueFunc(model: PivotModel, index: number, aggFunc: string): PivotModel {
  const entry = model.values[index]
  if (!entry || entry.aggFunc === aggFunc) return model
  if (model.values.some((v, i) => i !== index && v.field === entry.field && v.aggFunc === aggFunc)) return model
  return { ...model, values: model.values.map((v, i) => (i === index ? { ...v, aggFunc } : v)) }
}
