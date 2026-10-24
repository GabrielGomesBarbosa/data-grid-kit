import RowPinningDemo from '../demos/RowPinningDemo'
import rowPinningSrc from '../demos/RowPinningDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'row-pinning',
  group: 'Advanced features',
  title: 'Row pinning',
  intro: 'Keep important rows (a total, a selected customer, a watchlist) in view above or below the scrolling rows.',
  body: () => (
    <>
      {demo('RowPinningDemo', RowPinningDemo, rowPinningSrc)}
      <ul>
        <li>
          Pinned rows live outside the main list: they are not sorted, filtered or paginated, and they stay in <strong>pin order</strong>. They use
          native <code>position: sticky</code>, like pinned columns, and the virtualized rows scroll between them.
        </li>
        <li>
          Pin with <code>rowPinning</code> (hover buttons), <code>api.pinRow(id, 'top' | 'bottom' | null)</code> or{' '}
          <code>initialState.pinnedRows</code>.
        </li>
        <li>
          Flat grids only. With row grouping or tree data pins are ignored (and restored when you go back to a flat view). A pinned row that is
          removed from <code>rows</code> just disappears.
        </li>
        <li>CSV export lists pinned-top rows, the scrolling rows, then pinned-bottom rows: the order on screen.</li>
        <li>
          Not yet: keyboard focus and in-place editing inside pinned rows (use the API to edit them).
        </li>
      </ul>
    </>
  ),
}
