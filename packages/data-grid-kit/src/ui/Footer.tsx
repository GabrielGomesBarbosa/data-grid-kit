import { useBase } from './base'
import { useIcons } from './icons'
import type { CSSProperties } from 'react'
import { countCells, formatNumber, type GridInstance, type RangeRect } from '../core'
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
  const { api, state, server, result, text, locale } = grid
  const { page, pageSize } = state.paginationModel
  const pageCount = Math.max(1, Math.ceil(result.rootCount / pageSize))
  const cells = rects.length > 0 ? countCells(rects) : 0
  const rowText = server
    ? server.rowCount >= 0
      ? text.footerRows(server.rowCount, false, formatNumber(server.rowCount, locale))
      : text.footerRows(server.loadedEnd, server.hasNextPage, formatNumber(server.loadedEnd, locale))
    : text.footerRows(result.filteredCount, false, String(result.filteredCount))
  return (
    <div className={cx('gk-footer', className)} style={style}>
      <span>
        {rowText}
        {server?.loading && ` · ${text.footerLoading}`}
        {state.selection.length > 0 && ` · ${text.footerSelected(state.selection.length)}`}
        {cells > 1 && ` · ${text.footerCellsSelected(cells, formatNumber(cells, locale))}`}
      </span>
      {paging && (
        <span className="gk-pager">
          <Button type="button" disabled={page <= 0} onClick={() => api.setPage(page - 1)} aria-label={text.paginationPrevious}>
            <icons.previousPage />
          </Button>
          <span>
            {page + 1} / {pageCount}
            {server && server.rowCount < 0 && server.hasNextPage ? '+' : ''}
          </span>
          <Button type="button" disabled={page >= pageCount - 1} onClick={() => api.setPage(page + 1)} aria-label={text.paginationNext}>
            <icons.nextPage />
          </Button>
        </span>
      )}
    </div>
  )
}
