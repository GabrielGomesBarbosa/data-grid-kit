import { useRef, type ReactNode } from 'react'
import {
  formatDateInput,
  getCellValue,
  getColumnType,
  optionLabel,
  optionValue,
  parseDateInput,
  type ColumnDef,
} from '../core'

export type EditMove = 'down' | 'right' | 'left'

export interface EditCellParams<R = any> {
  value: unknown
  row: R
  field: string
  /** apply the value; resolves false when the update was rejected */
  commit: (value: unknown, move?: EditMove) => Promise<boolean>
  cancel: () => void
}

export interface EditorProps<R> {
  col: ColumnDef<R> & { renderEditCell?: (p: EditCellParams<R>) => ReactNode }
  row: R
  seed?: string
  onCommit: (value: unknown, move?: EditMove) => Promise<boolean>
  onCancel: () => void
}

/** Built-in editors, chosen by column type. `renderEditCell` on the column overrides them. */
export function CellEditor<R>({ col, row, seed, onCommit, onCancel }: EditorProps<R>) {
  const value = getCellValue(col, row)
  if (col.renderEditCell) {
    return <>{col.renderEditCell({ value, row, field: col.field, commit: onCommit, cancel: onCancel })}</>
  }
  const type = getColumnType(col)
  if (type === 'boolean') return <BooleanEditor value={value} onCommit={onCommit} onCancel={onCancel} />
  if (type === 'singleSelect') return <SelectEditor col={col} value={value} onCommit={onCommit} onCancel={onCancel} />
  return <InputEditor type={type} value={value} seed={seed} onCommit={onCommit} onCancel={onCancel} />
}

function InputEditor({
  type,
  value,
  seed,
  onCommit,
  onCancel,
}: {
  type: 'string' | 'number' | 'date' | 'boolean' | 'singleSelect'
  value: unknown
  seed?: string
  onCommit: EditorProps<unknown>['onCommit']
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement | null>(null)
  // a commit/cancel fires at most once; blur after Enter/Escape must not commit again
  const settled = useRef(false)

  const initial =
    seed !== undefined
      ? seed
      : type === 'date' && value instanceof Date
        ? formatDateInput(value)
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
    return text
  }

  const finish = async (move?: EditMove) => {
    if (settled.current) return
    settled.current = true
    const ok = await onCommit(read(), move)
    if (!ok) settled.current = false // rejected: stay in edit mode
  }

  return (
    <input
      ref={(el) => {
        ref.current = el
        if (el && document.activeElement !== el) {
          el.focus({ preventScroll: true })
          // typed-over cells put the caret after the typed char; edit-in-place selects everything
          if (seed === undefined) el.select?.()
          else el.setSelectionRange?.(el.value.length, el.value.length)
        }
      }}
      className="gk-editor"
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      defaultValue={initial}
      aria-label="Edit cell"
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          e.preventDefault()
          void finish('down')
        } else if (e.key === 'Tab') {
          e.preventDefault()
          void finish(e.shiftKey ? 'left' : 'right')
        } else if (e.key === 'Escape') {
          e.preventDefault()
          settled.current = true
          onCancel()
        }
      }}
      onBlur={() => void finish()}
    />
  )
}

function BooleanEditor({
  value,
  onCommit,
  onCancel,
}: {
  value: unknown
  onCommit: EditorProps<unknown>['onCommit']
  onCancel: () => void
}) {
  return (
    <input
      autoFocus
      type="checkbox"
      className="gk-checkbox"
      aria-label="Edit cell"
      defaultChecked={value === true}
      onChange={(e) => void onCommit(e.target.checked)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') onCancel()
        if (e.key === 'Enter') void onCommit(!(e.currentTarget.checked), 'down')
      }}
      onBlur={onCancel}
    />
  )
}

function SelectEditor<R>({
  col,
  value,
  onCommit,
  onCancel,
}: {
  col: ColumnDef<R>
  value: unknown
  onCommit: EditorProps<R>['onCommit']
  onCancel: () => void
}) {
  const options = col.valueOptions ?? []
  return (
    <select
      autoFocus
      className="gk-editor"
      aria-label="Edit cell"
      defaultValue={value == null ? '' : String(value)}
      onChange={(e) => {
        const picked = options.find((o) => String(optionValue(o)) === e.target.value)
        void onCommit(picked === undefined ? e.target.value : optionValue(picked))
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={onCancel}
    >
      <option value="" />
      {options.map((o) => (
        <option key={String(optionValue(o))} value={String(optionValue(o))}>
          {optionLabel(o)}
        </option>
      ))}
    </select>
  )
}
