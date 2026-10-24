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
  /** the page sizes to choose from in a "Rows per page" select (`-1`: all rows); none: no select */
  pageSizeOptions?: number[]
  /** the selected cell blocks, for the "n cells selected" summary */
  rects: RangeRect[]
  className?: string
  style?: CSSProperties
}

/** the page size that means "every row": no grid has this many */
export const ALL_ROWS = 1_000_000_000

export function Footer<R>({ grid, paging, pageSizeOptions, rects, className, style }: FooterProps<R>) {
  const { Button, Select } = useBase()
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
          {pageSizeOptions && pageSizeOptions.length > 0 && (
            <label className="gk-page-size">
              <span>{text.paginationRowsPerPage}</span>
              <Select
                value={pageSize >= ALL_ROWS ? -1 : pageSize}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  api.setPageSize(n === -1 ? ALL_ROWS : n)
                }}
              >
                {[...new Set([...pageSizeOptions, ...(pageSizeOptions.includes(pageSize) || pageSize >= ALL_ROWS ? [] : [pageSize])])]
                  .sort((a, b) => (a === -1 ? 1 : b === -1 ? -1 : a - b))
                  .map((n) => (
                    <option key={n} value={n}>
                      {n === -1 ? text.paginationAll : n}
                    </option>
                  ))}
              </Select>
            </label>
          )}
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
