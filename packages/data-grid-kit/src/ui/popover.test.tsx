import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Popover } from './Popover'

afterEach(() => {
  cleanup()
  delete (HTMLElement.prototype as any).offsetWidth
  delete (HTMLElement.prototype as any).offsetHeight
})

const rect = (left: number, right: number, top = 40) => ({ left, right, top, bottom: top + 30, width: right - left, height: 30, x: left, y: top, toJSON: () => ({}) }) as DOMRect

/** the one ResizeObserver callback, so a test can say "the popover just changed size" */
let notify: (() => void)[] = []
class FakeObserver {
  constructor(cb: () => void) {
    notify.push(cb)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** a window 1000 wide, a popover `width` wide */
function stage(width: { current: number }) {
  notify = []
  ;(globalThis as any).ResizeObserver = FakeObserver
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width.current })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 100 })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })
}
const left = () => screen.getByRole('dialog').style.left
const open = (anchor: DOMRect, align?: 'start' | 'end') => render(<Popover anchor={anchor} onClose={() => {}} label="p" align={align}>x</Popover>)

describe('Popover position', () => {
  it('sits under its button, left edges together, when it fits', () => {
    stage({ current: 200 })
    open(rect(100, 140))
    expect(left()).toBe('100px')
  })

  it('does not fit on the right: its right edge lines up with the button instead of the window edge', () => {
    stage({ current: 300 })
    open(rect(900, 940))
    expect(left()).toBe('640px') // 940 - 300, not 692 (the window edge)
  })

  it('fits on neither side: it is pushed inside the window', () => {
    stage({ current: 980 })
    open(rect(500, 540))
    expect(left()).toBe('12px') // 1000 - 980 - 8
  })

  it('an end-aligned popover that would leave the window on the left flips to the button\'s left edge', () => {
    stage({ current: 300 })
    open(rect(20, 60), 'end')
    expect(left()).toBe('20px')
  })

  it('moves again when its content makes it wider (a filter row is added)', () => {
    const width = { current: 240 }
    stage(width)
    open(rect(780, 820))
    expect(left()).toBe('580px') // 820 - 240
    width.current = 620 // the panel grew
    act(() => notify.forEach((cb) => cb()))
    expect(left()).toBe('200px') // 820 - 620
  })

  it('moves when the window is resized', () => {
    stage({ current: 300 })
    open(rect(500, 540))
    expect(left()).toBe('500px')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 700 })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(left()).toBe('240px') // 540 - 300
  })
})

describe('Popover and scrolling', () => {
  it('is positioned against the page, so the browser moves it with the scroll: nothing is written and it never closes', () => {
    stage({ current: 200 })
    let closed = 0
    render(<Popover anchor={rect(100, 140, 40)} onClose={() => closed++} label="p">x</Popover>)
    const style = screen.getByRole('dialog').getAttribute('style')
    act(() => {
      window.scrollTo?.(0, 300)
      fireEvent.scroll(document)
      fireEvent.scroll(window)
    })
    expect(closed).toBe(0)
    expect(screen.getByRole('dialog').getAttribute('style')).toBe(style)
  })

  it('opened on a scrolled page it is written in page coordinates (window position + scroll offset)', () => {
    stage({ current: 200 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 })
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 30 })
    try {
      render(<Popover anchor={rect(100, 140, 40)} onClose={() => {}} label="p">x</Popover>)
      const el = screen.getByRole('dialog')
      expect(el.style.left).toBe('130px') // 100 + 30
      expect(el.style.top).toBe('574px') // 40 + 30 (button) + 4 gap + 500
    } finally {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
      Object.defineProperty(window, 'scrollX', { configurable: true, value: 0 })
    }
  })

  it('a re-placement after the page scrolled (its size changed) keeps the page position it opened at', () => {
    stage({ current: 200 })
    render(<Popover anchor={rect(100, 140, 40)} onClose={() => {}} label="p">x</Popover>)
    const before = screen.getByRole('dialog').style.top
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 200 })
    try {
      act(() => notify.forEach((cb) => cb()))
      expect(screen.getByRole('dialog').style.top).toBe(before)
    } finally {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    }
  })

  it('scrolling inside the popover leaves it where it is', () => {
    stage({ current: 200 })
    let closed = 0
    render(<Popover anchor={rect(100, 140, 40)} onClose={() => closed++} label="p">x</Popover>)
    act(() => {
      fireEvent.scroll(screen.getByRole('dialog'))
    })
    expect(closed).toBe(0)
  })
})

describe('Popover vertical placement', () => {
  const tall = (h: number) => Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => h })
  const win = (h: number) => Object.defineProperty(window, 'innerHeight', { configurable: true, value: h })

  it('goes above the button when it only fits there', () => {
    stage({ current: 200 })
    win(768)
    tall(300)
    open(rect(100, 140, 500)) // 530 + 4 + 300 > 760, above has 488
    expect(screen.getByRole('dialog').style.top).toBe('196px') // 500 - 300 - 4
  })

  it('fits on neither side: stays under the button with a height that scrolls, never on top of it', () => {
    stage({ current: 200 })
    win(768)
    tall(511)
    open(rect(100, 140, 310)) // below has 768 - 8 - 344 = 416, above 298
    const el = screen.getByRole('dialog')
    expect(el.style.top).toBe('344px')
    expect(el.style.maxHeight).toBe('416px')
  })
})
