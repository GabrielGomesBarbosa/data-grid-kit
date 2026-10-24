import { countCells, type GridInstance, type RangeRect } from '../core'

/** Row count, selection summary and the pager. */
export function Footer<R>({ grid, paging, rects }: { grid: GridInstance<R>; paging: boolean; rects: RangeRect[] }) {
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
    <div className="gk-footer">
      <span>
        {rowText}
        {server?.loading && ' · loading…'}
        {state.selection.length > 0 && ` · ${state.selection.length} selected`}
        {cells > 1 && ` · ${cells.toLocaleString()} cells selected`}
      </span>
      {paging && (
        <span className="gk-pager">
          <button type="button" disabled={page <= 0} onClick={() => api.setPage(page - 1)} aria-label="Previous page">
            ‹
          </button>
          <span>
            {page + 1} / {pageCount}
            {server && server.rowCount < 0 && server.hasNextPage ? '+' : ''}
          </span>
          <button type="button" disabled={page >= pageCount - 1} onClick={() => api.setPage(page + 1)} aria-label="Next page">
            ›
          </button>
        </span>
      )}
    </div>
  )
}
