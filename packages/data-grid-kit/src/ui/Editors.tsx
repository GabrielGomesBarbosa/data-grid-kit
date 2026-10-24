import { useBase } from './base'
import { useLocaleText } from './localeContext'
import { useRef, type ReactNode } from 'react'
import {
  formatDateInput,
  formatDateTimeInput,
  getCellValue,
  getColumnType,
  optionLabel,
  optionValue,
  parseDateInput,
  parseDateTimeInput,
  type ColumnDef,
  type EditStopReason,
} from '../core'

export type EditMove = 'down' | 'right' | 'left'

export interface EditCellParams<R = any> {
  value: unknown
  row: R
  field: string
  /** apply the value; resolves false when the update was rejected (in a row being edited it saves the row) */
  commit: (value: unknown, move?: EditMove) => Promise<boolean>
  cancel: (reason?: EditStopReason) => void
  /** record what is typed without saving: call it on every change so the value is checked (`validate`) and, in a row, kept for when the row is saved */
  setValue: (value: unknown) => void
  /** the message `validate` gave for the value, if it refused it */
  error?: string
  /** the cell is one of several of a row being edited (`editMode: 'row'`): do not commit on blur or Tab */
  rowMode: boolean
}

/** How an editor behaves where it is: alone in a cell, or one of the cells of a row being edited. */
export interface EditorBehavior {
  rowMode: boolean
  /** take the focus when it appears (the cell that was clicked, not every editor of the row) */
  autoFocus: boolean
  error?: string
  /** a value was typed (or picked) */
  onDraft: (value: unknown) => void
}

export interface EditorProps<R> {
  col: ColumnDef<R> & { renderEditCell?: (p: EditCellParams<R>) => ReactNode }
  row: R
  seed?: string
  onCommit: (value: unknown, move?: EditMove) => Promise<boolean>
  onCancel: (reason?: EditStopReason) => void
  behavior?: EditorBehavior
}

const ALONE: EditorBehavior = { rowMode: false, autoFocus: true, onDraft: () => {} }

/** Built-in editors, chosen by column type. `renderEditCell` on the column overrides them. */
export function CellEditor<R>({ col, row, seed, onCommit, onCancel, behavior = ALONE }: EditorProps<R>) {
  const value = getCellValue(col, row)
  if (col.renderEditCell) {
    return <>{col.renderEditCell({ value, row, field: col.field, commit: onCommit, cancel: onCancel, setValue: behavior.onDraft, error: behavior.error, rowMode: behavior.rowMode })}</>
  }
  const type = getColumnType(col)
  if (type === 'boolean') return <BooleanEditor value={value} onCommit={onCommit} onCancel={onCancel} behavior={behavior} />
  if (type === 'singleSelect') return <SelectEditor col={col} value={value} onCommit={onCommit} onCancel={onCancel} behavior={behavior} />
  return <InputEditor type={type} value={value} seed={seed} onCommit={onCommit} onCancel={onCancel} behavior={behavior} />
}

/** what an editor shows when its value was refused */
const invalid = (error: string | undefined) => (error ? { 'aria-invalid': true, 'data-error': '', title: error } : null)

function InputEditor({
  type,
  value,
  seed,
  onCommit,
  onCancel,
  behavior,
}: {
  type: 'string' | 'number' | 'date' | 'dateTime' | 'boolean' | 'singleSelect' | 'actions'
  value: unknown
  seed?: string
  onCommit: EditorProps<unknown>['onCommit']
  onCancel: EditorProps<unknown>['onCancel']
  behavior: EditorBehavior
}) {
  const { Input } = useBase()
  const { text: t } = useLocaleText()
  const ref = useRef<HTMLInputElement | null>(null)
  // a commit/cancel fires at most once; blur after Enter/Escape must not commit again
  const settled = useRef(false)

  const initial =
    seed !== undefined
      ? seed
      : type === 'date' && value instanceof Date
        ? formatDateInput(value)
        : type === 'dateTime' && value instanceof Date
          ? formatDateTimeInput(value)
          : value == null
            ? ''
            : String(value)

  const read = (): unknown => {
    const text = ref.current?.value ?? ''
    if (type === 'number') {
      if (text.trim() === '') return null
      const n = Number(text)
      return Number.isNaN(n) ? value : n
    }
    if (type === 'date') return text === '' ? null : (parseDateInput(text) ?? value)
    if (type === 'dateTime') return text === '' ? null : (parseDateTimeInput(text) ?? value)
    return text
  }

  const finish = async (move?: EditMove) => {
    if (settled.current) return
    settled.current = true
    const ok = await onCommit(read(), move)
    if (!ok) settled.current = false // rejected: stay in edit mode
  }

  return (
    <Input
      ref={(el) => {
        ref.current = el
        if (el && behavior.autoFocus && document.activeElement !== el) {
          el.focus({ preventScroll: true })
          // typed-over cells put the caret after the typed char; edit-in-place selects everything
          if (seed === undefined) el.select?.()
          else el.setSelectionRange?.(el.value.length, el.value.length)
        }
      }}
      className="gk-editor"
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'dateTime' ? 'datetime-local' : 'text'}
      defaultValue={initial}
      aria-label={t.editCell}
      {...invalid(behavior.error)}
      onChange={() => behavior.onDraft(read())}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          e.preventDefault()
          void finish('down')
        } else if (e.key === 'Tab') {
          // alone in a cell Tab saves and moves on; in a row it moves to the next editor, and the row is saved later
          if (behavior.rowMode) return
          e.preventDefault()
          void finish(e.shiftKey ? 'left' : 'right')
        } else if (e.key === 'Escape') {
          e.preventDefault()
          settled.current = true
          onCancel('escape')
        }
      }}
      onBlur={() => {
        if (!behavior.rowMode) void finish()
      }}
    />
  )
}

function BooleanEditor({
  value,
  onCommit,
  onCancel,
  behavior,
}: {
  value: unknown
  onCommit: EditorProps<unknown>['onCommit']
  onCancel: EditorProps<unknown>['onCancel']
  behavior: EditorBehavior
}) {
  const { Checkbox } = useBase()
  const { text: t } = useLocaleText()
  return (
    <Checkbox
      autoFocus={behavior.autoFocus}
      type="checkbox"
      className="gk-checkbox"
      aria-label={t.editCell}
      defaultChecked={value === true}
      {...invalid(behavior.error)}
      onChange={(e) => {
        if (behavior.rowMode) behavior.onDraft(e.target.checked)
        else void onCommit(e.target.checked)
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') onCancel('escape')
        if (e.key === 'Enter') void onCommit(behavior.rowMode ? e.currentTarget.checked : !e.currentTarget.checked, 'down')
      }}
      onBlur={() => {
        if (!behavior.rowMode) onCancel('blur')
      }}
    />
  )
}

function SelectEditor<R>({
  col,
  value,
  onCommit,
  onCancel,
  behavior,
}: {
  col: ColumnDef<R>
  value: unknown
  onCommit: EditorProps<R>['onCommit']
  onCancel: EditorProps<R>['onCancel']
  behavior: EditorBehavior
}) {
  const { Select } = useBase()
  const { text: t } = useLocaleText()
  const options = col.valueOptions ?? []
  return (
    <Select
      autoFocus={behavior.autoFocus}
      className="gk-editor"
      aria-label={t.editCell}
      defaultValue={value == null ? '' : String(value)}
      {...invalid(behavior.error)}
      onChange={(e) => {
        const picked = options.find((o) => String(optionValue(o)) === e.target.value)
        const chosen = picked === undefined ? e.target.value : optionValue(picked)
        if (behavior.rowMode) behavior.onDraft(chosen)
        else void onCommit(chosen)
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') onCancel('escape')
        if (e.key === 'Enter' && behavior.rowMode) void onCommit(undefined, 'down')
      }}
      onBlur={() => {
        if (!behavior.rowMode) onCancel('blur')
      }}
    >
      <option value="" />
      {options.map((o) => (
        <option key={String(optionValue(o))} value={String(optionValue(o))}>
          {optionLabel(o)}
        </option>
      ))}
    </Select>
  )
}
