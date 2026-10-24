import PaginationDemo from '../demos/PaginationDemo'
import paginationSrc from '../demos/PaginationDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'pagination',
  group: 'Main features',
  title: 'Pagination',
  intro: 'Pages count top-level rows, so a group or a tree branch is never split across pages.',
  body: () => (
    <>
      {demo('PaginationDemo', PaginationDemo, paginationSrc)}
      <ul>
        <li>
          <code>pageSizeOptions</code> adds a <strong>Rows per page</strong> select to the footer (<code>-1</code> shows every row on one page). Without it the
          footer has no select. The current page size is listed even when it is not in the options.
        </li>
        <li>
          <code>autoPageSize</code> fits the page to the height of the grid, again when the grid is resized or the density changes.
        </li>
      </ul>
    </>
  ),
}
