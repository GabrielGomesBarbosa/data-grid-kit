import ColumnReorderDemo from '../demos/ColumnReorderDemo'
import reorderSrc from '../demos/ColumnReorderDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'column-reorder',
  group: 'Advanced features',
  title: 'Column reordering',
  intro: 'Drag a header to move a column; use the menu when dragging is not an option.',
  body: () => (
    <>
      {demo('ColumnReorderDemo', ColumnReorderDemo, reorderSrc)}
      <ul>
        <li>
          A marker shows where the column will land and the grid scrolls when you drag near its edges. <kbd>Escape</kbd> cancels the drag.
        </li>
        <li>
          Columns move <strong>inside their group</strong> (pinned left, scrolling, pinned right). Pinning stays an explicit action, so a drag never
          changes what is pinned. Inside a pinned group, the pin order is what changes.
        </li>
        <li>
          <strong>Move left / Move right</strong> in the ⋮ menu do the same without a pointer, and are disabled at the edge of a group. From code:{' '}
          <code>api.reorderColumn(field, target, 'before' | 'after')</code> or <code>api.moveColumnBy(field, -1 | 1)</code>.
        </li>
        <li>
          Turn it off for the grid (<code>columnReorder={'{false}'}</code>) or for one column (<code>reorderable: false</code>).
        </li>
        <li>The sort click that ends a drag is swallowed, so dropping a header never re-sorts the column.</li>
      </ul>
      <p className="muted">Touch screens scroll instead of dragging headers, so use the menu there.</p>
    </>
  ),
}
