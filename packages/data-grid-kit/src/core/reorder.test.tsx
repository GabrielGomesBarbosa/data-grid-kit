import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { computeColumnLayout } from './layout'
import { fullColumnOrder, moveItem, neighborInGroup, planColumnMove } from './reorder'
import { useGrid } from './useGrid'
import type { ColumnDef, GridState } from './types'

const columns: ColumnDef[] = ['a', 'b', 'c', 'd', 'e'].map((field) => ({ field }))
const state = (over: Partial<Pick<GridState, 'columnOrder' | 'pinnedColumns' | 'columnVisibility'>> = {}) => ({
  columnOrder: ['a', 'b', 'c', 'd', 'e'],
  columnWidths: {},
  columnVisibility: {},
  pinnedColumns: { left: [], right: [] },
  ...over,
})
const layoutOf = (s = state()) => computeColumnLayout(columns, s)

describe('column reordering (pure)', () => {
  it('moves before and after a target in the scrolling group', () => {
    const s = state()
    expect(planColumnMove(columns, s, layoutOf(s), 'a', 'c', 'before')?.columnOrder).toEqual(['b', 'a', 'c', 'd', 'e'])
    expect(planColumnMove(columns, s, layoutOf(s), 'a', 'c', 'after')?.columnOrder).toEqual(['b', 'c', 'a', 'd', 'e'])
    expect(planColumnMove(columns, s, layoutOf(s), 'e', 'a', 'before')?.columnOrder).toEqual(['e', 'a', 'b', 'c', 'd'])
  })

  it('returns null for no-ops: onto itself, or to where it already is', () => {
    const s = state()
    expect(planColumnMove(columns, s, layoutOf(s), 'b', 'b', 'before')).toBeNull()
    expect(planColumnMove(columns, s, layoutOf(s), 'b', 'c', 'before')).toBeNull() // b is already right before c
    expect(planColumnMove(columns, s, layoutOf(s), 'b', 'a', 'after')).toBeNull()
  })

  it('never crosses a pin boundary', () => {
    const s = state({ pinnedColumns: { left: ['a'], right: ['e'] } })
    const l = layoutOf(s)
    expect(planColumnMove(columns, s, l, 'c', 'a', 'after')).toBeNull() // into the left pinned group
    expect(planColumnMove(columns, s, l, 'a', 'c', 'before')).toBeNull() // out of it
    expect(planColumnMove(columns, s, l, 'c', 'e', 'before')).toBeNull()
  })

  it('reorders inside a pinned group by changing the pin order', () => {
    const s = state({ pinnedColumns: { left: ['a', 'b', 'c'], right: [] } })
    const l = layoutOf(s)
    expect(planColumnMove(columns, s, l, 'c', 'a', 'before')?.pinnedColumns).toEqual({ left: ['c', 'a', 'b'], right: [] })
    // the scrolling order is untouched
    expect(planColumnMove(columns, s, l, 'c', 'a', 'before')?.columnOrder).toBeUndefined()
  })

  it('places next to a visible neighbour even when hidden columns sit in between', () => {
    const s = state({ columnVisibility: { b: false, c: false } })
    const l = layoutOf(s)
    expect(l.center.map((c) => c.field)).toEqual(['a', 'd', 'e'])
    const out = planColumnMove(columns, s, l, 'e', 'd', 'before')!.columnOrder!
    expect(out.filter((f) => ['a', 'd', 'e'].includes(f))).toEqual(['a', 'e', 'd'])
  })

  it('completes a saved order with columns it does not know yet', () => {
    expect(fullColumnOrder(columns, ['c', 'a', 'gone'])).toEqual(['c', 'a', 'b', 'd', 'e'])
  })

  it('finds the neighbour inside the same group for move left / right', () => {
    const s = state({ pinnedColumns: { left: ['a', 'b'], right: [] } })
    const l = layoutOf(s)
    expect(neighborInGroup(l, 'c', -1)).toBeNull() // c is first of the scrolling group: a/b are pinned
    expect(neighborInGroup(l, 'c', 1)).toEqual({ target: 'd', placement: 'after' })
    expect(neighborInGroup(l, 'b', -1)).toEqual({ target: 'a', placement: 'before' })
    expect(neighborInGroup(l, 'b', 1)).toBeNull()
  })
})

describe('column reordering (hook)', () => {
  const rows = [{ id: 1, a: 1, b: 2, c: 3, d: 4, e: 5 }]
  it('reorderColumn / moveColumnBy update the layout', () => {
    const { result } = renderHook(() => useGrid({ rows, columns }))
    expect(result.current.layout.all.map((c) => c.field)).toEqual(['a', 'b', 'c', 'd', 'e'])
    act(() => void result.current.api.reorderColumn('e', 'a', 'before'))
    expect(result.current.layout.all.map((c) => c.field)).toEqual(['e', 'a', 'b', 'c', 'd'])
    let moved = false
    act(() => void (moved = result.current.api.moveColumnBy('a', 1)))
    expect(moved).toBe(true)
    expect(result.current.layout.all.map((c) => c.field)).toEqual(['e', 'b', 'a', 'c', 'd'])
    act(() => void (moved = result.current.api.moveColumnBy('e', -1)))
    expect(moved).toBe(false) // already first
  })
})

describe('moveItem', () => {
  it('moves an item so it ends up at the target index, without touching the input', () => {
    const list = ['a', 'b', 'c', 'd', 'e']
    expect(moveItem(list, 1, 3)).toEqual(['a', 'c', 'd', 'b', 'e'])
    expect(moveItem(list, 3, 0)).toEqual(['d', 'a', 'b', 'c', 'e'])
    expect(moveItem(list, 0, 4)).toEqual(['b', 'c', 'd', 'e', 'a'])
    expect(list).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('ignores moves that make no sense', () => {
    expect(moveItem(['a', 'b'], 0, 0)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], -1, 1)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })
  it('is what onRowOrderChange needs: applying it to the owner rows matches the grid', () => {
    const rows = ['a', 'b', 'c', 'd']
    // the grid reports moving "b" before "d": oldIndex 1, targetIndex 2
    expect(moveItem(rows, 1, 2)).toEqual(['a', 'c', 'b', 'd'])
  })
})
