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

describe('Popover and scrolling', () => {
  const openWith = (button: { rect: DOMRect }, onClose: () => void) => {
    stage({ current: 200 }, button)
    return render(<Popover anchor={button.rect} onClose={onClose} label="p">x</Popover>)
  }

  it('does not move with the page (a position written on scroll would shake): it closes when its button moves', () => {
    const button = { rect: rect(100, 140, 40) }
    let closed = 0
    openWith(button, () => closed++)
    const top = screen.getByRole('dialog').style.top
    button.rect = rect(100, 140, -60) // the page scrolled
    act(() => {
      fireEvent.scroll(document)
    })
    expect(closed).toBe(1)
    expect(screen.getByRole('dialog').style.top).toBe(top) // and it was not written to on the way
  })

  it('keeps watching from where it opened, even when the parent renders again with a new onClose', () => {
    const button = { rect: rect(100, 140, 40) }
    stage({ current: 200 }, button)
    const anchor = button.rect // the same object for as long as the popover is open
    let closed = 0
    const view = render(<Popover anchor={anchor} onClose={() => closed++} label="p">x</Popover>)
    button.rect = rect(100, 140, 20) // moved 20px, then the parent re-renders (a live update) before the next scroll event
    view.rerender(<Popover anchor={anchor} onClose={() => closed++} label="p">x</Popover>)
    act(() => {
      fireEvent.scroll(document)
    })
    expect(closed).toBe(1)
  })

  it('a scroll that does not move the button leaves it open (a sub-pixel change is not a move)', () => {
    const button = { rect: rect(100, 140, 40) }
    let closed = 0
    openWith(button, () => closed++)
    button.rect = rect(100, 140, 40.5)
    act(() => {
      fireEvent.scroll(document)
    })
    expect(closed).toBe(0)
  })

  it('scrolling inside the popover is not the page moving: it stays open', () => {
    const button = { rect: rect(100, 140, 40) }
    let closed = 0
    openWith(button, () => closed++)
    button.rect = rect(100, 140, 300)
    act(() => {
      fireEvent.scroll(screen.getByRole('dialog'))
    })
    expect(closed).toBe(0)
  })

  it('a sideways move of the button (a grid scrolled horizontally) closes it too', () => {
    const button = { rect: rect(100, 140, 40) }
    let closed = 0
    openWith(button, () => closed++)
    button.rect = rect(60, 100, 40)
    act(() => {
      fireEvent.scroll(document)
    })
    expect(closed).toBe(1)
  })

  it('with no button to watch a scroll does nothing', () => {
    stage({ current: 200 })
    let closed = 0
    render(<Popover anchor={rect(100, 140, 40)} onClose={() => closed++} label="p">x</Popover>)
    act(() => {
      fireEvent.scroll(document)
    })
    expect(closed).toBe(0)
  })
})
