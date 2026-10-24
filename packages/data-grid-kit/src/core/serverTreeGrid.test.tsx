import { StrictMode, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGrid } from './useGrid'
import type { DataSource, GetRowsParams } from './dataSource'
import type { ColumnDef, GridOptions } from './types'

interface Node {
  id: string
  key: string
  name: string
  /** children the node has (-1: some, count unknown) */
  kids: number
  salary?: number
}

const columns: ColumnDef<Node>[] = [{ field: 'name' }, { field: 'salary', type: 'number' }]
// the top level waits for the view to settle (60 ms) before asking; deeper levels ask at once
const flush = async () => {
  await new Promise((r) => setTimeout(r, 130))
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

/** 3 teams of 4 people each; each person has 2 tasks. Rows of a level come from `groupKeys`. */
function tree(over: { unknownCount?: boolean } = {}) {
  const calls: GetRowsParams[] = []
  const teams = [1, 2, 3].map((t): Node => ({ id: `t${t}`, key: `t${t}`, name: `Team ${t}`, kids: over.unknownCount ? -1 : 4, salary: t * 100 }))
  const people = (t: string) => [1, 2, 3, 4].map((p): Node => ({ id: `${t}-p${p}`, key: `p${p}`, name: `${t} person ${p}`, kids: p === 1 ? 2 : 0, salary: p }))
  const tasks = (t: string, p: string) => [1, 2].map((k): Node => ({ id: `${t}-${p}-k${k}`, key: `k${k}`, name: `${t} ${p} task ${k}`, kids: 0 }))
  const source: DataSource<Node> = {
    async getRows(params) {
      calls.push(params)
      const path = params.groupKeys ?? []
      const sortDesc = params.sortModel[0]?.direction === 'desc'
      let list = path.length === 0 ? teams : path.length === 1 ? people(path[0]!) : tasks(path[0]!, path[1]!)
      if (sortDesc) list = [...list].reverse()
      return { rows: list.slice(params.start, params.end + 1), rowCount: list.length }
    },
    getGroupKey: (row) => row.key,
    getChildrenCount: (row) => row.kids,
    getAggregatedValue: (row, field) => (field === 'salary' ? (row.salary ?? 0) * 10 : undefined),
  }
  return { source, calls }
}

const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>
const setup = (s: ReturnType<typeof tree>, over: Partial<GridOptions<Node>> = {}) =>
  renderHook(() => useGrid<Node>({ columns, dataSource: s.source, getRowId: (r) => r.id, pagination: false, ...over }), { wrapper })
const names = (g: { rows: ({ row?: Node } | undefined)[] }) => g.rows.map((r) => r?.row?.name)
const keysOf = (calls: GetRowsParams[]) => calls.map((c) => JSON.stringify(c.groupKeys))

describe('server-side tree', () => {
  it('loads the top level only, and its rows can be expanded', async () => {
    const s = tree()
    const { result } = setup(s)
    await act(flush)
    expect(keysOf(s.calls)).toEqual(['[]'])
    expect(result.current.server?.tree).toBe(true)
    expect(names(result.current)).toEqual(['Team 1', 'Team 2', 'Team 3'])
    expect(result.current.rows[0]).toMatchObject({ depth: 0, expandable: true, expanded: false, childCount: 4 })
  })

  it('expanding a row asks for its children with the path, and shows them right under it', async () => {
    const s = tree()
    const { result } = setup(s)
    await act(flush)
    act(() => result.current.api.toggleExpanded('t2'))
    await act(flush)
    expect(keysOf(s.calls)).toEqual(['[]', '["t2"]'])
    expect(names(result.current)).toEqual(['Team 1', 'Team 2', 't2 person 1', 't2 person 2', 't2 person 3', 't2 person 4', 'Team 3'])
    expect(result.current.rows[2]).toMatchObject({ depth: 1, expandable: true }) // person 1 has tasks
    expect(result.current.rows[3]).toMatchObject({ depth: 1, expandable: false })
    expect(result.current.rows[1]!.expanded).toBe(true)
    expect(result.current.result.indexOf('t2-p3')).toBe(4)
    expect(result.current.result.indexOf('t3')).toBe(6)
  })

  it('collapsing removes the children; expanding again comes from the cache, not the server', async () => {
    const s = tree()
    const { result } = setup(s)
    await act(flush)
    act(() => result.current.api.toggleExpanded('t1'))
    await act(flush)
    act(() => result.current.api.toggleExpanded('t1'))
    await act(flush)
    expect(names(result.current)).toEqual(['Team 1', 'Team 2', 'Team 3'])
    act(() => result.current.api.toggleExpanded('t1'))
    await act(flush)
    expect(names(result.current)).toHaveLength(7)
    expect(keysOf(s.calls)).toEqual(['[]', '["t1"]']) // nothing asked twice
  })

  it('levels nest: a child that is expanded opens its own level, with the path of both', async () => {
    const s = tree()
    const { result } = setup(s)
    await act(flush)
    act(() => result.current.api.toggleExpanded('t1'))
    await act(flush)
    act(() => result.current.api.toggleExpanded('t1-p1'))
    await act(flush)
    expect(keysOf(s.calls)).toEqual(['[]', '["t1"]', '["t1","p1"]'])
    expect(names(result.current).slice(0, 5)).toEqual(['Team 1', 't1 person 1', 't1 p1 task 1', 't1 p1 task 2', 't1 person 2'])
    expect(result.current.rows[2]).toMatchObject({ depth: 2, expandable: false })
  })

  it('with everything expanded by default every level loads', async () => {
    const s = tree()
    const { result } = setup(s, { initialState: { expandAllByDefault: true } })
    await act(flush)
    await act(flush)
    expect(keysOf(s.calls).sort()).toEqual(['[]', '["t1","p1"]', '["t1"]', '["t2","p1"]', '["t2"]', '["t3","p1"]', '["t3"]'].sort())
    expect(result.current.rows).toHaveLength(3 + 3 * 4 + 3 * 2)
  })

  it('a different sort starts over from the top, and open levels are asked again with the sort', async () => {
    const s = tree()
    const { result } = setup(s)
    await act(flush)
    act(() => result.current.api.toggleExpanded('t1'))
    await act(flush)
    act(() => result.current.api.setSortModel([{ field: 'name', direction: 'desc' }]))
    await act(flush)
    await act(flush)
    expect(names(result.current)[0]).toBe('Team 3')
    const last = s.calls.slice(-2)
    expect(last.map((c) => JSON.stringify(c.groupKeys)).sort()).toEqual(['["t1"]', '[]'].sort())
    expect(last.every((c) => c.sortModel[0]?.direction === 'desc')).toBe(true)
    expect(names(result.current)).toContain('t1 person 4') // the open level came back, in the new order
    expect(names(result.current).indexOf('t1 person 1')).toBeGreaterThan(names(result.current).indexOf('t1 person 4'))
  })

  it('sends the grouping and aggregation models, and group rows carry the aggregated values', async () => {
    const s = tree()
    const { result } = setup(s, { initialState: { rowGroupingModel: ['team', 'person'], aggregationModel: { salary: 'sum' } } })
    await act(flush)
    expect(s.calls[0]).toMatchObject({ groupKeys: [], groupFields: ['team', 'person'], aggregationModel: { salary: 'sum' } })
    expect(result.current.rows[0]!.aggregates).toEqual({ salary: 1000 }) // 100 × 10 from getAggregatedValue
    expect(result.current.rows[0]).toMatchObject({ groupField: 'team' })
    act(() => result.current.api.toggleExpanded('t1'))
    await act(flush)
    expect(result.current.rows[1]!.aggregates).toEqual({ salary: 10 }) // person 1 has tasks: a group
    expect(result.current.rows[2]!.aggregates).toBeUndefined() // person 2 is a leaf
  })

  it('an unknown child count still lets a row open, and its level fills in when it arrives', async () => {
    const s = tree({ unknownCount: true })
    const { result } = setup(s)
    await act(flush)
    expect(result.current.rows[0]).toMatchObject({ expandable: true, childCount: 0 })
    act(() => result.current.api.toggleExpanded('t1'))
    await act(flush)
    expect(names(result.current).slice(0, 5)).toEqual(['Team 1', 't1 person 1', 't1 person 2', 't1 person 3', 't1 person 4'])
  })

  it('a source with no child counts is not a tree; neither is a paginated grid', async () => {
    const s = tree()
    const plain = renderHook(() => useGrid<Node>({ columns, getRowId: (r) => r.id, pagination: false, dataSource: { getRows: s.source.getRows } }), { wrapper })
    await act(flush)
    expect(plain.result.current.server?.tree).toBe(false)
    const paged = setup(tree(), { pagination: true })
    await act(flush)
    expect(paged.result.current.server?.tree).toBe(false)
  })

  it('refreshData reloads the top and the open levels', async () => {
    const s = tree()
    const { result } = setup(s)
    await act(flush)
    act(() => result.current.api.toggleExpanded('t1'))
    await act(flush)
    const before = s.calls.length
    act(() => result.current.api.refreshData())
    await act(flush)
    await act(flush)
    expect(s.calls.length).toBeGreaterThan(before)
    expect(names(result.current)).toHaveLength(7)
  })
})
