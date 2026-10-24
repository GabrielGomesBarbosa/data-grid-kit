import { useEffect, type MutableRefObject } from 'react'
import type { AutosizeOptions, GridApi, GridInstance } from '../../core'

/** What fits the grid to its content by itself: `autosizeOnMount` for the columns, `autoPageSize` for the page. */
export function useFitting<R>(
  api: GridApi<R>,
  gridRef: MutableRefObject<GridInstance<R>>,
  autosizeRef: MutableRefObject<AutosizeOptions | undefined>,
  opts: { autosizeOnMount: boolean; autoPageSize: boolean; paginated: boolean; viewportHeight: number; density: string },
) {
  const { autosizeOnMount, autoPageSize, paginated, viewportHeight, density } = opts
  useEffect(() => {
    if (!autosizeOnMount) return
    // after the first rows are on screen: two frames later the viewport is known and the rows are drawn
    let frame = requestAnimationFrame(() => (frame = requestAnimationFrame(() => api.autosizeColumns(autosizeRef.current))))
    return () => cancelAnimationFrame(frame)
  }, [api, autosizeOnMount, autosizeRef])

  // a page as tall as the body shows: the rows that fit between the header and the footer
  const fitPage = autoPageSize && paginated
  useEffect(() => {
    if (!fitPage) return
    const g = gridRef.current
    const body = viewportHeight - g.headerHeight - g.rowHeight // the footer takes about a row
    const fit = Math.max(1, Math.floor(body / g.rowHeight))
    if (g.state.paginationModel.pageSize !== fit) api.setPageSize(fit)
  }, [fitPage, viewportHeight, density, api, gridRef])
}
