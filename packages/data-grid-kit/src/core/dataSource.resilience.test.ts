import { describe, expect, it, vi } from 'vitest'
import { DataSourceController, DataSourceError, LruCache } from './dataSource'
import type { FilterModel, SortItem } from './types'
import { flush, tagOf, makeServer, make, asc, desc, none, type Row } from './dataSource.helpers'

describe('concurrency and scrolling away', () => {
  it('never has more than maxConcurrent requests open and drains the queue as they finish', async () => {
    const s = makeServer()
    const c = make(s, { maxConcurrent: 2, maxRunChunks: 1 })
    c.setView(0, 59)
    await flush()
    expect(s.open()).toHaveLength(2)
    s.open()[0]!.resolve()
    await flush()
    expect(s.open()).toHaveLength(2)
    expect(c.stats.inFlight).toBeLessThanOrEqual(2)
  })

  it('does not start queued requests for places the view has left', async () => {
    const s = makeServer()
    const c = make(s, { maxConcurrent: 1, maxRunChunks: 1 })
    c.setView(0, 39) // blocks 0-3: one request open, three queued
    await flush()
    expect(s.open()).toHaveLength(1)
    c.setView(500, 509) // scrolled far away
    await flush()
    s.open()[0]!.resolve() // the first one finishes
    await flush()
    const starts = s.calls.map((x) => x.params.start)
    // block 2 was the one in flight when the view moved; blocks 0, 1 and 3 were still queued and must be gone
    expect(starts.filter((x) => x < 40)).toEqual([20])
    expect(starts).toContain(500)
  })

  it('asks for the blocks nearest the view first', async () => {
    const s = makeServer()
    const c = make(s, { maxConcurrent: 1, maxRunChunks: 1, prefetchChunks: 2 })
    c.setView(50, 59) // block 5, with 3-4 and 6-7 around it
    await flush()
    expect(s.calls[0]!.params.start).toBe(50)
  })

  it('drops the farthest blocks past maxLoadedChunks, and gets them back from the cache', async () => {
    const s = makeServer()
    const c = make(s, { maxLoadedChunks: 3, maxRunChunks: 1 })
    for (let b = 0; b < 8; b++) {
      c.setView(b * 10, b * 10 + 9)
      await flush()
      s.open().forEach((x) => x.resolve())
      await flush()
    }
    expect(c.stats.loadedChunks).toBeLessThanOrEqual(4)
    const before = s.calls.length
    c.setView(0, 9) // long gone from memory, still in the cache
    await flush()
    expect(s.calls.length).toBe(before)
    expect(c.rowAt(0)?.id).toBe(1)
  })
})

describe('errors', () => {
  it('reports a failed request with its params, and shows the rest', async () => {
    const s = makeServer()
    const errors: DataSourceError[] = []
    const c = make(s, { onError: (e) => errors.push(e), maxRunChunks: 1 })
    c.setView(0, 19)
    await flush()
    const first = s.calls.find((x) => x.params.start === 0)!
    const second = s.calls.find((x) => x.params.start === 10)!
    first.reject(new Error('503'))
    second.resolve()
    await flush()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(DataSourceError)
    expect(errors[0]!.message).toBe('503')
    expect(errors[0]!.params).toMatchObject({ start: 0, end: 9 })
    expect(c.snapshot().error).toBe(errors[0])
    expect(c.rowAt(0)).toBeUndefined()
    expect(c.rowAt(10)?.id).toBe(11)
  })

  it('aborting is not an error', async () => {
    const s = makeServer()
    const onError = vi.fn()
    const c = make(s, { onError })
    c.setQuery(asc, none)
    c.setView(0, 9)
    await flush()
    c.setQuery(desc, none)
    await flush()
    expect(onError).not.toHaveBeenCalled()
    expect(c.snapshot().error).toBeNull()
  })

  it('a getRows that throws is a failed request, not a crash', async () => {
    const onError = vi.fn()
    const c = new DataSourceController<Row>({
      getSource: () => ({
        getRows: () => {
          throw new Error('sync boom')
        },
      }),
      getRowId: (r) => r.id,
      chunkSize: 10,
      settleMs: 0,
      prefetchChunks: 0,
      onError,
    })
    c.resume()
    c.setView(0, 9)
    await flush()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('retries a failed block only after retryAfterMs, when it is in view', async () => {
    vi.useFakeTimers()
    const s = makeServer()
    const c = make(s, { retryAfterMs: 1000 })
    c.setView(0, 9)
    await vi.advanceTimersByTimeAsync(0)
    s.calls[0]!.reject()
    await vi.advanceTimersByTimeAsync(0)
    c.setView(1, 9) // nudge inside the same block: must not retry yet
    await vi.advanceTimersByTimeAsync(10)
    expect(s.calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1100)
    expect(s.calls).toHaveLength(2) // retried on its own
    s.open()[0]!.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(c.rowAt(0)?.id).toBe(1)
    expect(c.snapshot().error).toBeNull()
  })

  it('refresh() gives a failed block another chance right away', async () => {
    const s = makeServer()
    const c = make(s, { retryAfterMs: 60_000 })
    c.setView(0, 9)
    await flush()
    s.calls[0]!.reject()
    await flush()
    c.refresh()
    await flush()
    expect(s.calls).toHaveLength(2)
  })
})

describe('editing and refreshing', () => {
  it('replaceRows changes the shown row and the cached copy', async () => {
    const s = makeServer()
    const cache = new LruCache<Row>()
    const c = make(s, { cache })
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    expect(c.replaceRows([{ id: 3, q: 'edited', v: 9 }])).toBe(1)
    expect(c.rowAt(2)).toMatchObject({ id: 3, v: 9 })
    expect(c.replaceRows([{ id: 99999, q: '', v: 0 }])).toBe(0) // unknown id: nothing happens
    const other = make(s, { cache }) // a second grid on the same cache
    other.setView(0, 9)
    await flush()
    expect(s.calls).toHaveLength(1) // served from the cache
    expect(other.rowAt(2)).toMatchObject({ v: 9 })
  })

  it('refresh keeps the rows on screen until the new ones arrive, and clears the cache', async () => {
    const s = makeServer()
    const c = make(s)
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    c.refresh()
    expect(c.rowAt(0)?.id).toBe(1) // still shown
    await flush()
    expect(s.calls).toHaveLength(2) // the cache was cleared: a real request
    s.open()[0]!.resolve({ rows: [{ id: 77, q: 'new', v: 0 }, ...s.build(s.calls[1]!.params).rows.slice(1)] })
    await flush()
    expect(c.rowAt(0)?.id).toBe(77)
  })

  it('a background revalidation keeps unchanged row objects and stays silent when nothing changed', async () => {
    const s = makeServer()
    const c = make(s, { revalidateMs: 1000 })
    const seen: number[] = []
    c.subscribe(() => seen.push(c.getVersion()))
    c.setView(0, 9)
    await flush()
    s.calls[0]!.resolve()
    await flush()
    const row = c.rowAt(3)
    const notified = seen.length
    c.revalidate()
    await flush()
    s.open()[0]!.resolve() // identical data
    await flush()
    expect(c.rowAt(3)).toBe(row) // same object
    expect(seen.length).toBe(notified) // nobody was told
    c.revalidate()
    await flush()
    const changed = s.build(s.open()[0]!.params).rows
    changed[5] = { ...changed[5]!, v: 42 }
    s.open()[0]!.resolve({ rows: changed })
    await flush()
    expect(c.rowAt(5)?.v).toBe(42)
    expect(c.rowAt(3)).toBe(row) // untouched rows keep their identity
    expect(seen.length).toBeGreaterThan(notified)
    c.destroy()
  })

  it('polling re-reads on a timer and stops on destroy', async () => {
    vi.useFakeTimers()
    const s = makeServer()
    const c = make(s, { revalidateMs: 500 })
    c.setView(0, 9)
    await vi.advanceTimersByTimeAsync(0)
    s.calls[0]!.resolve()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(500)
    expect(s.calls).toHaveLength(2)
    c.destroy()
    await vi.advanceTimersByTimeAsync(2000)
    expect(s.calls).toHaveLength(2)
  })
})

/* ----------------------------------------------------------------- the race */

describe('races (randomised)', () => {
  function rng(seed: number) {
    let s = seed >>> 0
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  }

  it('never shows a row of another query, whatever order answers arrive in', async () => {
    for (let seed = 1; seed <= 120; seed++) {
      const rand = rng(seed * 2654435761)
      const int = (n: number) => Math.floor(rand() * n)
      const rude = rand() < 0.5
      const s = makeServer((f) => (f.quickFilter ? 400 : 1000), rand() < 0.5, rude)
      const errors: unknown[] = []
      const c = make(s, {
        maxConcurrent: 1 + int(4),
        maxRunChunks: 1 + int(3),
        prefetchChunks: int(2),
        maxLoadedChunks: 4 + int(30),
        keepPreviousData: false,
        onError: (e) => errors.push(e),
      })
      const queries: [SortItem[], FilterModel][] = [
        [asc, none],
        [desc, none],
        [asc, { items: [], quickFilter: 'a' }],
        [desc, { items: [], quickFilter: 'b' }],
      ]
      let [sort, filter] = queries[0]!
      c.setQuery(sort, filter)

      for (let step = 0; step < 60; step++) {
        const what = int(10)
        if (what <= 3) {
          const start = int(950)
          c.setView(start, start + int(40))
        } else if (what === 4) {
          ;[sort, filter] = queries[int(queries.length)]!
          c.setQuery(sort, filter)
        } else if (what === 5) c.refresh()
        else if (what <= 7) {
          // answer a random open request, maybe with an error
          const open = s.open()
          if (open.length) {
            const call = open[int(open.length)]!
            if (rand() < 0.15) call.reject(new Error('flaky'))
            else call.resolve()
          }
        } else if (what === 8) c.replaceRows([{ id: 1 + int(1000), q: tagOf(sort, filter), v: 1 }])
        else {
          // answer everything that is open, newest first (worst case for ordering bugs)
          for (const call of [...s.open()].reverse()) call.resolve()
        }
        await flush()

        // 1. nothing on screen belongs to another query
        const want = tagOf(sort, filter)
        for (const { row } of c.loadedRows()) {
          if (row.q !== want && row.q !== 'edited') expect(row.q, `seed ${seed} step ${step}`).toBe(want)
        }
        // 2. limits hold
        expect(c.stats.inFlight).toBeLessThanOrEqual(4)
        // 3. the id index agrees with the positions
        for (const { pos, row } of c.loadedRows()) expect(c.indexOfId(row.id), `seed ${seed} step ${step} id ${row.id}`).toBe(pos)
        // 4. a polite server has nothing left open for an aborted request
        if (!rude) for (const call of s.open()) expect(call.params.signal.aborted).toBe(false)
      }
      c.destroy()
    }
  })

  it('eventually shows the whole view once every request has been answered', async () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rand = rng(seed * 40503)
      const int = (n: number) => Math.floor(rand() * n)
      const s = makeServer(300, rand() < 0.5)
      const c = make(s, { maxConcurrent: 1 + int(3), maxRunChunks: 1 + int(3), prefetchChunks: int(2) })
      let start = 0
      for (let step = 0; step < 25; step++) {
        start = int(280)
        c.setView(start, start + 15)
        if (int(3) === 0) c.setQuery(int(2) ? asc : desc, none)
        for (let i = 0; i < int(3); i++) {
          const open = s.open()
          if (open.length) open[int(open.length)]!.resolve()
          await flush()
        }
      }
      // drain: first let the pump that the last view change scheduled run, then answer everything
      await flush()
      for (let guard = 0; guard < 200 && (s.open().length || c.stats.queued); guard++) {
        s.open().forEach((x) => x.resolve())
        await flush()
      }
      const view = [start, Math.min(start + 15, 299)]
      const missing = []
      for (let p = view[0]!; p <= view[1]!; p++) if (c.rowAt(p) === undefined) missing.push(p)
      expect(missing, `seed ${seed} view ${view} stats ${JSON.stringify(c.stats)} snap ${JSON.stringify({ ...c.snapshot(), error: null })}`).toEqual([])
      expect(c.snapshot().loading).toBe(false)
      c.destroy()
    }
  })
})
