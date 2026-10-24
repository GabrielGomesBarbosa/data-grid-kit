import { describe, expect, it } from 'vitest'
import { DataSourceController, LruCache } from './dataSource'
import { flush, makeServer, ids, type Row } from './dataSource.helpers'

const level = (server: ReturnType<typeof makeServer>, cache: LruCache<Row>, groupKeys: string[]) => {
  const c = new DataSourceController<Row>({ getSource: () => server.source, getRowId: (r) => r.id, chunkSize: 10, settleMs: 0, prefetchChunks: 0, cache, groupKeys })
  c.resume()
  c.setView(0, 9)
  return c
}

describe('levels of a tree share one cache without sharing entries', () => {
  it('asks for the level it is on, with its path', async () => {
    const s = makeServer(50)
    level(s, new LruCache<Row>(), ['a', 'b'])
    await flush()
    expect(s.calls[0]!.params.groupKeys).toEqual(['a', 'b'])
  })

  it('a different path is a different set of rows: it is asked for, not served from the other level', async () => {
    const s = makeServer(50)
    const cache = new LruCache<Row>()
    const a = level(s, cache, ['a'])
    await flush()
    s.calls[0]!.resolve()
    await flush()
    expect(ids(a, 0, 1)).toEqual([1, 2])
    level(s, cache, ['b'])
    await flush()
    expect(s.calls).toHaveLength(2)
    expect(s.calls[1]!.params.groupKeys).toEqual(['b'])
  })

  it('the same path is served from the cache, as when a row is opened again', async () => {
    const s = makeServer(50)
    const cache = new LruCache<Row>()
    const first = level(s, cache, ['a'])
    await flush()
    s.calls[0]!.resolve()
    await flush()
    first.destroy()
    const again = level(s, cache, ['a'])
    await flush()
    expect(s.calls).toHaveLength(1)
    expect(ids(again, 0, 1)).toEqual([1, 2])
  })

  it('without groupKeys nothing changes: no path is sent', async () => {
    const s = makeServer(50)
    const c = new DataSourceController<Row>({ getSource: () => s.source, getRowId: (r) => r.id, chunkSize: 10, settleMs: 0, prefetchChunks: 0 })
    c.resume()
    c.setView(0, 9)
    await flush()
    expect('groupKeys' in s.calls[0]!.params).toBe(false)
  })
})
