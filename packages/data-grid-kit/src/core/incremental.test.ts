import { describe, expect, it } from 'vitest'
import { createPipeline, createRowFilter, getCellValue, type PipelineInput, type PipelineResult } from './pipeline'
import type { CustomAggregation } from './types'
import type { ColumnDef, FilterModel, RowId, SortItem } from './types'

interface Row {
  id: number
  name: string
  team: string
  role: string
  age: number
  path: string[]
}

let columns: ColumnDef<Row>[] = ['id', 'name', 'team', 'role', 'age'].map((field) => ({ field }))

/** small deterministic PRNG so failures are reproducible by seed */
function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

const TEAMS = ['A', 'B', 'C']
const ROLES = ['dev', 'qa', 'ops', 'Dev'] // 'Dev' vs 'dev' share a collator rank on purpose
const SEGS = ['x', 'y', 'z']

type Mode = 'flat' | 'group' | 'tree'

const sortOptions: Record<Mode, SortItem[][]> = {
  flat: [
    [],
    [{ field: 'age', direction: 'asc' }, { field: 'id', direction: 'asc' }],
    [{ field: 'role', direction: 'desc' }, { field: 'age', direction: 'asc' }, { field: 'id', direction: 'asc' }],
    [{ field: 'id', direction: 'desc' }],
    [{ field: 'name', direction: 'asc' }, { field: 'id', direction: 'asc' }],
  ],
  group: [
    [{ field: 'team', direction: 'asc' }, { field: 'role', direction: 'asc' }, { field: 'age', direction: 'asc' }, { field: 'id', direction: 'asc' }],
    [{ field: 'team', direction: 'desc' }, { field: 'role', direction: 'desc' }, { field: 'id', direction: 'desc' }],
  ],
  tree: [
    [{ field: 'age', direction: 'asc' }, { field: 'id', direction: 'asc' }],
    [{ field: 'name', direction: 'desc' }, { field: 'id', direction: 'asc' }],
  ],
}

const aggregationOptions: Record<string, string>[] = [
  {},
  { age: 'sum' },
  { age: 'avg', id: 'size' },
  { age: 'min', name: 'count' },
  { age: 'max', id: 'max', name: 'min' },
  { age: 'range', team: 'count' }, // 'range' is a custom function
]

const customAggregations: Record<string, CustomAggregation<Row>> = {
  range: {
    label: 'range',
    apply: ({ values }) => {
      const n = values.filter((v): v is number => typeof v === 'number')
      return n.length ? Math.max(...n) - Math.min(...n) : null
    },
  },
}

const filterOptions: FilterModel[] = [
  { items: [] },
  { items: [{ field: 'age', operator: 'gt', value: 40 }] },
  { items: [{ field: 'team', operator: 'equals', value: 'a' }] },
  { items: [], quickFilter: 'dev' },
  { items: [{ field: 'age', operator: 'lt', value: 30 }, { field: 'role', operator: 'contains', value: 'o' }], logic: 'or' },
]

function summarize(r: PipelineResult<Row>) {
  return {
    rows: r.rows.map((x) => [x.id, x.type, x.depth, x.childCount, x.expandable, x.expanded, x.groupValue ?? null, x.row?.id ?? null]),
    aggregates: r.rows.map((x) => x.aggregates ?? null),
    totals: r.getTotals() ?? null,
    rootCount: r.rootCount,
    filteredCount: r.filteredCount,
    data: r.getVisibleDataRows().map((x) => x.id),
  }
}

function runScenario(seed: number, mode: Mode, usePatchApi: boolean) {
  const rand = rng(seed)
  const int = (n: number) => Math.floor(rand() * n)
  const pick = <T,>(list: T[]) => list[int(list.length)]!

  let nextId = 1
  const usedPaths = new Set<string>()
  const mkPath = (id: number): string[] => {
    if (mode !== 'tree') return []
    for (let tries = 0; tries < 20; tries++) {
      const depth = 1 + int(3)
      const path = Array.from({ length: depth - 1 }, () => pick(SEGS))
      // some rows are "folders": a path made only of segments, so they can be ancestors of others
      path.push(rand() < 0.3 ? pick(SEGS) : `r${id}`)
      const key = JSON.stringify(path)
      if (!usedPaths.has(key)) {
        usedPaths.add(key)
        return path
      }
    }
    const path = [`r${id}`]
    usedPaths.add(JSON.stringify(path))
    return path
  }
  const mkRow = (): Row => {
    const id = nextId++
    return { id, name: `n${int(8)}`, team: pick(TEAMS), role: pick(ROLES), age: 18 + int(40), path: mkPath(id) }
  }

  let rows: Row[] = Array.from({ length: 20 + int(30) }, mkRow)
  usedPaths.clear()
  rows.forEach((r) => usedPaths.add(JSON.stringify(r.path)))

  const groupFields = mode === 'group' ? (rand() < 0.5 ? ['team', 'role'] : ['team']) : []
  let sortModel = pick(sortOptions[mode])
  if (mode === 'group' && groupFields.length === 1) sortModel = sortModel.filter((s) => s.field !== 'role' || true)
  let filterModel = pick(filterOptions)
  let aggregationModel = pick(aggregationOptions)
  let expanded = new Set<RowId>()
  let expandAll = rand() < 0.7

  const inc = createPipeline<Row>()
  const input = (rowsProp: Row[]): PipelineInput<Row> => ({
    rows: rowsProp,
    columns,
    getRowId: (r) => r.id,
    getTreeDataPath: mode === 'tree' ? (r) => r.path : undefined,
    sortModel,
    filterModel,
    rowGroupingModel: groupFields,
    expandedIds: expanded,
    expandAllByDefault: expandAll,
    aggregationModel,
    aggregationFunctions: customAggregations,
  })

  /** an independent, slow calculation of the totals (no accumulators, no hierarchy) */
  const checkAgainstNaive = (got: ReturnType<typeof summarize>) => {
    const keep = createRowFilter(filterModel, columns)
    const passing = rows.filter((r) => !keep || keep(r))
    if (!Object.keys(aggregationModel).length) return expect(got.totals).toBeNull()
    const naive = (list: Row[], field: string, name: string): unknown => {
      const col = columns.find((c) => c.field === field)!
      const vals = list.map((r) => getCellValue(col, r))
      const present = vals.filter((v) => v != null && v !== '')
      const nums = present.filter((v): v is number => typeof v === 'number')
      switch (name) {
        case 'sum': return nums.length ? nums.reduce((a, b) => a + b, 0) : null
        case 'avg': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
        case 'min': return present.length ? present.reduce((a, b) => ((a as number | string) <= (b as number | string) ? a : b)) : null
        case 'max': return present.length ? present.reduce((a, b) => ((a as number | string) >= (b as number | string) ? a : b)) : null
        case 'count': return present.length
        case 'size': return list.length
        default: return customAggregations[name]!.apply({ values: vals, rows: list })
      }
    }
    const totals = got.totals as Record<string, unknown>
    for (const [field, name] of Object.entries(aggregationModel)) {
      // text min/max use the collator in the grid; names here are n0..n7 so plain comparison agrees
      expect(totals[field], `total ${name}(${field}) seed ${seed} ${mode}`).toEqual(naive(passing, field, name))
    }
  }

  const check = (step: string, rowsProp: Row[]) => {
    const got = summarize(inc(input(rowsProp)))
    const want = summarize(createPipeline<Row>()(input(rows)))
    let hint = ''
    const i = got.rows.findIndex((r, n) => JSON.stringify(r) !== JSON.stringify(want.rows[n]))
    if (i >= 0) {
      const byId = new Map(rows.map((r) => [r.id, r]))
      const show = (rr: unknown[] | undefined) => (rr ? JSON.stringify(rr) + (rr[7] != null ? ' ' + JSON.stringify(byId.get(rr[7] as number)) : '') : 'none')
      hint = `\nfirst difference at row ${i}\n got : ${show(got.rows[i])}\n want: ${show(want.rows[i])}\nsort=${JSON.stringify(sortModel)} filter=${JSON.stringify(filterModel)} groups=${JSON.stringify(groupFields)}`
    }
    expect(got, `seed ${seed} ${mode} ${usePatchApi ? 'patch' : 'diff'} after ${step}${hint}`).toEqual(want)
    checkAgainstNaive(got)
  }

  let rowsProp = rows
  check('initial', rowsProp)
  let incrementalSteps = 0
  let steps = 0

  for (let step = 0; step < 40; step++) {
    const op = int(10)
    let label = ''
    let structural = false
    if (op <= 1) {
      // insert 1-3 rows at the end
      const added = Array.from({ length: 1 + int(3) }, mkRow)
      rows = [...rows, ...added]
      if (usePatchApi) inc.patch({ insert: added })
      label = `insert ${added.length}`
    } else if (op <= 3 && rows.length > 3) {
      // remove 1-3 rows anywhere
      const gone = new Set<number>()
      for (let i = 0; i < 1 + int(3); i++) gone.add(pick(rows).id)
      for (const r of rows) if (gone.has(r.id)) usedPaths.delete(JSON.stringify(r.path))
      rows = rows.filter((r) => !gone.has(r.id))
      if (usePatchApi) inc.patch({ remove: [...gone] })
      label = `remove ${gone.size}`
    } else if (op <= 6 && rows.length) {
      // update 1-3 rows in place (new objects); sometimes a move between groups / paths
      const changed: Row[] = []
      const next = rows.slice()
      for (let i = 0; i < 1 + int(3); i++) {
        const at = int(next.length)
        const old = next[at]!
        const upd: Row = { ...old }
        const kind = int(4)
        if (kind === 0) upd.age = 18 + int(40)
        else if (kind === 1) upd.team = pick(TEAMS)
        else if (kind === 2) upd.role = pick(ROLES)
        else if (mode === 'tree') {
          usedPaths.delete(JSON.stringify(old.path))
          upd.path = mkPath(old.id)
        } else upd.name = `n${int(8)}`
        next[at] = upd
        const k = changed.findIndex((c) => c.id === upd.id)
        if (k >= 0) changed[k] = upd
        else changed.push(upd)
      }
      rows = next
      if (usePatchApi) inc.patch({ update: changed })
      label = `update ${changed.length}`
    } else if (op === 9 && usePatchApi && mode === 'flat' && rows.length > 2) {
      // drag-and-drop: move one row before another (or to the end)
      const moving = pick(rows)
      const others = rows.filter((r) => r.id !== moving.id)
      const beforeRow = rand() < 0.2 ? null : pick(others)
      const next = others.slice()
      next.splice(beforeRow ? next.indexOf(beforeRow) : next.length, 0, moving)
      rows = next
      inc.patch({ move: [{ id: moving.id, before: beforeRow ? beforeRow.id : null }] })
      label = `move ${moving.id} before ${beforeRow?.id ?? 'end'}`
    } else if (op >= 8 && !usePatchApi && rows.length > 2) {
      // the owner reorders its array: swap two rows (only possible through the rows prop)
      const next = rows.slice()
      const a = int(next.length)
      const b = int(next.length)
      ;[next[a], next[b]] = [next[b]!, next[a]!]
      rows = next
      label = 'swap rows'
    } else if (op === 7 && usePatchApi && rand() < 0.5) {
      // same columns, new array identity: the hierarchy is rebuilt and imperative edits must be replayed
      columns = columns.slice()
      label = 'new columns identity'
      structural = true
    } else if (op === 7) {
      // views change without touching the data
      const what = int(5)
      if (what === 4) aggregationModel = pick(aggregationOptions)
      else if (what === 0) sortModel = pick(sortOptions[mode])
      else if (what === 1) filterModel = pick(filterOptions)
      else if (what === 2) expandAll = !expandAll
      else expanded = new Set(rows.slice(0, 3).map((r) => (mode === 'tree' ? r.id : `group/team:${pick(TEAMS)}`)))
      label = 'view change'
      structural = true
    }
    // with the diff path the owner passes a new array; with the patch API the prop stays the same
    if (!usePatchApi && !structural) rowsProp = rows
    check(`${label} (step ${step})`, rowsProp)
    steps++
    if (inc.lastUpdate === 'incremental') incrementalSteps++
  }
  return { incrementalSteps, steps }
}

describe('incremental updates match a fresh rebuild', () => {
  for (const mode of ['flat', 'group', 'tree'] as Mode[]) {
    for (const usePatchApi of [false, true]) {
      it(`${mode} / ${usePatchApi ? 'patch API' : 'rows diff'} (60 random histories)`, () => {
        let incremental = 0
        let total = 0
        for (let seed = 1; seed <= 60; seed++) {
          const r = runScenario(seed * 7919 + (usePatchApi ? 1 : 0), mode, usePatchApi)
          incremental += r.incrementalSteps
          total += r.steps
        }
        // the point of the test is the incremental path, so make sure it actually ran
        expect(incremental / total).toBeGreaterThan(0.4)
      })
    }
  }
})

describe('incremental update behaviour', () => {
  const mk = (n: number): Row[] =>
    Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `n${i}`, team: TEAMS[i % 3]!, role: 'dev', age: 20 + (i % 30), path: [] }))
  const noneExpanded = new Set<RowId>()
  const base = (rows: Row[]): PipelineInput<Row> => ({
    rows,
    columns,
    getRowId: (r) => r.id,
    sortModel: [{ field: 'age', direction: 'asc' }, { field: 'id', direction: 'asc' }],
    filterModel: { items: [] },
    rowGroupingModel: [],
    expandedIds: noneExpanded,
    expandAllByDefault: false,
  })

  it('edits that do not touch sort or filter keys keep every other row object', () => {
    const rows = mk(500)
    const run = createPipeline<Row>()
    const first = run(base(rows))
    const next = rows.slice()
    next[10] = { ...rows[10]!, name: 'renamed' }
    const second = run(base(next))
    expect(run.lastUpdate).toBe('incremental')
    expect(second.rows.find((r) => r.id === 11)!.row!.name).toBe('renamed')
    expect(second.rows.map((r) => r.id)).toEqual(first.rows.map((r) => r.id))
  })

  it('rebuilds (and stays correct) when rows are reordered or inserted in the middle', () => {
    const rows = mk(50)
    const run = createPipeline<Row>()
    run(base(rows))
    const reversed = [...rows].reverse()
    const out = run(base(reversed))
    expect(run.lastUpdate).toBe('rebuild')
    expect(out.rows.map((r) => r.id)).toEqual(createPipeline<Row>()(base(reversed)).rows.map((r) => r.id))
    const middle = [...reversed.slice(0, 5), { ...rows[0]!, id: 999 }, ...reversed.slice(5)]
    run(base(middle))
    expect(run.lastUpdate).toBe('rebuild')
  })

  it('rebuilds when most of the data changed', () => {
    const rows = mk(2000)
    const run = createPipeline<Row>()
    run(base(rows))
    run(base(rows.map((r) => ({ ...r, age: r.age + 1 }))))
    expect(run.lastUpdate).toBe('rebuild')
  })

  it('reports no work when nothing changed, and ignores a duplicate-id input', () => {
    const rows = mk(10)
    const run = createPipeline<Row>()
    const a = run(base(rows))
    const b = run(base(rows))
    expect(run.lastUpdate).toBe('none')
    expect(b).toBe(a)
    run(base([...rows, rows[0]!])) // same id twice
    expect(run.lastUpdate).toBe('rebuild')
  })

  it('a patch is discarded when the rows prop gets a new identity', () => {
    const rows = mk(10)
    const run = createPipeline<Row>()
    run(base(rows))
    run.patch({ update: [{ ...rows[0]!, name: 'patched' }] })
    expect(run(base(rows)).getRow(1)!.name).toBe('patched')
    expect(run(base([...rows])).getRow(1)!.name).toBe('n0') // owner's data wins
  })

  it('patch upserts: update of an unknown id inserts, insert of a known id replaces', () => {
    const rows = mk(5)
    const run = createPipeline<Row>()
    run(base(rows))
    run.patch({ update: [{ id: 99, name: 'new', team: 'A', role: 'dev', age: 5, path: [] }], insert: [{ ...rows[0]!, name: 'again' }] })
    const out = run(base(rows))
    expect(out.getRow(99)!.name).toBe('new')
    expect(out.getRow(1)!.name).toBe('again')
    expect(out.filteredCount).toBe(6)
  })

  it('removing the last row of a group removes the group, and re-adding recreates it', () => {
    const rows = mk(6)
    const run = createPipeline<Row>()
    const input = { ...base(rows), rowGroupingModel: ['team'], sortModel: [{ field: 'team', direction: 'asc' as const }] }
    expect(run(input).rows.map((r) => r.groupValue)).toEqual(['A', 'B', 'C'])
    run.patch({ remove: rows.filter((r) => r.team === 'B').map((r) => r.id) })
    expect(run(input).rows.map((r) => r.groupValue)).toEqual(['A', 'C'])
    run.patch({ insert: [{ id: 100, name: 'z', team: 'B', role: 'dev', age: 1, path: [] }] })
    expect(run(input).rows.map((r) => r.groupValue)).toEqual(['A', 'B', 'C'])
  })

  it('edits survive a rebuild caused by new columns, but not by new rows', () => {
    const rows = mk(10)
    const run = createPipeline<Row>()
    run(base(rows))
    run.patch({ update: [{ ...rows[2]!, name: 'edited' }], remove: [rows[5]!.id], insert: [{ ...rows[0]!, id: 500, name: 'added' }] })
    const cols2 = columns.slice() // same columns, new identity -> full rebuild
    const out = run({ ...base(rows), columns: cols2 })
    expect(run.lastUpdate).toBe('rebuild')
    expect(out.getRow(3)!.name).toBe('edited')
    expect(out.getRow(6)).toBeUndefined()
    expect(out.getRow(500)!.name).toBe('added')
    const fresh = run({ ...base([...rows]), columns: cols2 }) // owner passes new rows: its data wins
    expect(fresh.getRow(3)!.name).toBe('n2')
    expect(fresh.getRow(500)).toBeUndefined()
  })

  it('throws on a duplicate tree path in an incremental insert and recovers on the next run', () => {
    const rows: Row[] = [{ id: 1, name: 'a', team: 'A', role: 'dev', age: 1, path: ['x'] }]
    const run = createPipeline<Row>()
    const input = { ...base(rows), getTreeDataPath: (r: Row) => r.path }
    run(input)
    run.patch({ insert: [{ id: 2, name: 'b', team: 'A', role: 'dev', age: 1, path: ['x'] }] })
    expect(() => run(input)).toThrow(/share the tree path/)
    expect(run({ ...input, rows: [...rows] }).rows).toHaveLength(1) // rebuilt from the owner's rows
  })
})
