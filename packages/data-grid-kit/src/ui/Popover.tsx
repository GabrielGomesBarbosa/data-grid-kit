import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    let left = align === 'end' ? anchor.right - w : anchor.left
    let top = anchor.bottom + 4
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
    if (top + h > window.innerHeight - 8) top = Math.max(8, anchor.top - h - 4)
    setPos({ top, left })
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

  // move focus inside on open
  useEffect(() => {
    const el = ref.current
    const first = el?.querySelector<HTMLElement>('[role="menuitem"], input, select, button')
    first?.focus({ preventScroll: true })
  }, [])

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
