import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pointerDrag } from './pointerDrag'

const fire = (type: string, init: MouseEventInit = {}) => window.dispatchEvent(new MouseEvent(type, init))
const move = (x: number, y: number) => fire('pointermove', { clientX: x, clientY: y })
const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true }))

// one animation frame per tick, driven by hand
let frames: Array<() => void> = []
beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = []
  })
})
afterEach(() => vi.unstubAllGlobals())
const tick = () => {
  const run = frames
  frames = []
  run.forEach((f) => f())
}

describe('pointerDrag', () => {
  it('without a threshold the drag is on at once: moves are reported and a release is a drop', () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    pointerDrag({ x: 0, y: 0 }, { onMove, onEnd })
    move(5, 6)
    expect(onMove).toHaveBeenCalledWith(5, 6, expect.anything())
    fire('pointerup')
    expect(onEnd).toHaveBeenCalledWith('dropped')
  })

  it('with a threshold, small movements do not start it and a release is a click', () => {
    const onStart = vi.fn()
    const onMove = vi.fn()
    const onEnd = vi.fn()
    pointerDrag({ x: 0, y: 0 }, { threshold: 5, onStart, onMove, onEnd })
    move(2, 2)
    expect(onStart).not.toHaveBeenCalled()
    expect(onMove).not.toHaveBeenCalled()
    fire('pointerup')
    expect(onEnd).toHaveBeenCalledWith('clicked')
  })

  it('crossing the threshold starts it once; the release is a drop', () => {
    const onStart = vi.fn()
    const onMove = vi.fn()
    const onEnd = vi.fn()
    pointerDrag({ x: 0, y: 0 }, { threshold: 5, onStart, onMove, onEnd })
    move(6, 0)
    move(7, 0)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onMove).toHaveBeenCalledTimes(2)
    fire('pointerup')
    expect(onEnd).toHaveBeenCalledWith('dropped')
  })

  it('Escape cancels (only when asked to), and is not passed on', () => {
    const onEnd = vi.fn()
    pointerDrag({ x: 0, y: 0 }, { cancelOnEscape: true, onEnd })
    const outer = vi.fn()
    window.addEventListener('keydown', outer)
    key('Escape')
    window.removeEventListener('keydown', outer)
    expect(onEnd).toHaveBeenCalledWith('cancelled')
    expect(outer).not.toHaveBeenCalled() // stopped in the capture phase: the panel under it keeps its Escape
    const off = vi.fn()
    pointerDrag({ x: 0, y: 0 }, { onEnd: off })
    key('Escape')
    expect(off).not.toHaveBeenCalled()
    fire('pointerup')
  })

  it('pointercancel and the returned stop() cancel; nothing is reported twice', () => {
    const a = vi.fn()
    pointerDrag({ x: 0, y: 0 }, { onEnd: a })
    fire('pointercancel')
    fire('pointerup')
    expect(a.mock.calls).toEqual([['cancelled']])
    const b = vi.fn()
    const stop = pointerDrag({ x: 0, y: 0 }, { onEnd: b })
    stop()
    stop()
    move(9, 9)
    expect(b.mock.calls).toEqual([['cancelled']])
  })

  it('onFinish runs before onEnd, in every case, and the listeners are gone afterwards', () => {
    const order: string[] = []
    pointerDrag({ x: 0, y: 0 }, { onFinish: () => order.push('finish'), onEnd: (o) => order.push(o) })
    fire('pointerup')
    expect(order).toEqual(['finish', 'dropped'])
    const onMove = vi.fn()
    pointerDrag({ x: 0, y: 0 }, { onMove }).call(null)
    move(1, 1)
    expect(onMove).not.toHaveBeenCalled()
  })

  it('onFrame runs every frame with the latest pointer position, only while the drag is on', () => {
    const onFrame = vi.fn()
    pointerDrag({ x: 1, y: 2 }, { threshold: 5, onFrame })
    tick()
    expect(onFrame).not.toHaveBeenCalled() // not started yet
    move(10, 20)
    tick()
    expect(onFrame).toHaveBeenLastCalledWith(10, 20)
    tick()
    expect(onFrame).toHaveBeenCalledTimes(2)
    fire('pointerup')
    tick()
    expect(onFrame).toHaveBeenCalledTimes(2) // the loop stopped with the drag
  })
})
