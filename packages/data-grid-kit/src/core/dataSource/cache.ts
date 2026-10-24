import type { FilterModel, SortItem } from '../types'
import { type GetRowsResponse } from './contract'

export interface DataSourceCacheKey {
  sortModel: SortItem[]
  filterModel: FilterModel
  start: number
  end: number
  /** tree and grouped data: which level (`groupKeys`), grouping and aggregation the rows are for */
  scope?: string
}

/** Anything with these three methods works as a cache. Pass `null` as `dataSourceCache` for no caching. */
export interface DataSourceCache<R = any> {
  get(key: DataSourceCacheKey): GetRowsResponse<R> | undefined
  set(key: DataSourceCacheKey, value: GetRowsResponse<R>): void
  clear(): void
}

export const cacheKeyOf = (k: DataSourceCacheKey) => JSON.stringify([k.filterModel, k.sortModel, k.start, k.end, k.scope ?? null])

export interface LruCacheOptions {
  /** how long an entry is served, in ms (default 5 minutes) */
  ttl?: number
  /** most entries kept; the least recently used go first (default 500) */
  maxEntries?: number
  now?: () => number
}

/** Bounded cache: entries expire after `ttl` and the least recently used are evicted past `maxEntries`. */
export class LruCache<R = any> implements DataSourceCache<R> {
  private readonly ttl: number
  private readonly max: number
  private readonly now: () => number
  private readonly map = new Map<string, { value: GetRowsResponse<R>; expires: number }>()

  constructor(options: LruCacheOptions = {}) {
    this.ttl = options.ttl ?? 300_000
    this.max = options.maxEntries ?? 500
    this.now = options.now ?? Date.now
  }

  get size() {
    return this.map.size
  }

  get(key: DataSourceCacheKey) {
    const k = cacheKeyOf(key)
    const hit = this.map.get(k)
    if (!hit) return undefined
    if (this.now() > hit.expires) {
      this.map.delete(k)
      return undefined
    }
    // re-insert: Map keeps insertion order, so the first key is always the least recently used
    this.map.delete(k)
    this.map.set(k, hit)
    return hit.value
  }

  set(key: DataSourceCacheKey, value: GetRowsResponse<R>) {
    const k = cacheKeyOf(key)
    this.map.delete(k)
    this.map.set(k, { value, expires: this.now() + this.ttl })
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string)
  }

  clear() {
    this.map.clear()
  }
}
