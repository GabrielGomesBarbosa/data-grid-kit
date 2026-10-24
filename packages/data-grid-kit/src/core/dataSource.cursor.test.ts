import { afterEach, describe, expect, it, vi } from 'vitest'
import { flush, makeServer, make, asc, ids } from './dataSource.helpers'

afterEach(() => vi.useRealTimers())

// A cursor API answers each request with `nextCursor`: where to continue after the last row it sent.
const cursorAfter = (end: number) => `after:${end}`

describe('cursor pagination', () => {
  it('sends no cursor for the first rows, then the cursor of the block before', async () => {
    const s = makeServer(1000, false)
    const c = make(s, { prefetchChunks: 0, maxRunChunks: 1 })
    c.setView(0, 9)
    await flush()
    expect(s.calls[0]!.params.cursor).toBeUndefined()
    s.calls[0]!.resolve({ pageInfo: { nextCursor: cursorAfter(9) } })
    await flush()
    c.setView(10, 19)
    await flush()
    expect(s.calls).toHaveLength(2)
    expect(s.calls[1]!.params.start).toBe(10)
    expect(s.calls[1]!.params.cursor).toBe('after:9')
  })

  it('jumping ahead walks the chain, one block at a time, each with the previous cursor', async () => {
    const s = makeServer(1000, false)
    const c = make(s, { prefetchChunks: 0, maxRunChunks: 1 })
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve({ pageInfo: { nextCursor: cursorAfter(9) } })
    await flush()

    c.setView(40, 49) // block 4: its cursor is not known yet
    await flush()
    const seen: Array<[number, unknown]> = []
    for (let i = 1; i <= 4; i++) {
      const call = s.calls[i]!
      seen.push([call.params.start, call.params.cursor])
      call.resolve({ pageInfo: { nextCursor: cursorAfter(call.params.end) } })
      await flush()
    }
    expect(seen).toEqual([
      [10, 'after:9'],
      [20, 'after:19'],
      [30, 'after:29'],
      [40, 'after:39'],
    ])
    expect(ids(c, 40, 42)).toEqual([41, 42, 43])
    expect(s.calls).toHaveLength(5) // nothing asked twice
  })

  it('nextCursor: null ends the data even when the last page is full', async () => {
    const s = makeServer(10, false)
    const c = make(s, { prefetchChunks: 0, maxRunChunks: 1 })
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve({ pageInfo: { nextCursor: null } })
    await flush()
    const snap = c.snapshot()
    expect(snap.rowCount).toBe(10)
    expect(snap.hasNextPage).toBe(false)
    c.setView(10, 19)
    await flush()
    expect(s.calls).toHaveLength(1)
  })

  it('a new sort starts over: the old cursors belong to another result set', async () => {
    const s = makeServer(1000, false)
    const c = make(s, { prefetchChunks: 0, maxRunChunks: 1 })
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve({ pageInfo: { nextCursor: cursorAfter(9) } })
    await flush()
    c.setQuery(asc, { items: [] })
    await flush()
    const last = s.calls[s.calls.length - 1]!
    expect(last.params.start).toBe(0)
    expect(last.params.cursor).toBeUndefined()
    last.resolve({ pageInfo: { nextCursor: 'asc:9' } })
    await flush()
    c.setView(10, 19)
    await flush()
    expect(s.calls[s.calls.length - 1]!.params.cursor).toBe('asc:9')
  })

  it('without cursors in the responses nothing changes: no cursor is sent', async () => {
    const s = makeServer(1000)
    const c = make(s, { prefetchChunks: 0, maxRunChunks: 1 })
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.setView(50, 59)
    await flush()
    expect(s.calls[1]!.params.start).toBe(50)
    expect('cursor' in s.calls[1]!.params).toBe(false)
  })
})
