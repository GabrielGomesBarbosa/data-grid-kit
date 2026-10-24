import { describe, expect, it } from 'vitest'
import { createPipeline, type PipelineInput } from './pipeline'
import { computeColumnLayout, computeColumnRange, computeRowRange } from './layout'
import type { ColumnDef } from './types'

interface Person {
  id: number
  name: string
  team: string
  role: string
  age: number
  path?: string[]
}

const people: Person[] = [
  { id: 1, name: 'Ana', team: 'A', role: 'dev', age: 30 },
  { id: 2, name: 'Bruno', team: 'A', role: 'qa', age: 25 },
  { id: 3, name: 'Carla', team: 'B', role: 'dev', age: 41 },
  { id: 4, name: 'Davi', team: 'B', role: 'dev', age: 35 },
  { id: 5, name: 'Eva', team: 'C', role: 'qa', age: 28 },
]

const columns: ColumnDef<Person>[] = [
  { field: 'name' },
  { field: 'team' },
  { field: 'role' },
  { field: 'age', width: 80 },
]

const base = (over: Partial<PipelineInput<Person>> = {}): PipelineInput<Person> => ({
  rows: people,
  columns,
  getRowId: (r) => r.id,
  sortModel: [],
  filterModel: { items: [] },
  rowGroupingModel: [],
  expandedIds: new Set(),
  expandAllByDefault: false,
  ...over,
})

const ids = (r: { rows: { id: unknown }[] }) => r.rows.map((x) => x.id)

describe('flat pipeline', () => {
  it('sorts by number, desc, with empties last', () => {
    const run = createPipeline<Person>()
    const out = run(base({ sortModel: [{ field: 'age', direction: 'desc' }] }))
    expect(ids(out)).toEqual([3, 4, 1, 5, 2])
  })

  it('filters with operators and quick filter', () => {
    const run = createPipeline<Person>()
    const a = run(base({ filterModel: { items: [{ field: 'age', operator: 'gt', value: 29 }] } }))
    expect(ids(a)).toEqual([1, 3, 4])
    const b = run(base({ filterModel: { items: [], quickFilter: 'qa' } }))
    expect(ids(b)).toEqual([2, 5])
    expect(b.filteredCount).toBe(2)
  })

  it('paginates after filtering', () => {
    const run = createPipeline<Person>()
    const out = run(base({ pagination: { page: 1, pageSize: 2 } }))
    expect(ids(out)).toEqual([3, 4])
    expect(out.rootCount).toBe(5)
  })

  it('memoises stages: same inputs return the same result object', () => {
    const run = createPipeline<Person>()
    const input = base()
    expect(run(input)).toBe(run({ ...input }))
  })
})

describe('row grouping', () => {
  it('groups by one field, collapsed by default, with filtered child counts', () => {
    const run = createPipeline<Person>()
    const out = run(base({ rowGroupingModel: ['team'] }))
    expect(out.rows.map((r) => [r.type, r.groupValue, r.childCount, r.expanded])).toEqual([
      ['group', 'A', 2, false],
      ['group', 'B', 2, false],
      ['group', 'C', 1, false],
    ])
  })

  it('expands groups and nests two levels', () => {
    const run = createPipeline<Person>()
    const first = run(base({ rowGroupingModel: ['team', 'role'], expandAllByDefault: true }))
    // A > dev, qa ; B > dev ; C > qa  (+ leaves)
    expect(first.rows.map((r) => r.depth)).toEqual([0, 1, 2, 1, 2, 0, 1, 2, 2, 0, 1, 2])
    expect(first.rows[0]!.childCount).toBe(2)
  })

  it('drops groups that have no matching rows', () => {
    const run = createPipeline<Person>()
    const out = run(
      base({
        rowGroupingModel: ['team'],
        filterModel: { items: [{ field: 'role', operator: 'equals', value: 'qa' }] },
      }),
    )
    expect(out.rows.map((r) => r.groupValue)).toEqual(['A', 'C'])
    expect(out.rows.map((r) => r.childCount)).toEqual([1, 1])
  })

  it('sorts groups by the grouped column and leaves by their own', () => {
    const run = createPipeline<Person>()
    const out = run(
      base({
        rowGroupingModel: ['team'],
        expandAllByDefault: true,
        sortModel: [
          { field: 'team', direction: 'desc' },
          { field: 'age', direction: 'asc' },
        ],
      }),
    )
    expect(out.rows.map((r) => (r.type === 'group' ? r.groupValue : r.id))).toEqual(['C', 5, 'B', 4, 3, 'A', 2, 1])
  })

  it('collapses a single group via expandedIds when expandAllByDefault', () => {
    const run = createPipeline<Person>()
    const out = run(base({ rowGroupingModel: ['team'], expandAllByDefault: true, expandedIds: new Set(['group/team:A']) }))
    expect(out.rows.map((r) => r.type)).toEqual(['group', 'group', 'leaf', 'leaf', 'group', 'leaf'])
  })

  it('getLeafIds returns only visible matching rows', () => {
    const run = createPipeline<Person>()
    const out = run(
      base({
        rowGroupingModel: ['team'],
        filterModel: { items: [{ field: 'role', operator: 'equals', value: 'dev' }] },
      }),
    )
    expect(out.getLeafIds('group/team:A').sort()).toEqual([1])
    expect(out.getLeafIds('group/team:B').sort()).toEqual([3, 4])
  })
})

describe('tree data', () => {
  const rows: Person[] = [
    { id: 1, name: 'root', team: '', role: '', age: 0, path: ['root'] },
    { id: 2, name: 'src', team: '', role: '', age: 0, path: ['root', 'src'] },
    { id: 3, name: 'index', team: '', role: '', age: 5, path: ['root', 'src', 'index.ts'] },
    { id: 4, name: 'readme', team: '', role: '', age: 9, path: ['root', 'README.md'] },
    // parent path 'lib' has no row: becomes a synthetic group
    { id: 5, name: 'util', team: '', role: '', age: 7, path: ['lib', 'util.ts'] },
  ]
  const input = (over: Partial<PipelineInput<Person>> = {}) =>
    base({ rows, getTreeDataPath: (r) => r.path!, ...over })

  it('builds hierarchy, creating missing ancestors', () => {
    const run = createPipeline<Person>()
    const out = run(input({ expandAllByDefault: true }))
    expect(out.rows.map((r) => [r.depth, r.row?.name ?? 'synthetic'])).toEqual([
      [0, 'root'],
      [1, 'src'],
      [2, 'index'],
      [1, 'readme'],
      [0, 'synthetic'],
      [1, 'util'],
    ])
  })

  it('keeps ancestors of matching descendants', () => {
    const run = createPipeline<Person>()
    const out = run(
      input({
        expandAllByDefault: true,
        filterModel: { items: [{ field: 'name', operator: 'equals', value: 'index' }] },
      }),
    )
    expect(out.rows.map((r) => r.row?.name)).toEqual(['root', 'src', 'index'])
    expect(out.filteredCount).toBe(1)
  })

  it('sorts siblings only', () => {
    const run = createPipeline<Person>()
    const out = run(input({ expandAllByDefault: true, sortModel: [{ field: 'name', direction: 'desc' }] }))
    const rootChildren = out.rows.filter((r) => r.depth === 1 && r.row && [2, 4].includes(r.row.id)).map((r) => r.row!.name)
    expect(rootChildren).toEqual(['src', 'readme'])
  })

  it('rejects duplicate paths', () => {
    const run = createPipeline<Person>()
    const dup = [...rows, { id: 9, name: 'dup', team: '', role: '', age: 0, path: ['root', 'src'] }]
    expect(() => run(input({ rows: dup }))).toThrow(/share the tree path/)
  })
})

describe('column layout and pinning', () => {
  const state = {
    columnOrder: ['name', 'team', 'role', 'age'],
    columnWidths: {},
    columnVisibility: {},
    pinnedColumns: { left: ['age'], right: ['team'] },
  }

  it('lifts pinned columns out of the scrolling area', () => {
    const l = computeColumnLayout(columns, state)
    expect(l.left.map((c) => c.field)).toEqual(['age'])
    expect(l.right.map((c) => c.field)).toEqual(['team'])
    expect(l.center.map((c) => c.field)).toEqual(['name', 'role'])
    expect(l.leftWidth).toBe(80)
    expect(l.centerWidth).toBe(300)
    expect(l.pinnedSide.get('age')).toBe('left')
  })

  it('ignores hidden and unpinnable columns', () => {
    const cols: ColumnDef<Person>[] = [...columns.slice(0, 3), { field: 'age', pinnable: false }]
    const l = computeColumnLayout(cols, { ...state, columnVisibility: { team: false } })
    expect(l.left).toEqual([])
    expect(l.right).toEqual([])
    expect(l.center.map((c) => c.field)).toEqual(['name', 'role', 'age'])
  })
})

describe('virtualization', () => {
  it('computes a row window with buffer, clamped to bounds', () => {
    expect(computeRowRange(1000, 20, 0, 100, 40)).toEqual({ start: 0, end: 7 })
    expect(computeRowRange(1000, 20, 2000, 100, 40)).toEqual({ start: 98, end: 107 })
    expect(computeRowRange(10, 20, 5000, 100, 0)).toEqual({ start: 10, end: 10 })
    expect(computeRowRange(0, 20, 0, 100, 0)).toEqual({ start: 0, end: 0 })
  })

  it('finds the column window by binary search and reserves pinned width', () => {
    const cols: ColumnDef<Person>[] = Array.from({ length: 100 }, (_, i) => ({ field: `c${i}`, width: 100 }))
    const l = computeColumnLayout(cols, {
      columnOrder: [],
      columnWidths: {},
      columnVisibility: {},
      pinnedColumns: { left: ['c0'], right: [] },
    })
    // 99 center columns of 100px; viewport 500 with 100px pinned -> 400px visible
    const r = computeColumnRange(l, 1000, 500, 0)
    expect(r).toEqual({ start: 10, end: 14 })
    expect(computeColumnRange(l, 0, 500, 200)).toEqual({ start: 0, end: 6 })
  })
})
