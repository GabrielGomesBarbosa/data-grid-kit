import { useBase } from '../base'
import { type ReactNode } from 'react'
import { aggregationLabel, availableAggregations, neighborInGroup, type GridInstance } from '../../core'

/* ------------------------------------------------------------- column menu */

function Item({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  const { Button } = useBase()
  return (
    <Button type="button" role="menuitem" className="gk-menu-item" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  )
}

export interface ColumnMenuProps<R> {
  grid: GridInstance<R>
  field: string
  onClose: () => void
  onFilter: (field: string) => void
  /** show the Aggregate choices */
  aggregation?: boolean
}

export function ColumnMenu<R>({ grid, field, onClose, onFilter, aggregation = true }: ColumnMenuProps<R>) {
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
  return (
    <>
      {col.sortable !== false && (
        <>
          <Item disabled={sort?.direction === 'asc'} onClick={run(() => api.setSortModel([{ field, direction: 'asc' }]))}>
            {t.menuSortAsc}
          </Item>
          <Item disabled={sort?.direction === 'desc'} onClick={run(() => api.setSortModel([{ field, direction: 'desc' }]))}>
            {t.menuSortDesc}
          </Item>
          {sort && (
            <Item onClick={run(() => api.setSortModel(state.sortModel.filter((s) => s.field !== field)))}>{t.menuUnsort}</Item>
          )}
          <hr className="gk-menu-sep" />
        </>
      )}
      {col.filterable !== false && <Item onClick={() => onFilter(field)}>{t.menuFilter}</Item>}
      {col.pinnable !== false && (
        <>
          <Item disabled={side === 'left'} onClick={run(() => api.pinColumn(field, 'left'))}>
            {t.menuPinLeft}
          </Item>
          <Item disabled={side === 'right'} onClick={run(() => api.pinColumn(field, 'right'))}>
            {t.menuPinRight}
          </Item>
          {side && <Item onClick={run(() => api.pinColumn(field, null))}>{t.menuUnpin}</Item>}
        </>
      )}
      {col.reorderable !== false && (
        <>
          <Item disabled={!neighborInGroup(layout, field, -1)} onClick={run(() => api.moveColumnBy(field, -1))}>
            {t.menuMoveLeft}
          </Item>
          <Item disabled={!neighborInGroup(layout, field, 1)} onClick={run(() => api.moveColumnBy(field, 1))}>
            {t.menuMoveRight}
          </Item>
        </>
      )}
      {aggregation && aggChoices.length > 0 && (
        <>
          <hr className="gk-menu-sep" />
          <div className="gk-menu-heading" role="presentation">
            {t.menuAggregate}
          </div>
          <Item onClick={run(() => api.setAggregation(field, null))}>
            {currentAgg ? '\u00a0\u00a0' : '✓ '}{t.menuAggregateNone}
          </Item>
          {aggChoices.map((name) => (
            <Item key={name} onClick={run(() => api.setAggregation(field, name))}>
              {currentAgg === name ? '✓ ' : '\u00a0\u00a0'}
              {aggregationLabel(name, options.aggregationFunctions, t)}
            </Item>
          ))}
        </>
      )}
      <hr className="gk-menu-sep" />
      <Item disabled={visibleCount <= 1} onClick={run(() => api.setColumnVisibility(field, false))}>
        {t.menuHide}
      </Item>
    </>
  )
}
