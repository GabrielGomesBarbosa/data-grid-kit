import { describe, expect, it } from 'vitest'
import { createPipeline, type PipelineInput } from './pipeline'
import type { ColumnDef, RowId } from './types'

interface Item {
  id: number
  name: string
  n: number
}
const items: Item[] = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `r${i + 1}`, n: (i * 5) % 7 }))
const columns: ColumnDef<Item>[] = [{ field: 'name' }, { field: 'n', type: 'number' }]
const none = new Set<RowId>()

const input = (over: Partial<PipelineInput<Item>> = {}): PipelineInput<Item> => ({
  rows: items,
  columns,
  getRowId: (r) => r.id,
  sortModel: [],
  filterModel: { items: [] },
  rowGroupingModel: [],
  expandedIds: none,
  expandAllByDefault: false,
  ...over,
})
const ids = (r: { rows: { id: RowId }[] }) => r.rows.map((x) => x.id)

describe('moving a row', () => {
  it('puts it before another, at the start, in the middle and at the end', () => {
    const run = createPipeline<Item>()
    run(input())
    run.patch({ move: [{ id: 5, before: 2 }] })
    expect(ids(run(input()))).toEqual([1, 5, 2, 3, 4, 6])
    run.patch({ move: [{ id: 6, before: 1 }] })
    expect(ids(run(input()))).toEqual([6, 1, 5, 2, 3, 4])
    run.patch({ move: [{ id: 6, before: null }] })
    expect(ids(run(input()))).toEqual([1, 5, 2, 3, 4, 6])
    run.patch({ move: [{ id: 1, before: null }] })
    expect(ids(run(input()))).toEqual([5, 2, 3, 4, 6, 1])
  })

  it('does nothing when the row is already there, or the target is unknown', () => {
    const run = createPipeline<Item>()
    const before = ids(run(input()))
    run.patch({ move: [{ id: 3, before: 4 }, { id: 6, before: null }, { id: 2, before: 2 }, { id: 99, before: 1 }, { id: 1, before: 99 }] })
    expect(ids(run(input()))).toEqual(before)
  })

  it('is applied incrementally, not as a rebuild', () => {
    const run = createPipeline<Item>()
    run(input())
    run.patch({ move: [{ id: 4, before: 1 }] })
    run(input())
    expect(run.lastUpdate).toBe('incremental')
  })

  it('reports the data index, which ignores filtering and paging', () => {
    const run = createPipeline<Item>()
    const filtered = input({ filterModel: { items: [{ field: 'n', operator: 'gt', value: 3 }] } })
    run(filtered)
    run.patch({ move: [{ id: 6, before: 2 }] })
    const out = run(filtered)
    // data order is now 1,6,2,3,4,5 whatever the filter shows
    expect([1, 6, 2, 3, 4, 5].map((id) => out.dataIndexOf(id))).toEqual([0, 1, 2, 3, 4, 5])
    expect(out.dataIndexOf(99)).toBe(-1)
  })

  it('moves a row that is filtered out as well, relative to a visible one', () => {
    const run = createPipeline<Item>()
    const shown = input({ filterModel: { items: [{ field: 'name', operator: 'equals', value: 'r2' }] } })
    run(shown)
    run.patch({ move: [{ id: 5, before: 2 }] })
    run(input({ filterModel: { items: [] } })) // clear the filter: the move was kept
    expect(ids(run(input()))).toEqual([1, 5, 2, 3, 4, 6])
  })

  it('leaves a sorted view in sorted order (the move only changes ties and the data order)', () => {
    const run = createPipeline<Item>()
    const sorted = input({ sortModel: [{ field: 'n', direction: 'asc' }] })
    const before = ids(run(sorted))
    run.patch({ move: [{ id: 3, before: 1 }] })
    const out = run(sorted)
    expect(out.rows.map((r) => r.row!.n)).toEqual([...out.rows.map((r) => r.row!.n)].sort((a, b) => a - b))
    expect(new Set(ids(out))).toEqual(new Set(before))
  })

  it('survives a rebuild caused by new columns, and is replayed in order', () => {
    const run = createPipeline<Item>()
    run(input())
    run.patch({ move: [{ id: 4, before: 1 }, { id: 2, before: null }] })
    run(input())
    const out = run(input({ columns: columns.slice() })) // same columns, new identity: full rebuild
    expect(run.lastUpdate).toBe('rebuild')
    expect(ids(out)).toEqual([4, 1, 3, 5, 6, 2])
  })

  it('is dropped when the owner passes new rows (its order wins)', () => {
    const run = createPipeline<Item>()
    run(input())
    run.patch({ move: [{ id: 4, before: 1 }] })
    run(input())
    expect(ids(run(input({ rows: [...items] })))).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('accepts the owner\'s array in the new order as "nothing changed" (no rebuild)', () => {
    const run = createPipeline<Item>()
    run(input())
    run.patch({ move: [{ id: 5, before: 2 }] })
    run(input())
    const reordered = [items[0]!, items[4]!, items[1]!, items[2]!, items[3]!, items[5]!]
    const out = run(input({ rows: reordered }))
    expect(run.lastUpdate).toBe('none') // the diff found no insert/remove/update, so there was nothing to redo
    expect(ids(out)).toEqual([1, 5, 2, 3, 4, 6])
  })

  it('survives hundreds of moves between the same two rows (renumbers when out of room)', () => {
    const run = createPipeline<Item>()
    run(input())
    for (let i = 0; i < 400; i++) {
      // keep squeezing a row between 1 and 2, then jumping it back out
      run.patch({ move: [{ id: 3, before: 2 }] })
      run.patch({ move: [{ id: 3, before: i % 2 ? 1 : null }] })
      run.patch({ move: [{ id: 4, before: 2 }] })
      run.patch({ move: [{ id: 5, before: 2 }] })
    }
    const out = run(input())
    expect(new Set(ids(out)).size).toBe(6)
    expect(ids(out).filter((x) => x === 3 || x === 4 || x === 5).length).toBe(3)
    // 5 was moved right before 2 last, 4 right before 2 earlier, so ...4,5,2
    const order = ids(out)
    expect(order.indexOf(5)).toBe(order.indexOf(2) - 1)
    expect(order.indexOf(4)).toBeLessThan(order.indexOf(5))
  })

  it('a row added after a move-to-end still lands last', () => {
    const run = createPipeline<Item>()
    run(input())
    run.patch({ move: [{ id: 2, before: null }, { id: 3, before: null }] })
    run.patch({ insert: [{ id: 7, name: 'r7', n: 1 }] })
    expect(ids(run(input()))).toEqual([1, 4, 5, 6, 2, 3, 7])
  })

  it('is ignored for grouped grids', () => {
    const run = createPipeline<Item>()
    const grouped = input({ rowGroupingModel: ['name'] })
    const before = ids(run(grouped))
    run.patch({ move: [{ id: 4, before: 1 }] })
    expect(ids(run(grouped))).toEqual(before)
  })
})

describe('open detail panels', () => {
  it('lists the rows that have one, with their position in the rows list', () => {
    const run = createPipeline<Item>()
    const out = run(input({ detailIds: new Set<RowId>([2, 5, 99]), sortModel: [{ field: 'n', direction: 'desc' }] }))
    const where = (id: RowId) => ids(out).indexOf(id)
    expect(out.detailRows).toEqual([2, 5].map((id) => ({ id, index: where(id) })).sort((a, b) => a.index - b.index))
  })

  it('is empty without any open panel', () => {
    expect(createPipeline<Item>()(input()).detailRows).toEqual([])
  })
})
