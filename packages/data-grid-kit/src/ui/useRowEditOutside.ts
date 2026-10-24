import { useEffect, type RefObject } from 'react'
import type { GridApi, RowId } from '../core'

/**
 * A row being edited (`editMode: 'row'`) is saved by a click anywhere outside it. A click inside the row, in the row's own
 * editors, or on something the editors opened does not count. If saving is refused (`validate`) the row stays open.
 */
export function useRowEditOutside<R>(api: GridApi<R>, scrollerRef: RefObject<HTMLDivElement>, editingRow: RowId | null) {
  useEffect(() => {
    if (editingRow === null) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null
      const rowEl = scrollerRef.current?.querySelector('.gk-row [data-editing]')?.closest('.gk-row')
      if (!target || !rowEl || rowEl.contains(target) || target.closest('[role="listbox"], [role="menu"], [role="dialog"], .gk-popover')) return
      void api.commitRowEdit('blur')
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [api, scrollerRef, editingRow])
}
