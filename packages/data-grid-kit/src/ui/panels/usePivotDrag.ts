import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { moveValueEntry, removePivotValue, type PivotModel, type PivotSection } from '../../core'
import { pointerDrag } from '../pointerDrag'

/** where a dragged field would land: a list, and the item it would go before (`null` = at the end) */
export type Target = { section: PivotSection | 'fields'; before: string | null; beforeIndex: number | null }

/**
 * Dragging a field by its grip between the lists of the pivot panel. `canValue` says whether a field can be a value,
 * `place` moves a field to a section, `update` changes the model (value entries move on their own).
 */
export function usePivotDrag(opts: {
  canValue: (field: string) => boolean
  place: (field: string, to: PivotSection | null, before?: string | null) => void
  update: (fn: (m: PivotModel) => PivotModel) => void
}) {
  const { canValue, place, update } = opts
  const [drag, setDrag] = useState<{ field: string; entry?: number; x: number; y: number; over: Target | null } | null>(null)
  const cancel = useRef<(() => void) | null>(null)
  useEffect(() => () => cancel.current?.(), [])

  const targetAt = (x: number, y: number, field: string): Target | null => {
    const el = document.elementFromPoint(x, y)
    const list = el?.closest<HTMLElement>('[data-pivot-section]')
    if (!list) return null
    const section = list.dataset.pivotSection as PivotSection | 'fields'
    if (section === 'values' && !canValue(field)) return null
    const at = (li: HTMLElement | null): Pick<Target, 'before' | 'beforeIndex'> =>
      li?.dataset.pivotField ? { before: li.dataset.pivotField, beforeIndex: li.dataset.pivotIndex === undefined ? null : Number(li.dataset.pivotIndex) } : { before: null, beforeIndex: null }
    if (section === 'fields') return { section, ...at(null) }
    const item = el!.closest<HTMLElement>('[data-pivot-field]')
    if (!item || !list.contains(item)) return { section, ...at(null) }
    const r = item.getBoundingClientRect()
    if (y < r.top + r.height / 2) return { section, ...at(item) }
    return { section, ...at(item.nextElementSibling as HTMLElement | null) }
  }

  const startDrag = (field: string, e: ReactPointerEvent<HTMLElement>, entry?: number) => {
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
          setDrag({ field, entry, x, y, over })
        },
        onFinish: () => {
          cancel.current = null
          setDrag(null)
        },
        onEnd: (outcome) => {
          if (outcome !== 'dropped' || !over) return
          // a value entry moves, or leaves, on its own: the field's other functions stay
          if (entry !== undefined && over.section === 'values') update((m) => moveValueEntry(m, entry, over!.beforeIndex))
          else if (entry !== undefined && over.section === 'fields') update((m) => removePivotValue(m, entry))
          else place(field, over.section === 'fields' ? null : over.section, over.before)
        },
      },
    )
    cancel.current = stop
  }

  const overOf = (section: PivotSection | 'fields') => (drag?.over?.section === section ? drag.over : null)
  const dropMark = (section: PivotSection, field: string, index?: number) => {
    const o = overOf(section)
    if (!o || o.before !== field) return undefined
    if (index !== undefined && drag!.entry !== undefined) return o.beforeIndex === index && drag!.entry !== index ? 'before' : undefined
    return drag!.field !== field ? 'before' : undefined
  }

  return { drag, startDrag, overOf, dropMark }
}
