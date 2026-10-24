import type { ApiContext } from './context'
import type { GridApi, ScrollAlign, ScrollHandler } from '../gridTypes'
import type { Store } from '../store'
import type { GridState } from '../types'

/** the scroller each grid's renderer registered: only it knows the element that scrolls */
const handlers = new WeakMap<Store<GridState>, ScrollHandler>()

/** Scroll to a row, a column or a cell, by id / field or by position; the renderer does the scrolling. */
export function scrollApi<R>(c: ApiContext<R>): Pick<GridApi<R>, 'scrollToIndexes' | 'scrollToRow' | 'scrollToColumn' | 'scrollToCell' | 'setScrollHandler'> {
  const { store, layoutRef, resultRef } = c
  const go = (rowIndex: number | undefined, colIndex: number | undefined, align: ScrollAlign) => {
    const handler = handlers.get(store)
    if (!handler || (rowIndex === undefined && colIndex === undefined)) return false
    handler({ rowIndex, colIndex, align })
    return true
  }
  const rowIndexOf = (id: string | number) => {
    const i = resultRef.current?.indexOf(id) ?? -1
    return i >= 0 ? i : undefined
  }
  const colIndexOf = (field: string) => {
    const i = layoutRef.current?.all.findIndex((col) => col.field === field) ?? -1
    return i >= 0 ? i : undefined
  }
  return {
    setScrollHandler(handler) {
      if (handler) handlers.set(store, handler)
      else handlers.delete(store)
    },
    scrollToIndexes({ rowIndex, colIndex, align = 'nearest' }) {
      return go(rowIndex, colIndex, align)
    },
    scrollToRow(id, align = 'nearest') {
      const rowIndex = rowIndexOf(id)
      return rowIndex !== undefined && go(rowIndex, undefined, align)
    },
    scrollToColumn(field, align = 'nearest') {
      const colIndex = colIndexOf(field)
      return colIndex !== undefined && go(undefined, colIndex, align)
    },
    scrollToCell(id, field, align = 'nearest') {
      const rowIndex = rowIndexOf(id)
      const colIndex = colIndexOf(field)
      return rowIndex !== undefined && colIndex !== undefined && go(rowIndex, colIndex, align)
    },
  }
}
