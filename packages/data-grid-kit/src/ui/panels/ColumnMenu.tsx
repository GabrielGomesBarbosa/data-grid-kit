import { useBase } from '../base'
import { type ReactNode } from 'react'
import { aggregationLabel, availableAggregations, neighborInGroup, type ColumnDef, type GridInstance } from '../../core'

/* ------------------------------------------------------------- column menu */

/** One item of the column menu, drawn like the built-in ones (use it in `itemsBefore` / `itemsAfter`). */
export function ColumnMenuItem({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  const { Button } = useBase()
  return (
    <Button type="button" role="menuitem" className="gk-menu-item" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  )
}

/** The groups of items of the column menu, for `hiddenItems`. */
export type ColumnMenuGroup = 'sort' | 'filter' | 'pin' | 'move' | 'aggregate' | 'hide'

/** What custom items of the column menu get to work with. */
export interface ColumnMenuContext<R> {
  field: string
  column: ColumnDef<R>
  grid: GridInstance<R>
  /** close the menu (after an item did its job) */
  close: () => void
}

export interface ColumnMenuProps<R> {
  grid: GridInstance<R>
  field: string
  onClose: () => void
  onFilter: (field: string) => void
  /** show the Aggregate choices */
  aggregation?: boolean
  /** leave these groups of items out */
  hiddenItems?: ColumnMenuGroup[]
  /** your own items, above the built-in ones / below them (use `ColumnMenuItem` so they look the same). The context says which column it is. */
  itemsBefore?: (context: ColumnMenuContext<R>) => ReactNode
  itemsAfter?: (context: ColumnMenuContext<R>) => ReactNode
}

export function ColumnMenu<R>({ grid, field, onClose, onFilter, aggregation = true, hiddenItems, itemsBefore, itemsAfter }: ColumnMenuProps<R>) {
  const { api, state, layout, options, text: t } = grid
  // the columns on screen, so the generated ones (pivot) have a menu too
  const col = layout.all.find((c) => c.field === field)
  if (!col) return null
  const sort = state.sortModel.find((s) => s.field === field)
  const side = layout.pinnedSide.get(field)
  const visibleCount = layout.all.length
  const aggChoices = availableAggregations(col, options.aggregationFunctions)
  const currentAgg = state.aggregationModel[field]
  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }
  const shown = (group: ColumnMenuGroup) => !hiddenItems?.includes(group)
  const context: ColumnMenuContext<R> = { field, column: col, grid, close: onClose }
  return (
    <>
      {itemsBefore?.(context)}
      {col.sortable !== false && shown('sort') && (
        <>
          <ColumnMenuItem disabled={sort?.direction === 'asc'} onClick={run(() => api.setSortModel([{ field, direction: 'asc' }]))}>
            {t.menuSortAsc}
          </ColumnMenuItem>
          <ColumnMenuItem disabled={sort?.direction === 'desc'} onClick={run(() => api.setSortModel([{ field, direction: 'desc' }]))}>
            {t.menuSortDesc}
          </ColumnMenuItem>
          {sort && (
            <ColumnMenuItem onClick={run(() => api.setSortModel(state.sortModel.filter((s) => s.field !== field)))}>{t.menuUnsort}</ColumnMenuItem>
          )}
          <hr className="gk-menu-sep" />
        </>
      )}
      {col.filterable !== false && shown('filter') && <ColumnMenuItem onClick={() => onFilter(field)}>{t.menuFilter}</ColumnMenuItem>}
      {col.pinnable !== false && shown('pin') && (
        <>
          <ColumnMenuItem disabled={side === 'left'} onClick={run(() => api.pinColumn(field, 'left'))}>
            {t.menuPinLeft}
          </ColumnMenuItem>
          <ColumnMenuItem disabled={side === 'right'} onClick={run(() => api.pinColumn(field, 'right'))}>
            {t.menuPinRight}
          </ColumnMenuItem>
          {side && <ColumnMenuItem onClick={run(() => api.pinColumn(field, null))}>{t.menuUnpin}</ColumnMenuItem>}
        </>
      )}
      {col.reorderable !== false && shown('move') && (
        <>
          <ColumnMenuItem disabled={!neighborInGroup(layout, field, -1)} onClick={run(() => api.moveColumnBy(field, -1))}>
            {t.menuMoveLeft}
          </ColumnMenuItem>
          <ColumnMenuItem disabled={!neighborInGroup(layout, field, 1)} onClick={run(() => api.moveColumnBy(field, 1))}>
            {t.menuMoveRight}
          </ColumnMenuItem>
        </>
      )}
      {aggregation && shown('aggregate') && aggChoices.length > 0 && (
        <>
          <hr className="gk-menu-sep" />
          <div className="gk-menu-heading" role="presentation">
            {t.menuAggregate}
          </div>
          <ColumnMenuItem onClick={run(() => api.setAggregation(field, null))}>
            {currentAgg ? '\u00a0\u00a0' : '✓ '}{t.menuAggregateNone}
          </ColumnMenuItem>
          {aggChoices.map((name) => (
            <ColumnMenuItem key={name} onClick={run(() => api.setAggregation(field, name))}>
              {currentAgg === name ? '✓ ' : '\u00a0\u00a0'}
              {aggregationLabel(name, options.aggregationFunctions, t)}
            </ColumnMenuItem>
          ))}
        </>
      )}
      {shown('hide') && (
        <>
          <hr className="gk-menu-sep" />
          <ColumnMenuItem disabled={visibleCount <= 1 || col.hideable === false} onClick={run(() => api.setColumnVisibility(field, false))}>
            {t.menuHide}
          </ColumnMenuItem>
        </>
      )}
      {itemsAfter?.(context)}
    </>
  )
}
