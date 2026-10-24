import { useBase } from './base'
import { useIcons } from './icons'
import { type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { defaultAlign, type GridInstance } from '../core'
import { cx } from './cx'
import { type UIColumnDef } from './types'

/* ------------------------------------------------------------------ header */

export interface HeaderCellProps<R> {
  col: UIColumnDef<R>
  style: CSSProperties
  colIndex: number
  grid: GridInstance<R>
  controls: boolean
  onOpenMenu: (field: string, anchor: DOMRect) => void
  /** undefined when reordering is off for this column */
  onDragIntent: ((field: string, e: ReactPointerEvent<HTMLElement>) => void) | undefined
  suppressClick: () => boolean
  /** added to the cell's class names (`slotProps.headerCell`) */
  className?: string
}

export function HeaderCell<R>({
  col,
  style,
  colIndex,
  grid,
  controls,
  onOpenMenu,
  onDragIntent,
  suppressClick,
  className,
}: HeaderCellProps<R>) {
  const { Button } = useBase()
  const icons = useIcons()
  const { api, state, layout, text: t } = grid
  const sort = state.sortModel.find((s) => s.field === col.field)
  const side = layout.pinnedSide.get(col.field)
  const sortable = col.sortable !== false

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = layout.width(col.field)
    const dir = side === 'right' ? -1 : 1 // right-pinned columns grow leftwards
    const move = (ev: PointerEvent) => api.setColumnWidth(col.field, startW + dir * (ev.clientX - startX))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      role="columnheader"
      aria-colindex={colIndex + 1}
      aria-sort={sort ? (sort.direction === 'asc' ? 'ascending' : 'descending') : sortable ? 'none' : undefined}
      className={cx('gk-header-cell', className)}
      data-align={defaultAlign(col)}
      data-field={col.field}
      data-sort={sort?.direction}
      data-pinned={side}
      style={style}
      onPointerDown={(e) => {
        if (!onDragIntent || e.button !== 0) return
        if ((e.target as Element).closest('.gk-resizer, .gk-menu-btn')) return
        onDragIntent(col.field, e)
      }}
    >
      <Button
        type="button"
        className="gk-header-title"
        disabled={!sortable}
        onClick={(e) => {
          if (suppressClick()) return // this click is the end of a column drag
          api.toggleSort(col.field, e.shiftKey)
        }}
      >
        <span className="gk-header-label">{col.headerName ?? col.field}</span>
        {sort && <span className="gk-sort">{sort.direction === 'asc' ? <icons.sortAsc /> : <icons.sortDesc />}</span>}
      </Button>
      {side && (
        <span className="gk-pin-mark" title={t.columnPinned(side)} aria-hidden="true">
          {side === 'left' ? <icons.pinLeft /> : <icons.pinRight />}
        </span>
      )}
      {controls && (
        <Button
          type="button"
          className="gk-menu-btn"
          data-gk-anchor
          aria-haspopup="menu"
          aria-label={t.columnMenuOf(col.headerName ?? col.field)}
          onClick={(e) => onOpenMenu(col.field, e.currentTarget.getBoundingClientRect())}
        >
          <icons.columnMenu />
        </Button>
      )}
      {col.resizable !== false && (
        <div
          className="gk-resizer"
          role="separator"
          aria-orientation="vertical"
          data-side={side === 'right' ? 'left' : 'right'}
          onPointerDown={startResize}
        />
      )}
    </div>
  )
}
