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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Placed under its button and kept inside the window. It follows the button when the page or a container scrolls, and
  // moves again when its own size changes (the filter panel grows with each filter) or the window does.
  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // the button the popover belongs to, found where the anchor was when it opened (the popover is still hidden: it can't be hit)
    const button = document.elementFromPoint?.(anchor.left + anchor.width / 2, anchor.top + anchor.height / 2)?.closest('[data-gk-anchor], button') ?? null
    const place = () => {
      const a = button?.isConnected ? button.getBoundingClientRect() : anchor
      const w = el.offsetWidth
      const h = el.offsetHeight
      const room = window.innerWidth - 8
      let left = align === 'end' ? a.right - w : a.left
      // does not fit on this side: line the other edge up with the button instead of pushing against the window's edge
      if (align === 'start' && left + w > room && a.right - w >= 8) left = a.right - w
      else if (align === 'end' && left < 8 && a.left + w <= room) left = a.left
      left = Math.max(8, Math.min(left, room - w))
      let top = a.bottom + 4
      if (top + h > window.innerHeight - 8) top = Math.max(8, a.top - h - 4)
      setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }))
    }
    const onScroll = (e: Event) => {
      if (!el.contains(e.target as Node)) place() // scrolling inside the popover (a long list) must not move it
    }
    place()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place)
    observer?.observe(el)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
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
