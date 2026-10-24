import { useBase } from './base'
import { useIcons } from './icons'
import type { CSSProperties } from 'react'
import { countCells, type GridInstance, type RangeRect } from '../core'
import { cx } from './cx'

/** Row count, selection summary and the pager. */
export interface FooterProps<R> {
  grid: GridInstance<R>
  /** show the pager */
  paging: boolean
  /** the selected cell blocks, for the "n cells selected" summary */
  rects: RangeRect[]
  className?: string
  style?: CSSProperties
}

export function Footer<R>({ grid, paging, rects, className, style }: FooterProps<R>) {
  const { Button } = useBase()
  const icons = useIcons()
  const { api, state, server, result } = grid
  const { page, pageSize } = state.paginationModel
  const pageCount = Math.max(1, Math.ceil(result.rootCount / pageSize))
  const cells = rects.length > 0 ? countCells(rects) : 0
  const rowText = server
    ? server.rowCount >= 0
      ? `${server.rowCount.toLocaleString()} rows`
      : `${server.loadedEnd.toLocaleString()}${server.hasNextPage ? '+' : ''} rows`
    : `${result.filteredCount} rows`
  return (
    <div className={cx('gk-footer', className)} style={style}>
      <span>
        {rowText}
        {server?.loading && ' · loading…'}
        {state.selection.length > 0 && ` · ${state.selection.length} selected`}
        {cells > 1 && ` · ${cells.toLocaleString()} cells selected`}
      </span>
      {paging && (
        <span className="gk-pager">
          <Button type="button" disabled={page <= 0} onClick={() => api.setPage(page - 1)} aria-label="Previous page">
            <icons.previousPage />
          </Button>
          <span>
            {page + 1} / {pageCount}
            {server && server.rowCount < 0 && server.hasNextPage ? '+' : ''}
          </span>
          <Button type="button" disabled={page >= pageCount - 1} onClick={() => api.setPage(page + 1)} aria-label="Next page">
            <icons.nextPage />
          </Button>
        </span>
      )}
    </div>
  )
}
