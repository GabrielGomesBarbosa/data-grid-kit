import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useIsomorphicLayoutEffect } from '../core/isomorphic'
import { createPortal } from 'react-dom'

export interface PopoverProps {
  anchor: DOMRect
  onClose: () => void
  children: ReactNode
  /** accessible name */
  label: string
  role?: 'dialog' | 'menu'
  align?: 'start' | 'end'
  className?: string
}

/**
 * Floating surface rendered in a portal (the grid clips its own overflow). Closes on Escape and on
 * outside pointer-down; elements marked `data-gk-anchor` don't count as outside so a toggle button
 * can close its own popover.
 */
export function Popover({ anchor, onClose, children, label, role = 'dialog', align = 'start', className }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  // the latest onClose without making the effect below start over each time the parent renders (live data re-renders often)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Placed under the button it was opened from, kept inside the window, and written in page coordinates with
  // `position: absolute`: the browser itself moves it with the page, so it stays glued to the button through any scroll with
  // no script running (a position written from a scroll handler is a frame behind and would shake). It never closes on
  // scroll. It moves again only when its own size changes (the filter panel grows with each filter) or the window is resized.
  const origin = useRef<{ anchor: DOMRect; x: number; y: number } | null>(null)
  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (origin.current?.anchor !== anchor) {
      // what the popover is positioned against: the page, unless the site positions <body>
      const base = el.offsetParent?.getBoundingClientRect()
      origin.current = { anchor, x: base ? base.left : -window.scrollX, y: base ? base.top : -window.scrollY }
    }
    const place = () => {
      const a = anchor
      const w = el.offsetWidth
      // its natural height: measured without the cap this function put on it last time (measuring the capped height flips
      // the decision back and forth, and the popover flickers between two sizes)
      el.style.maxHeight = ''
      const h = el.offsetHeight
      const room = window.innerWidth - 8
      let left = align === 'end' ? a.right - w : a.left
      // does not fit on this side: line the other edge up with the button instead of pushing against the window's edge
      if (align === 'start' && left + w > room && a.right - w >= 8) left = a.right - w
      else if (align === 'end' && left < 8 && a.left + w <= room) left = a.left
      left = Math.max(8, Math.min(left, room - w))
      // under the button; above it when only there it fits; when it fits on neither side, on the roomier side with a
      // height that scrolls inside (pushed against the window's edge it would sit on top of its own button)
      const below = window.innerHeight - 8 - (a.bottom + 4)
      const above = a.top - 4 - 8
      let top = a.bottom + 4
      let maxHeight: number | undefined
      if (h > below && h <= above) top = a.top - h - 4
      else if (h > below) {
        maxHeight = Math.max(120, Math.max(below, above))
        if (above > below) top = a.top - Math.min(h, maxHeight) - 4
      }
      // from the window to the page, as the page was when the anchor was measured (later renders must not use today's scroll)
      const x = left - origin.current!.x
      const y = top - origin.current!.y
      // written to the element, not through React: a render does not know about it and must not undo it
      el.style.maxHeight = maxHeight === undefined ? '' : `${maxHeight}px`
      setPos((p) => (p && p.top === y && p.left === x ? p : { top: y, left: x }))
    }
    place()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place)
    observer?.observe(el)
    window.addEventListener('resize', place)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [anchor, align])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (!t || ref.current?.contains(t) || t.closest?.('[data-gk-anchor]')) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  // Move the focus inside once it is open. Not before: until it has a position the popover is `visibility: hidden`, and a
  // browser does not focus what is hidden.
  const focused = useRef(false)
  useEffect(() => {
    if (!pos || focused.current) return
    focused.current = true
    const el = ref.current
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('[role="menuitem"], input, select, button')
    first?.focus({ preventScroll: true })
  }, [pos])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (role !== 'menu' || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    if (!items.length) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]!.focus()
    e.preventDefault()
  }

  return createPortal(
    <div
      ref={ref}
      role={role}
      aria-label={label}
      className={`gk-popover ${className ?? ''}`}
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>,
    document.body,
  )
}
