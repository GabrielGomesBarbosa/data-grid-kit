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
export function pointerDrag(start: { x: number; y: number }, o: PointerDragOptions): () => void {
  const threshold = o.threshold ?? 0
  let { x, y } = start
  let started = threshold <= 0
  let raf = 0
  let done = false

  const loop = () => {
    o.onFrame?.(x, y)
    raf = requestAnimationFrame(loop)
  }
  const begin = () => {
    started = true
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
    cancelAnimationFrame(raf)
    o.onFinish?.()
    o.onEnd?.(outcome)
  }
  const move = (ev: PointerEvent) => {
    x = ev.clientX
    y = ev.clientY
    if (!started) {
      if (Math.hypot(x - start.x, y - start.y) < threshold) return
      begin()
    }
    o.onMove?.(x, y, ev)
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
  return cancel
}
