import { StrictMode, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGrid } from './useGrid'
import type { DataSource, GetRowsParams, GetRowsResponse } from './dataSource'
import type { ColumnDef, GridOptions } from './types'

interface Person {
  id: number
  name: string
  age: number
}

const columns: ColumnDef<Person>[] = [
  { field: 'name', editable: true },
  { field: 'age', type: 'number', editable: true },
]

const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve()
}

/** a server with `total` people, sorted by id (asc) or reversed (desc), filtered by quickFilter on the name */
function server(total = 250, over: { count?: boolean; failFirst?: boolean } = {}) {
  const calls: GetRowsParams[] = []
  let failed = false
  const all = Array.from({ length: total }, (_, i): Person => ({ id: i + 1, name: i % 2 ? `odd ${i + 1}` : `even ${i + 1}`, age: 20 + (i % 40) }))
  const source: DataSource<Person> = {
    async getRows(params) {
      calls.push(params)
      if (over.failFirst && !failed) {
        failed = true
        throw new Error('first call fails')
      }
      let list = all
      const q = params.filterModel.quickFilter
      if (q) list = list.filter((p) => p.name.includes(q))
      if (params.sortModel[0]?.direction === 'desc') list = [...list].reverse()
      const rows = list.slice(params.start, params.end + 1)
      const res: GetRowsResponse<Person> = { rows }
      if (over.count !== false) res.rowCount = list.length
      return res
    },
    // the server keeps what it was given (normalised), so a later re-read agrees with the screen
    updateRow: vi.fn(async ({ updatedRow }) => {
      const saved = { ...updatedRow, name: updatedRow.name.toUpperCase() }
      all[saved.id - 1] = saved
      return saved
    }),
  }
  return { source, calls, all }
}

const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>
const setup = (s: ReturnType<typeof server>, over: Partial<GridOptions<Person>> = {}) =>
  renderHook(() => useGrid<Person>({ columns, dataSource: s.source, getRowId: (r) => r.id, ...over }), { wrapper })

describe('server-side data, paginated', () => {
  it('loads the first page, reports the count, and renders skeleton slots until then', async () => {
    const s = server(250)
    const { result } = setup(s, { initialState: { paginationModel: { page: 0, pageSize: 50 } } })
    // before anything arrived: a page of empty slots, loading
    expect(result.current.rows).toHaveLength(50)
    expect(result.current.rows[0]).toBeUndefined()
    expect(result.current.server?.loading).toBe(true)
    await act(flush)
    expect(result.current.rows[0]!.row).toMatchObject({ id: 1 })
    expect(result.current.rows).toHaveLength(50)
    expect(result.current.server).toMatchObject({ mode: 'pages', rowCount: 250, loading: false, error: null })
    expect(result.current.result.rootCount).toBe(250) // what the pager counts
  })

  it('sends exactly the page asked for (aligned to the block size)', async () => {
    const s = server(250)
    setup(s, { initialState: { paginationModel: { page: 0, pageSize: 50 } } })
    await act(flush)
    expect(s.calls[0]!).toMatchObject({ start: 0, end: 49 })
    expect(s.calls.every((c) => c.start === 0 && c.end === 49)).toBe(true) // one page, one block: nothing else is fetched
  })

  it('changing page fetches that page; going back is served from the cache', async () => {
    const s = server(250)
    const { result } = setup(s, { initialState: { paginationModel: { page: 0, pageSize: 50 } } })
    await act(flush)
    act(() => result.current.api.setPage(2))
    await act(flush)
    expect(result.current.rows[0]!.row).toMatchObject({ id: 101 })
    const before = s.calls.length
    act(() => result.current.api.setPage(0))
    await act(flush)
    expect(result.current.rows[0]!.row).toMatchObject({ id: 1 })
    expect(s.calls.length).toBe(before) // no request
  })

  it('the last page is shorter', async () => {
    const s = server(120)
    const { result } = setup(s, { initialState: { paginationModel: { page: 2, pageSize: 50 } } })
    await act(flush)
    expect(result.current.rows).toHaveLength(20)
    expect(result.current.rows[19]!.row).toMatchObject({ id: 120 })
  })

  it('sorting and filtering are done by the server, and go back to page one', async () => {
    const s = server(250)
    const { result } = setup(s, { initialState: { paginationModel: { page: 0, pageSize: 50 } } })
    await act(flush)
    act(() => result.current.api.setPage(1))
    await act(flush)
    act(() => result.current.api.setSortModel([{ field: 'age', direction: 'desc' }]))
    await act(flush)
    expect(result.current.state.paginationModel.page).toBe(0)
    expect(s.calls.at(-1)!.sortModel).toEqual([{ field: 'age', direction: 'desc' }])
    expect(result.current.rows[0]!.row).toMatchObject({ id: 250 }) // the server reversed it; the client did not sort
    act(() => result.current.api.setQuickFilter('even'))
    await act(flush)
    expect(s.calls.at(-1)!.filterModel.quickFilter).toBe('even')
    expect(result.current.server?.rowCount).toBe(125)
    expect(result.current.rows.every((r) => r!.row!.name.startsWith('even'))).toBe(true)
  })

  it('ignores the client-side rows prop, and never sorts or filters by itself', async () => {
    const s = server(100)
    const { result } = setup(s, { rows: [{ id: 999, name: 'ignored', age: 1 }], initialState: { paginationModel: { page: 0, pageSize: 20 } } })
    await act(flush)
    expect(result.current.rows.some((r) => r?.row?.id === 999)).toBe(false)
    act(() => result.current.api.setQuickFilter('does not match anything'))
    await act(flush)
    // the fake server filters; the client keeps whatever came back
    expect(result.current.server?.rowCount).toBe(0)
    expect(result.current.rows).toHaveLength(0)
  })

  it('with an unknown count the pager still finds the next page, and the end', async () => {
    const s = server(120, { count: false })
    const { result } = setup(s, { initialState: { paginationModel: { page: 0, pageSize: 50 } } })
    await act(flush)
    expect(result.current.server?.rowCount).toBe(-1)
    expect(result.current.server?.hasNextPage).toBe(true)
    expect(Math.ceil(result.current.result.rootCount / 50)).toBeGreaterThanOrEqual(2) // at least one more page is offered
    act(() => result.current.api.setPage(2))
    await act(flush)
    expect(result.current.rows).toHaveLength(20)
    expect(result.current.server).toMatchObject({ rowCount: 120, hasNextPage: false })
  })

  it('an error is reported, shows up in server.error, and refreshData() retries', async () => {
    const s = server(100, { failFirst: true })
    const onDataSourceError = vi.fn()
    const { result } = setup(s, { onDataSourceError, initialState: { paginationModel: { page: 0, pageSize: 50 } } })
    await act(flush)
    expect(onDataSourceError).toHaveBeenCalled()
    expect(onDataSourceError.mock.calls[0]![0].message).toBe('first call fails')
    expect(result.current.server?.error).not.toBeNull()
    expect(result.current.rows[0]).toBeUndefined()
    act(() => result.current.api.refreshData())
    await act(flush)
    expect(result.current.server?.error).toBeNull()
    expect(result.current.rows[0]!.row).toMatchObject({ id: 1 })
  })

  it('editing goes through dataSource.updateRow and shows what the server returned', async () => {
    const s = server(100)
    const { result } = setup(s, { initialState: { paginationModel: { page: 0, pageSize: 50 } } })
    await act(flush)
    act(() => void result.current.api.startEdit(3, 'name'))
    let ok = false
    await act(async () => void (ok = await result.current.api.commitEdit('renamed')))
    expect(ok).toBe(true)
    expect(s.source.updateRow).toHaveBeenCalledWith(expect.objectContaining({ rowId: 3, updatedRow: expect.objectContaining({ name: 'renamed' }) }))
    expect(result.current.rows[2]!.row!.name).toBe('RENAMED') // the server's version, not what was typed
    expect(result.current.state.editingCell).toBeNull()
  })

  it('a refused update keeps the editor open and reports through onDataSourceError', async () => {
    const s = server(100)
    s.source.updateRow = vi.fn(async () => {
      throw new Error('conflict')
    })
    const onDataSourceError = vi.fn()
    const onProcessRowUpdateError = vi.fn()
    const { result } = setup(s, { onDataSourceError, onProcessRowUpdateError, initialState: { paginationModel: { page: 0, pageSize: 50 } } })
    await act(flush)
    act(() => void result.current.api.startEdit(3, 'name'))
    let ok = true
    await act(async () => void (ok = await result.current.api.commitEdit('nope')))
    expect(ok).toBe(false)
    expect(result.current.state.editingCell).not.toBeNull()
    expect(onDataSourceError).toHaveBeenCalledTimes(1)
    expect(onDataSourceError.mock.calls[0]![0].kind).toBe('updateRow')
    expect(onProcessRowUpdateError).not.toHaveBeenCalled()
    expect(result.current.rows[2]!.row!.name).toBe('even 3') // untouched
  })

  it('without updateRow, processRowUpdate persists the edit', async () => {
    const s = server(100)
    delete s.source.updateRow
    const processRowUpdate = vi.fn(async (r: Person) => ({ ...r, age: 99 }))
    const { result } = setup(s, { processRowUpdate, initialState: { paginationModel: { page: 0, pageSize: 50 } } })
    await act(flush)
    act(() => void result.current.api.startEdit(4, 'name'))
    await act(async () => void (await result.current.api.commitEdit('x')))
    expect(result.current.rows[3]!.row).toMatchObject({ name: 'x', age: 99 })
  })

  it('features that need every row on the client are off: pinning, reordering, aggregation', async () => {
    const s = server(100)
    const { result } = setup(s, { rowReordering: true, initialState: { paginationModel: { page: 0, pageSize: 50 } } })
    await act(flush)
    expect(result.current.reorderAllowed).toBe(false)
    act(() => result.current.api.pinRow(2, 'top'))
    expect(result.current.pinnedTop).toEqual([])
    expect(result.current.rows[1]!.row).toMatchObject({ id: 2 }) // still in the list
    expect(result.current.result.getTotals()).toBeUndefined()
  })

  it('open detail panels follow their row', async () => {
    const s = server(100)
    const { result } = setup(s, { detailPanelHeight: 80, initialState: { paginationModel: { page: 0, pageSize: 50 } } })
    await act(flush)
    act(() => result.current.api.toggleDetailPanel(5))
    expect(result.current.detailSlots).toEqual([{ id: 5, index: 4, height: 80, auto: false }])
  })
})

describe('server-side data, lazy loading', () => {
  const lazy = (s: ReturnType<typeof server>, over: Partial<GridOptions<Person>> = {}) =>
    setup(s, { pagination: false, rowHeight: 10, headerHeight: 10, dataSourceChunkSize: 20, ...over })

  it('has one slot per row of the data set, and only the blocks near the view are loaded', async () => {
    const s = server(1000)
    const { result } = lazy(s)
    act(() => result.current.api.setViewport(300, 110)) // 100px of rows: 10 rows
    await act(flush)
    expect(result.current.rows).toHaveLength(1000)
    expect(result.current.rows[0]!.row).toMatchObject({ id: 1 })
    expect(result.current.rows[500]).toBeUndefined() // never asked for
    expect(s.calls.every((c) => c.start < 200)).toBe(true) // only what is near the top
    expect(result.current.server).toMatchObject({ mode: 'lazy', rowCount: 1000 })
  })

  it('scrolling loads the blocks that come into view', async () => {
    vi.useFakeTimers()
    try {
      const s = server(1000)
      const { result } = lazy(s)
      act(() => result.current.api.setViewport(300, 110))
      await act(async () => void (await vi.advanceTimersByTimeAsync(100)))
      expect(result.current.rows[700]).toBeUndefined()
      act(() => result.current.api.setScroll(7000, 0)) // row 700
      await act(async () => void (await vi.advanceTimersByTimeAsync(200)))
      expect(result.current.rows[700]!.row).toMatchObject({ id: 701 })
      expect(result.current.rows[100]).toBeUndefined() // the first blocks were not asked for again
    } finally {
      vi.useRealTimers()
    }
  })

  it('a new sort drops the loaded rows and starts again from the top', async () => {
    const s = server(1000)
    const { result } = lazy(s)
    act(() => result.current.api.setViewport(300, 110))
    await act(flush)
    act(() => result.current.api.setSortModel([{ field: 'age', direction: 'desc' }]))
    expect(result.current.rows[0]).toBeUndefined()
    await act(flush)
    expect(result.current.rows[0]!.row).toMatchObject({ id: 1000 })
  })

  it('infinite scrolling: with no row count, the list grows as blocks arrive and stops at the end', async () => {
    vi.useFakeTimers()
    try {
      const s = server(70, { count: false })
      const { result } = lazy(s)
      act(() => result.current.api.setViewport(300, 110))
      await act(async () => void (await vi.advanceTimersByTimeAsync(100)))
      expect(result.current.server?.rowCount).toBe(-1)
      expect(result.current.rows.length).toBeGreaterThanOrEqual(40) // loaded + a block of skeleton ahead
      act(() => result.current.api.setScroll(400, 0))
      await act(async () => void (await vi.advanceTimersByTimeAsync(300)))
      for (let i = 0; i < 4; i++) {
        act(() => result.current.api.setScroll(10 * (result.current.rows.length - 10), 0))
        await act(async () => void (await vi.advanceTimersByTimeAsync(300)))
      }
      expect(result.current.server).toMatchObject({ rowCount: 70, hasNextPage: false })
      expect(result.current.rows).toHaveLength(70)
      expect(result.current.rows[69]!.row).toMatchObject({ id: 70 })
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps selection and the focused cell by id across blocks', async () => {
    const s = server(1000)
    const { result } = lazy(s)
    act(() => result.current.api.setViewport(300, 110))
    await act(flush)
    act(() => result.current.api.toggleSelection(3, true))
    expect(result.current.isSelected(result.current.rows[2]!)).toBe(true)
    act(() => result.current.api.focusCell({ rowId: 3, field: 'name' }))
    expect(result.current.result.indexOf(3)).toBe(2)
    expect(result.current.result.indexOf(900)).toBe(-1) // not loaded
  })
})

describe('server-side data, lifecycle', () => {
  it('a client-side grid is unaffected: rows still sort and filter locally', async () => {
    const rows: Person[] = [
      { id: 1, name: 'b', age: 2 },
      { id: 2, name: 'a', age: 1 },
    ]
    const { result } = renderHook(() => useGrid<Person>({ columns, rows, getRowId: (r) => r.id, pagination: false }))
    act(() => result.current.api.setSortModel([{ field: 'age', direction: 'asc' }]))
    expect(result.current.rows.map((r) => r.id)).toEqual([2, 1])
    expect(result.current.server).toBeNull()
    expect(result.current.api.getDataSourceState()).toBeNull()
  })

  it('survives StrictMode mounting twice without duplicating work', async () => {
    const s = server(100)
    const { result } = setup(s, { initialState: { paginationModel: { page: 0, pageSize: 50 } } })
    await act(flush)
    expect(result.current.rows[0]!.row).toMatchObject({ id: 1 })
    // StrictMode starts, aborts and restarts: at most a couple of identical first requests, not a flood
    expect(s.calls.length).toBeLessThanOrEqual(3)
    expect(new Set(s.calls.map((c) => c.start)).size).toBe(1)
  })
})
