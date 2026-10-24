import RowReorderDemo from '../demos/RowReorderDemo'
import rowReorderSrc from '../demos/RowReorderDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'row-reordering',
  group: 'Advanced features',
  title: 'Row reordering',
  intro: 'Drag rows into a new order, with the keyboard as an equal alternative.',
  body: () => (
    <>
      {demo('RowReorderDemo', RowReorderDemo, rowReorderSrc)}
      <h2>Using it</h2>
      <ol>
        <li>Set <code>rowReordering</code>. Each row gets a grip (⋮⋮) in its first cell.</li>
        <li>
          Handle <code>onRowOrderChange(&#123; rowId, row, oldIndex, targetIndex &#125;)</code> by applying the same move to your own array:{' '}
          <code>setRows((r) =&gt; moveItem(r, oldIndex, targetIndex))</code>.
        </li>
      </ol>
      <p>
        The grid also moves the row itself right away, so it works even if you do nothing; when your new <code>rows</code> arrive in that same order, the
        grid recognises it and has nothing left to do (no rebuild). If you ignore the move, the next change to <code>rows</code> restores your order, as
        with any other edit.
      </p>
      <h2>Rules</h2>
      <ul>
        <li>
          Reordering is allowed only on a <strong>flat, unsorted</strong> grid with <strong>nothing being edited</strong>: with a sort the order is decided by
          the sort, and with grouping or tree data a position would be ambiguous. While it isn't allowed the grips are hidden.
        </li>
        <li>
          <strong>Filtering is fine.</strong> A move says "before this row" / "after this row", so you can drag among the rows you see; the indices in{' '}
          <code>onRowOrderChange</code> are positions in your full data, not in the filtered list. Pinned rows and the total row can't be dragged.
        </li>
        <li>
          It uses pointer events, so the same code handles mouse, pen and touch. A marker shows where the row will land (none when the drop would leave it
          where it is), the list scrolls when you drag near its edges, and <kbd>Esc</kbd> cancels.
        </li>
        <li>
          <strong>Keyboard:</strong> <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>↑</kbd> / <kbd>↓</kbd> moves the focused row one place; the move is announced
          ("Row moved to position 3 of 8") through a live region, and the focus follows the row.
        </li>
        <li>
          From code: <code>api.moveRow(id, &#123; before: otherId | null &#125;)</code> or <code>&#123; after: otherId &#125;</code> (returns false when it would change
          nothing), and <code>api.canMoveRow(...)</code> to ask first.
        </li>
      </ul>
      <p className="muted">
        Internally a move gives the row a position between its new neighbours (a fraction, renumbered when two neighbours run out of room), so moving one row
        never touches the others. Hundreds of moves between the same two rows are covered by a test.
      </p>
    </>
  ),
}
