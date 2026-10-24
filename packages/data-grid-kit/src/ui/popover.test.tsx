import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { Popover } from './Popover'

afterEach(cleanup)

const anchor = (left: number, right: number) => ({ left, right, top: 40, bottom: 70, width: right - left, height: 30, x: left, y: 40, toJSON: () => ({}) }) as DOMRect

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

function stage(width: { current: number }) {
  notify = []
  ;(globalThis as any).ResizeObserver = FakeObserver
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width.current })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 100 })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })
}
afterEach(() => {
  delete (HTMLElement.prototype as any).offsetWidth
  delete (HTMLElement.prototype as any).offsetHeight
})

describe('Popover position', () => {
  it('sits under its anchor when it fits', () => {
    stage({ current: 200 })
    render(<Popover anchor={anchor(100, 140)} onClose={() => {}} label="p">x</Popover>)
    expect(screen.getByRole('dialog').style.left).toBe('100px')
  })

  it('is pulled back inside the window when it would run off the right edge', () => {
    stage({ current: 300 })
    render(<Popover anchor={anchor(900, 940)} onClose={() => {}} label="p">x</Popover>)
    expect(screen.getByRole('dialog').style.left).toBe('692px') // 1000 - 300 - 8
  })

  it('moves again when its content makes it wider (a filter row is added)', () => {
    const width = { current: 240 }
    stage(width)
    render(<Popover anchor={anchor(780, 820)} onClose={() => {}} label="p">x</Popover>)
    expect(screen.getByRole('dialog').style.left).toBe('752px') // 1000 - 240 - 8
    width.current = 620 // the panel grew
    act(() => notify.forEach((cb) => cb()))
    expect(screen.getByRole('dialog').style.left).toBe('372px') // 1000 - 620 - 8: still inside
  })

  it('moves when the window is resized', () => {
    stage({ current: 300 })
    render(<Popover anchor={anchor(500, 540)} onClose={() => {}} label="p">x</Popover>)
    expect(screen.getByRole('dialog').style.left).toBe('500px')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 700 })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByRole('dialog').style.left).toBe('392px') // 700 - 300 - 8
  })
})
