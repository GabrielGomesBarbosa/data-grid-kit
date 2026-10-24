export interface PointerDragOptions {
  /** pixels the pointer must travel before the drag starts; below it a release is a plain click (default 0: starts at once) */
  threshold?: number
  /** Escape cancels the drag (and is not passed on, so it does not also close a panel) */
  cancelOnEscape?: boolean
  /** the pointer crossed the threshold */
  onStart?: () => void
  /** the pointer moved while the drag is on */
  onMove?: (x: number, y: number, event: PointerEvent) => void
  /** every animation frame while the drag is on: auto-scrolling near an edge */
  onFrame?: (x: number, y: number) => void
  /**
   * Touch only (the start's `pointerType` is 'touch'): the drag begins after the finger rests this many ms, instead of
   * after the threshold. Moving more than `touchSlop` pixels before that is a scroll, so the drag gives up and lets
   * the browser pan. Once it has begun the page does not scroll under the finger.
   */
  touchHoldMs?: number
  /** pixels the finger may drift while waiting for the hold (default 10) */
  touchSlop?: number
  /** called first when the drag ends, however it ends: take the drag visuals down */
  onFinish?: () => void
  /** 'dropped': released after the drag started. 'clicked': released before the threshold. 'cancelled': Escape, pointercancel or stop() */
  onEnd?: (outcome: 'dropped' | 'clicked' | 'cancelled') => void
}

/**
 * The one pointer-drag machine behind dragging cells, rows, columns and pivot fields: listens on the window,
 * waits for a threshold, runs a frame loop for auto-scroll and ends on release or Escape.
 * Returns a function that cancels the drag.
 */
export function pointerDrag(start: { x: number; y: number; pointerType?: string }, o: PointerDragOptions): () => void {
  const hold = start.pointerType === 'touch' && o.touchHoldMs ? o.touchHoldMs : 0
  const threshold = hold ? Infinity : (o.threshold ?? 0) // a held touch starts by time, never by distance
  let { x, y } = start
  let started = threshold <= 0
  let raf = 0
  let done = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const loop = () => {
    o.onFrame?.(x, y)
    raf = requestAnimationFrame(loop)
  }
  const begin = () => {
    started = true
    if (hold) {
      window.addEventListener('touchmove', stopScroll, { passive: false })
      navigator.vibrate?.(10)
    }
    o.onStart?.()
    if (o.onFrame) raf = requestAnimationFrame(loop)
  }
  const end = (outcome: 'dropped' | 'clicked' | 'cancelled') => {
    if (done) return
    done = true
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', key, true)
    window.removeEventListener('touchmove', stopScroll)
    clearTimeout(timer)
    cancelAnimationFrame(raf)
    o.onFinish?.()
    o.onEnd?.(outcome)
  }
  const move = (ev: PointerEvent) => {
    x = ev.clientX
    y = ev.clientY
    if (!started) {
      if (hold) {
        if (Math.hypot(x - start.x, y - start.y) > (o.touchSlop ?? 10)) end('cancelled') // the finger is scrolling
        return
      }
      if (Math.hypot(x - start.x, y - start.y) < threshold) return
      begin()
    }
    o.onMove?.(x, y, ev)
  }
  const stopScroll = (ev: TouchEvent) => {
    if (ev.cancelable) ev.preventDefault()
  }
  const up = () => end(started ? 'dropped' : 'clicked')
  const cancel = () => end('cancelled')
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') return
    ev.stopPropagation()
    end('cancelled')
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
  if (o.cancelOnEscape) window.addEventListener('keydown', key, true)
  if (started) begin()
  else if (hold) timer = setTimeout(begin, hold)
  return cancel
}
