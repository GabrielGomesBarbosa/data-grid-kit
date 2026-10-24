import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataSourceController, LruCache } from './dataSource'
import { flush, tagOf, makeServer, make, asc, desc, none, ids, type Row } from './dataSource.helpers'

afterEach(() => vi.useRealTimers())

describe('lifecycle', () => {
  it('does nothing until resume(), then catches up; destroy() stops and resume() restarts', async () => {
    const s = makeServer()
    const c = new DataSourceController<Row>({ getSource: () => s.source, getRowId: (r) => r.id, chunkSize: 10, settleMs: 0, prefetchChunks: 0 })
    c.setView(0, 9)
    await flush()
    expect(s.calls).toHaveLength(0) // constructing and configuring one (as a render would) starts nothing
    c.resume()
    await flush()
    expect(s.calls).toHaveLength(1)
    c.destroy()
    expect(s.calls[0]!.params.signal.aborted).toBe(true)
    c.resume() // StrictMode: unmount then mount again
    await flush()
    expect(s.calls).toHaveLength(2)
    s.calls[1]!.resolve()
    await flush()
    expect(c.rowAt(0)?.id).toBe(1)
  })
})

describe('requests', () => {
  it('asks for the blocks in view as one aligned request, with the query and a signal', async () => {
    const s = makeServer(1000)
    const c = make(s)
    c.setQuery(asc, { items: [], quickFilter: 'x' })
    c.setView(5, 24)
    await flush()
    expect(s.calls).toHaveLength(1)
    const p = s.calls[0]!.params
    expect([p.start, p.end]).toEqual([0, 29]) // blocks 0-2 of 10, inclusive end
    expect(p.sortModel).toEqual(asc)
    expect(p.filterModel.quickFilter).toBe('x')
    expect(p.signal).toBeInstanceOf(AbortSignal)
    s.calls[0]!.resolve()
    await flush()
    expect(ids(c, 0, 4)).toEqual([1, 2, 3, 4, 5])
    expect(c.snapshot().rowCount).toBe(1000)
    expect(c.snapshot().loading).toBe(false)
  })

  it('reports loading while the visible blocks are on their way', async () => {
    const s = makeServer()
    const c = make(s)
    c.setView(0, 9)
    expect(c.snapshot().loading).toBe(true)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    expect(c.snapshot().loading).toBe(false)
  })

  it('does not ask for blocks beyond the known row count', async () => {
    const s = makeServer(25)
    const c = make(s)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.setView(0, 500) // far past the end
    await flush()
    expect(s.calls.every((x) => x.params.start < 25)).toBe(true)
    expect(s.calls.at(-1)!.params.end).toBeLessThanOrEqual(24)
  })

  it('coalesces a burst of view changes into requests for where the view ended up', async () => {
    vi.useFakeTimers()
    const s = makeServer()
    const c = make(s, { settleMs: 50 })
    for (let pos = 0; pos < 900; pos += 30) c.setView(pos, pos + 20)
    await vi.advanceTimersByTimeAsync(60)
    expect(s.calls.length).toBeGreaterThan(0)
    expect(s.calls.every((x) => x.params.start >= 840)).toBe(true) // nothing for the places scrolled past
  })

  it('joins neighbouring blocks into one request, capped by maxRunChunks', async () => {
    const s = makeServer()
    const c = make(s, { maxRunChunks: 3 })
    c.setView(0, 69) // 7 blocks
    await flush()
    // requests go out nearest-the-view first, so compare them by position
    const runs = s.calls.map((x) => [x.params.start, x.params.end] as const).sort((a, b) => a[0] - b[0])
    expect(runs.every(([a, b]) => b - a + 1 <= 30)).toBe(true) // never more than 3 blocks of 10
    expect(runs.length).toBeLessThanOrEqual(3)
    expect(runs[0]![0]).toBe(0)
    expect(runs.at(-1)![1]).toBe(69)
    for (let i = 1; i < runs.length; i++) expect(runs[i]![0]).toBe(runs[i - 1]![1] + 1) // no gap, no overlap
  })
})

describe('cache', () => {
  it('serves what it has without a request, and fetches only what is missing', async () => {
    const s = makeServer()
    const c = make(s)
    c.setView(0, 19)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    expect(s.calls).toHaveLength(1)
    c.setView(10, 39) // blocks 1 (have), 2-3 (missing)
    await flush()
    expect(s.calls).toHaveLength(2)
    expect([s.calls[1]!.params.start, s.calls[1]!.params.end]).toEqual([20, 39])
  })

  it('answers a query it has seen before from the cache, after the grid moved on', async () => {
    const s = makeServer()
    const cache = new LruCache<Row>()
    const c = make(s, { cache })
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.setQuery(desc, none)
    await flush()
    s.open()[0]!.resolve()
    await flush()
    const before = s.calls.length
    c.setQuery(asc, none) // back to the first query
    await flush()
    expect(s.calls.length).toBe(before) // no request: the block came from the cache
    expect(ids(c, 0, 2)).toEqual([1, 2, 3])
  })

  it('caches the answer of a request that was aborted before it came back, but never shows it', async () => {
    const s = makeServer(1000, true, true)
    const c = make(s)
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    const old = s.calls[0]!
    c.setQuery(desc, none) // the first request is now useless
    await flush()
    expect(old.params.signal.aborted).toBe(true)
    // a server that ignores the abort and answers anyway
    old.resolve()
    await flush()
    expect(c.rowAt(0)).toBeUndefined() // not shown: it belongs to the old query
    // ...but it was cached: asking for that query again needs no request
    const before = s.calls.length
    c.setQuery(asc, none)
    await flush()
    expect(s.calls.length).toBe(before)
    expect(c.rowAt(0)?.q).toBe(tagOf(asc, none))
  })

  it('works with no cache at all', async () => {
    const s = makeServer()
    const c = make(s, { cache: null })
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.setView(100, 109)
    await flush()
    s.open()[0]!.resolve()
    await flush()
    c.setView(0, 9)
    await flush()
    expect(s.calls).toHaveLength(2) // block 0 is still held in memory, so no request even without a cache
    expect(c.rowAt(0)?.id).toBe(1)
    c.refresh() // but a refresh has nothing to fall back on
    await flush()
    expect(s.calls).toHaveLength(3)
  })

  it('LruCache: bounded size, least recently used out first, entries expire', () => {
    let t = 0
    const cache = new LruCache<Row>({ maxEntries: 2, ttl: 100, now: () => t })
    const key = (n: number) => ({ sortModel: [], filterModel: none, start: n, end: n })
    const val = (n: number) => ({ rows: [{ id: n, q: '', v: 0 }] })
    cache.set(key(1), val(1))
    cache.set(key(2), val(2))
    cache.get(key(1)) // 1 is now more recent than 2
    cache.set(key(3), val(3)) // evicts 2
    expect(cache.get(key(2))).toBeUndefined()
    expect(cache.get(key(1))).toBeDefined()
    expect(cache.size).toBe(2)
    t = 101
    expect(cache.get(key(1))).toBeUndefined() // expired
    expect(cache.size).toBe(1)
  })
})

describe('changing the query', () => {
  it('aborts what is in flight and starts over', async () => {
    const s = makeServer()
    const c = make(s)
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    const first = s.calls[0]!
    c.setQuery(desc, none)
    await flush()
    expect(first.params.signal.aborted).toBe(true)
    expect(c.stats.inFlight).toBe(1)
    s.open()[0]!.resolve()
    await flush()
    expect(ids(c, 0, 2)).toEqual([1000, 999, 998])
  })

  it('a late answer of the old query never replaces rows of the new one', async () => {
    const s = makeServer(1000, true, true)
    const c = make(s)
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    const old = s.calls[0]!
    c.setQuery(desc, none)
    await flush()
    const fresh = s.calls.at(-1)! // a rude server leaves the old call open too
    expect(fresh).not.toBe(old)
    fresh.resolve()
    await flush()
    old.resolve() // arrives after the new one
    await flush()
    expect(c.rowAt(0)?.q).toBe(tagOf(desc, none))
  })

  it('keepPreviousData shows the old rows until the new ones arrive', async () => {
    const s = makeServer()
    const c = make(s, { keepPreviousData: true })
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.setQuery(desc, none)
    expect(c.rowAt(0)?.id).toBe(1) // still the old ones
    await flush()
    s.open()[0]!.resolve()
    await flush()
    expect(c.rowAt(0)?.id).toBe(1000) // replaced
  })

  it('without keepPreviousData the rows are gone immediately', async () => {
    const s = makeServer()
    const c = make(s)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.setQuery(desc, none)
    expect(c.rowAt(0)).toBeUndefined()
  })

  it('the same query again is a no-op', async () => {
    const s = makeServer()
    const c = make(s)
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    const n = s.calls.length
    c.setQuery([...asc], { items: [] })
    await flush()
    expect(s.calls.length).toBe(n)
  })
})

describe('row count and the end of the data', () => {
  it('a short answer with no row count is the end of the data', async () => {
    const s = makeServer(25, false)
    const c = make(s)
    c.setView(0, 29)
    await flush()
    expect(c.snapshot().rowCount).toBe(-1)
    s.calls[0]!.resolve()
    await flush()
    expect(c.snapshot().rowCount).toBe(25)
    expect(c.snapshot().hasNextPage).toBe(false)
    expect(c.rowAt(24)?.id).toBe(25)
    expect(c.rowAt(25)).toBeUndefined()
  })

  it('a full answer with no count keeps going; pageInfo.hasNextPage ends it', async () => {
    const s = makeServer(1000, false)
    const c = make(s)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    expect(c.snapshot().rowCount).toBe(-1)
    expect(c.snapshot().hasNextPage).toBe(true)
    c.setView(10, 19)
    await flush()
    s.open()[0]!.resolve({ pageInfo: { hasNextPage: false } })
    await flush()
    expect(c.snapshot().hasNextPage).toBe(false)
  })

  it('a row count of -1 means unknown, an empty data set is a count of 0', async () => {
    const s = makeServer(0)
    const c = make(s)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    expect(c.snapshot().rowCount).toBe(0)
    const n = s.calls.length
    c.setView(0, 99)
    await flush()
    expect(s.calls.length).toBe(n) // nothing to ask for
  })

  it('blocks that arrive out of order do not corrupt hasNextPage', async () => {
    const s = makeServer(100)
    const c = make(s, { maxRunChunks: 1 })
    c.setView(0, 99)
    await flush()
    const open = s.open()
    expect(open.length).toBe(4) // maxConcurrent
    // answer the last ones first, then the first ones
    for (const call of [...open].reverse()) call.resolve()
    await flush()
    for (let guard = 0; guard < 10 && s.open().length; guard++) {
      s.open().forEach((x) => x.resolve())
      await flush()
    }
    expect(c.snapshot().rowCount).toBe(100)
    expect(ids(c, 95, 99)).toEqual([96, 97, 98, 99, 100])
  })
})
