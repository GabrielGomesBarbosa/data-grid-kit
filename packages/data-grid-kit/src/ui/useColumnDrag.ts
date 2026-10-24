import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { planColumnMove, type DropPlacement } from '../core'
import type { GridCtx, DropTarget } from './ctx'

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
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false
    let x = startX
    let target: DropTarget | null = null
    let raf = 0

    const publish = (y: number) => {
      target = dropTargetAt(x, field)
      setDrag({ field, x, y, target })
    }
    const autoScroll = () => {
      const el = scrollerRef.current
      const g = gridRef.current
      if (el && dragging && !g.layout.pinnedSide.has(field)) {
        const r = el.getBoundingClientRect()
        const left = r.left + g.layout.leftWidth
        const right = r.right - g.layout.rightWidth
        const edge = 48
        if (x < left + edge) el.scrollLeft -= 14
        else if (x > right - edge) el.scrollLeft += 14
      }
      raf = requestAnimationFrame(autoScroll)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', key, true)
      cancelAnimationFrame(raf)
      document.body.classList.remove('gk-col-dragging')
      setDrag(null)
    }
    const move = (ev: PointerEvent) => {
      x = ev.clientX
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return
        dragging = true
        document.body.classList.add('gk-col-dragging')
        raf = requestAnimationFrame(autoScroll)
      }
      publish(ev.clientY)
    }
    const up = () => {
      const drop = target
      const wasDragging = dragging
      cleanup()
      if (!wasDragging) return
      // the click that follows pointerup belongs to the drag, not to the sort button
      justDragged.current = true
      setTimeout(() => (justDragged.current = false), 0)
      if (drop) api.reorderColumn(field, drop.field, drop.placement)
    }
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      ev.stopPropagation()
      target = null
      dragging = false
      cleanup()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', key, true)
  }

  return { startColumnDrag, justDragged, drag }
}
