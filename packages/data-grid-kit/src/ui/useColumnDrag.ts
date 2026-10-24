import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { planColumnMove, type DropPlacement } from '../core'
import type { GridCtx, DropTarget } from './ctx'
import { pointerDrag } from './pointerDrag'

export function useColumnDrag<R>(c: GridCtx<R>) {
  const { gridRef, scrollerRef, api } = c

  /* ---- column drag & drop ---- */

  const [drag, setDrag] = useState<{ field: string; x: number; y: number; target: DropTarget | null } | null>(null)
  const justDragged = useRef(false)

  const dropTargetAt = (clientX: number, field: string): DropTarget | null => {
    const g = gridRef.current
    const header = scrollerRef.current?.querySelector<HTMLElement>('.gk-header')
    if (!header) return null
    const hr = header.getBoundingClientRect()
    const under = document.elementFromPoint(clientX, hr.top + hr.height / 2)
    const cell = under?.closest<HTMLElement>('.gk-header-cell')
    const targetField = cell?.dataset.field
    if (!cell || !targetField || targetField === field) return null
    const rect = cell.getBoundingClientRect()
    const placement: DropPlacement = clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    // only show a drop marker where the move is allowed and actually changes something
    const ok = planColumnMove(g.options.columns, g.state, g.layout, field, targetField, placement)
    return ok ? { field: targetField, placement, rect } : null
  }

  const startColumnDrag = (field: string, e: ReactPointerEvent<HTMLElement>) => {
    let target: DropTarget | null = null
    let x = e.clientX
    let y = e.clientY
    const publish = () => {
      target = dropTargetAt(x, field)
      setDrag({ field, x, y, target })
    }
    pointerDrag(
      { x, y },
      {
        threshold: 5,
        cancelOnEscape: true,
        onStart: () => document.body.classList.add('gk-col-dragging'),
        onMove: (mx, my) => {
          x = mx
          y = my
          publish()
        },
        onFrame: (fx) => {
          x = fx
          const el = scrollerRef.current
          const g = gridRef.current
          if (!el || g.layout.pinnedSide.has(field)) return
          const r = el.getBoundingClientRect()
          const left = r.left + g.layout.leftWidth
          const right = r.right - g.layout.rightWidth
          const edge = 48
          if (fx < left + edge) el.scrollLeft -= 14
          else if (fx > right - edge) el.scrollLeft += 14
        },
        onFinish: () => {
          document.body.classList.remove('gk-col-dragging')
          setDrag(null)
        },
        onEnd: (outcome) => {
          if (outcome !== 'dropped') return
          // the click that follows pointerup belongs to the drag, not to the sort button
          justDragged.current = true
          setTimeout(() => (justDragged.current = false), 0)
          if (target) api.reorderColumn(field, target.field, target.placement)
        },
      },
    )
  }

  return { startColumnDrag, justDragged, drag }
}
