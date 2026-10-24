import type { ColumnLayout } from './layout'
import type { ColumnDef, GridState } from './types'

export type DropPlacement = 'before' | 'after'

type OrderState = Pick<GridState, 'columnOrder' | 'pinnedColumns'>

/** Saved order first, then any column the saved order doesn't know about (new columns). */
export function fullColumnOrder(columns: ColumnDef[], order: string[]): string[] {
  const known = new Set(columns.map((c) => c.field))
  const seen = new Set<string>()
  const out: string[] = []
  for (const f of [...order, ...columns.map((c) => c.field)]) {
    if (known.has(f) && !seen.has(f)) {
      seen.add(f)
      out.push(f)
    }
  }
  return out
}

/**
 * State change that moves `field` next to `target`. Columns only move inside their own group
 * (pinned left, scrolling, pinned right): pinning is a separate, explicit action. Returns null
 * when the move is not allowed or would change nothing.
 */
export function planColumnMove(
  columns: ColumnDef[],
  state: OrderState,
  layout: Pick<ColumnLayout, 'pinnedSide'>,
  field: string,
  target: string,
  placement: DropPlacement,
): Partial<OrderState> | null {
  if (field === target) return null
  const side = layout.pinnedSide.get(field)
  if (layout.pinnedSide.get(target) !== side) return null

  if (side) {
    const list = state.pinnedColumns[side].filter((f) => f !== field)
    const at = list.indexOf(target)
    if (at < 0) return null
    list.splice(placement === 'before' ? at : at + 1, 0, field)
    if (list.join() === state.pinnedColumns[side].join()) return null
    return { pinnedColumns: { ...state.pinnedColumns, [side]: list } }
  }

  const before = fullColumnOrder(columns, state.columnOrder)
  const order = before.filter((f) => f !== field)
  const at = order.indexOf(target)
  if (at < 0) return null
  order.splice(placement === 'before' ? at : at + 1, 0, field)
  if (order.join() === before.join()) return null
  return { columnOrder: order }
}

/** The column `delta` places away inside the same group, for keyboard-friendly "move left/right". */
export function neighborInGroup(
  layout: Pick<ColumnLayout, 'left' | 'center' | 'right' | 'pinnedSide'>,
  field: string,
  delta: -1 | 1,
): { target: string; placement: DropPlacement } | null {
  const side = layout.pinnedSide.get(field)
  const group = side === 'left' ? layout.left : side === 'right' ? layout.right : layout.center
  const i = group.findIndex((c) => c.field === field)
  const next = group[i + delta]
  if (i < 0 || !next) return null
  return { target: next.field, placement: delta < 0 ? 'before' : 'after' }
}

/**
 * A copy of `list` with the item at `from` moved so that it ends up at index `to`. Pass it the `oldIndex` and
 * `targetIndex` of `onRowOrderChange` to apply the same move to your own rows.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice()
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}
