import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Popover } from './Popover'

afterEach(() => {
  cleanup()
  delete (HTMLElement.prototype as any).offsetWidth
  delete (HTMLElement.prototype as any).offsetHeight
  delete (document as any).elementFromPoint
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

/** a window 1000 wide, a popover `width` wide, and (optionally) a button under the anchor that can move */
function stage(width: { current: number }, button?: { rect: DOMRect }) {
  notify = []
  ;(globalThis as any).ResizeObserver = FakeObserver
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width.current })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 100 })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })
  if (button) {
    const el = document.createElement('button')
    el.setAttribute('data-gk-anchor', '')
    el.getBoundingClientRect = () => button.rect
    document.body.appendChild(el)
    ;(document as any).elementFromPoint = () => el
  }
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

describe('Popover follows its button', () => {
  it('when the page scrolls the popover moves with the button', () => {
    const button = { rect: rect(100, 140, 40) }
    stage({ current: 200 }, button)
    open(button.rect)
    expect(screen.getByRole('dialog').style.top).toBe('74px') // 40 + 30 + 4
    button.rect = rect(100, 140, -60) // scrolled up by 100
    act(() => {
      fireEvent.scroll(document)
    })
    expect(screen.getByRole('dialog').style.top).toBe('-26px') // it leaves the screen with its button, attached to it
    button.rect = rect(100, 140, 140)
    act(() => {
      fireEvent.scroll(document)
    })
    expect(screen.getByRole('dialog').style.top).toBe('174px')
  })

  it('scrolling inside the popover does not move it', () => {
    const button = { rect: rect(100, 140, 40) }
    stage({ current: 200 }, button)
    open(button.rect)
    button.rect = rect(100, 140, 300) // the button moved, but the scroll below is the popover's own
    act(() => {
      fireEvent.scroll(screen.getByRole('dialog'))
    })
    expect(screen.getByRole('dialog').style.top).toBe('74px')
  })

  it('without a button to follow it stays put', () => {
    stage({ current: 200 })
    open(rect(100, 140, 40))
    act(() => {
      fireEvent.scroll(document)
    })
    expect(screen.getByRole('dialog').style.top).toBe('74px')
  })
})
