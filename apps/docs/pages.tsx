import type { ComponentType, ReactNode } from 'react'
import { CodeBlock } from './components/CodeBlock'
import { Demo } from './components/Demo'
import { PropsTable } from './components/PropsTable'
import { apiMethods, columnProps, features, gridProps, shortcuts } from './api'

import QuickstartDemo from './demos/QuickstartDemo'
import ColumnsDemo from './demos/ColumnsDemo'
import SortingDemo from './demos/SortingDemo'
import FilteringDemo from './demos/FilteringDemo'
import PaginationDemo from './demos/PaginationDemo'
import SelectionDemo from './demos/SelectionDemo'
import EditingDemo from './demos/EditingDemo'
import ExportDemo from './demos/ExportDemo'
import VirtualizationDemo from './demos/VirtualizationDemo'
import PinningDemo from './demos/PinningDemo'
import TreeDemo from './demos/TreeDemo'
import GroupingDemo from './demos/GroupingDemo'
import HeadlessDemo from './demos/HeadlessDemo'
import BenchmarkDemo from './demos/BenchmarkDemo'
import LiveUpdatesDemo from './demos/LiveUpdatesDemo'
import ColumnReorderDemo from './demos/ColumnReorderDemo'
import RowPinningDemo from './demos/RowPinningDemo'
import AggregationDemo from './demos/AggregationDemo'
import CellSelectionDemo from './demos/CellSelectionDemo'
import ClipboardDemo from './demos/ClipboardDemo'
import DetailPanelDemo from './demos/DetailPanelDemo'
import RowReorderDemo from './demos/RowReorderDemo'
import ExcelExportDemo from './demos/ExcelExportDemo'
import PivotDemo from './demos/PivotDemo'
import ServerPagesDemo from './demos/ServerPagesDemo'
import ServerScrollDemo from './demos/ServerScrollDemo'

import quickstartSrc from './demos/QuickstartDemo.tsx?raw'
import columnsSrc from './demos/ColumnsDemo.tsx?raw'
import sortingSrc from './demos/SortingDemo.tsx?raw'
import filteringSrc from './demos/FilteringDemo.tsx?raw'
import paginationSrc from './demos/PaginationDemo.tsx?raw'
import selectionSrc from './demos/SelectionDemo.tsx?raw'
import editingSrc from './demos/EditingDemo.tsx?raw'
import exportSrc from './demos/ExportDemo.tsx?raw'
import virtualizationSrc from './demos/VirtualizationDemo.tsx?raw'
import pinningSrc from './demos/PinningDemo.tsx?raw'
import treeSrc from './demos/TreeDemo.tsx?raw'
import groupingSrc from './demos/GroupingDemo.tsx?raw'
import headlessSrc from './demos/HeadlessDemo.tsx?raw'
import benchmarkSrc from './demos/BenchmarkDemo.tsx?raw'
import liveSrc from './demos/LiveUpdatesDemo.tsx?raw'
import reorderSrc from './demos/ColumnReorderDemo.tsx?raw'
import rowPinningSrc from './demos/RowPinningDemo.tsx?raw'
import aggregationSrc from './demos/AggregationDemo.tsx?raw'
import cellSelectionSrc from './demos/CellSelectionDemo.tsx?raw'
import clipboardSrc from './demos/ClipboardDemo.tsx?raw'
import detailSrc from './demos/DetailPanelDemo.tsx?raw'
import rowReorderSrc from './demos/RowReorderDemo.tsx?raw'
import excelSrc from './demos/ExcelExportDemo.tsx?raw'
import pivotSrc from './demos/PivotDemo.tsx?raw'
import serverPagesSrc from './demos/ServerPagesDemo.tsx?raw'
import serverScrollSrc from './demos/ServerScrollDemo.tsx?raw'

export interface PageDef {
  id: string
  group: 'Getting started' | 'Main features' | 'Advanced features' | 'Guides' | 'Reference'
  title: string
  intro: string
  body: () => ReactNode
}

const demo = (name: string, Component: ComponentType, source: string) => (
  <Demo name={name} Component={Component} source={source} />
)

const Status = ({ s }: { s: 'done' | 'planned' }) => (
  <span className={`pill ${s}`}>{s === 'done' ? 'Available' : 'Planned'}</span>
)

export const pages: PageDef[] = [
  {
    id: 'overview',
    group: 'Getting started',
    title: 'Overview',
    intro: 'data-grid-kit is a React data grid built headless-first: a store and a row pipeline with no UI, and a ready-made grid on top of it.',
    body: () => (
      <>
        <h2>What you get</h2>
        <ul>
          <li>
            <strong>Headless core</strong> (<code>data-grid-kit/core</code>): state store, memoised row pipeline (filter → group/tree → sort →
            paginate), column layout and virtualization math, keyboard navigation, editing and CSV, all usable without any UI.
          </li>
          <li>
            <strong>A grid component</strong> (<code>data-grid-kit</code>) built on that core: virtualized rows and columns, pinning, tree data,
            row grouping, editing, keyboard navigation, column menu, filter and column panels, CSV export.
          </li>
          <li>
            <strong>No UI-library dependency.</strong> Styling is plain CSS with variables; light and dark follow the system theme.
          </li>
        </ul>
        <h2>Install</h2>
        <p>
          data-grid-kit is not published to npm yet. Until it is, build it from the repository and install the tarball (or use a workspace link):
        </p>
        <CodeBlock title="shell" code={`git clone https://github.com/GabrielGomesBarbosa/data-grid-kit && cd data-grid-kit\nnpm install && npm run build\ncd packages/data-grid-kit && npm pack   # creates data-grid-kit-0.1.0.tgz\nnpm install ../path/to/data-grid-kit-0.1.0.tgz   # in your app`} />
        <CodeBlock
          title="tsx"
          code={`import { Grid } from 'data-grid-kit'\nimport 'data-grid-kit/styles.css'`}
        />
        <p>
          Peer dependency: React 18 or newer. See the <a href="#/features">feature status</a> for exactly what exists today, and{' '}
          <a href="#/performance">Performance</a> for measured numbers.
        </p>
      </>
    ),
  },
  {
    id: 'quickstart',
    group: 'Getting started',
    title: 'Quickstart',
    intro: 'A grid needs rows, columns and a height.',
    body: () => (
      <>
        {demo('QuickstartDemo', QuickstartDemo, quickstartSrc)}
        <h2>Things to know</h2>
        <ul>
          <li>
            Define <code>columns</code> outside the component (or memoize them). A new array on every render rebuilds the layout and the
            row pipeline.
          </li>
          <li>
            Rows need a unique, stable id: an <code>id</code> field, or pass <code>getRowId</code>.
          </li>
          <li>
            The grid scrolls inside its own <code>height</code>. Rows have a fixed height, which is what keeps virtualization O(1).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'features',
    group: 'Getting started',
    title: 'Feature status',
    intro: 'An honest board of what ships today and what is still ahead.',
    body: () => (
      <>
        <p>
          The <em>Edition</em> column shows where MUI X places the equivalent feature (Community = free, Pro/Premium = commercial). It is a
          reference for comparison only: every data-grid-kit feature ships under the same license.
        </p>
        <div className="table-wrap">
          <table className="props">
            <thead>
              <tr>
                <th>Feature</th>
                <th>MUI X edition</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.name}>
                  <td>{f.name}</td>
                  <td>{f.edition}</td>
                  <td>
                    <Status s={f.status} />
                  </td>
                  <td className="muted">{f.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: 'columns',
    group: 'Main features',
    title: 'Columns',
    intro: 'Typed columns, computed values, custom rendering and per-column switches.',
    body: () => (
      <>
        {demo('ColumnsDemo', ColumnsDemo, columnsSrc)}
        <p>
          Open the toolbar's <strong>Columns</strong> panel to show the hidden ID column, or drag a header edge to resize.
        </p>
        <h2>Column definition</h2>
        <PropsTable rows={columnProps} />
      </>
    ),
  },
  {
    id: 'sorting',
    group: 'Main features',
    title: 'Sorting',
    intro: 'Multi-column sorting with a single pass of key extraction.',
    body: () => (
      <>
        {demo('SortingDemo', SortingDemo, sortingSrc)}
        <h2>How it works</h2>
        <p>
          Sort keys are read once per row and, for text columns, replaced by their rank among the distinct values, so sorting compares
          integers instead of calling <code>localeCompare</code> millions of times. Sorting 100,000 rows by two text columns takes tens of
          milliseconds (see <a href="#/performance">Performance</a>). Empty values always stay last, in both directions. With row grouping
          or tree data, only siblings are sorted.
        </p>
      </>
    ),
  },
  {
    id: 'filtering',
    group: 'Main features',
    title: 'Filtering',
    intro: 'Typed operators, and/or logic, a filter panel and a quick filter.',
    body: () => (
      <>
        {demo('FilteringDemo', FilteringDemo, filteringSrc)}
        <h2>Operators by column type</h2>
        <div className="table-wrap">
          <table className="props">
            <tbody>
              <tr><td>string</td><td>contains, equals, starts with, ends with, is empty, is not empty</td></tr>
              <tr><td>number, date</td><td>=, &gt;, ≥, &lt;, ≤, is empty, is not empty (values are parsed as numbers / local dates)</td></tr>
              <tr><td>boolean, singleSelect</td><td>is</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          A filter whose value can't be parsed (for example text in a number filter) is ignored rather than hiding every row. In tree data
          a row stays visible when it or any descendant matches; with grouping, groups with no matching rows disappear and their counts
          reflect the filter.
        </p>
        <CodeBlock
          title="controlled filter model"
          code={`<Grid\n  state={{ filterModel }}\n  onStateChange={(next, prev) => {\n    if (next.filterModel !== prev.filterModel) setFilterModel(next.filterModel)\n  }}\n/>`}
        />
      </>
    ),
  },
  {
    id: 'pagination',
    group: 'Main features',
    title: 'Pagination',
    intro: 'Pages count top-level rows, so a group or a tree branch is never split across pages.',
    body: () => <>{demo('PaginationDemo', PaginationDemo, paginationSrc)}</>,
  },
  {
    id: 'selection',
    group: 'Main features',
    title: 'Row selection',
    intro: 'Checkbox selection with tri-state group rows.',
    body: () => (
      <>
        {demo('SelectionDemo', SelectionDemo, selectionSrc)}
        <p>
          Selecting a group (or a tree parent) selects its <em>visible</em> descendants, so filtered-out rows are never selected by
          accident. The group checkbox shows an indeterminate state when only some descendants are selected. Press Space on the focused
          row to toggle it.
        </p>
      </>
    ),
  },
  {
    id: 'editing',
    group: 'Main features',
    title: 'Editing',
    intro: 'In-cell editing with typed editors, async validation and custom editors.',
    body: () => (
      <>
        {demo('EditingDemo', EditingDemo, editingSrc)}
        <h2>How edits flow</h2>
        <ol>
          <li>A cell becomes editable with <code>editable: true</code> on its column (and <code>isCellEditable</code> if you want per-row rules).</li>
          <li>Committing builds the new row with <code>valueSetter</code> (default: spread + assign) and calls <code>processRowUpdate(next, prev)</code>.</li>
          <li>What it returns is what the grid keeps. Throwing or rejecting leaves the editor open and calls <code>onProcessRowUpdateError</code>.</li>
          <li>Edited rows go back through filtering, sorting and grouping. Replacing the <code>rows</code> prop discards in-grid edits, so your data wins.</li>
        </ol>
        <CodeBlock
          title="custom editor"
          code={`{\n  field: 'status',\n  editable: true,\n  renderEditCell: ({ value, commit, cancel }) => (\n    <select autoFocus defaultValue={String(value)}\n      onChange={(e) => commit(e.target.value)}\n      onBlur={cancel}>\n      <option>open</option>\n      <option>closed</option>\n    </select>\n  ),\n}`}
        />
      </>
    ),
  },
  {
    id: 'keyboard',
    group: 'Main features',
    title: 'Keyboard & accessibility',
    intro: 'Full cell navigation with the WAI-ARIA grid pattern.',
    body: () => (
      <>
        <p>
          Focus lives on the grid element and points at the active cell with <code>aria-activedescendant</code>, so it survives
          virtualization (a cell scrolled out of the DOM doesn't drop the focus). Rows, headers and cells carry <code>row</code>,{' '}
          <code>columnheader</code> and <code>gridcell</code> roles, plus <code>aria-rowcount</code>/<code>aria-colcount</code> for the full
          size even though only the visible window is rendered.
        </p>
        <div className="table-wrap">
          <table className="props">
            <thead>
              <tr><th>Keys</th><th>Action</th></tr>
            </thead>
            <tbody>
              {shortcuts.map(([k, a]) => (
                <tr key={k}><td><kbd>{k}</kbd></td><td>{a}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Try it in the <a href="#/editing">editing demo</a>. Note: structure and roles follow the ARIA pattern, but screen-reader testing
          is still pending.
        </p>
      </>
    ),
  },
  {
    id: 'export',
    group: 'Main features',
    title: 'CSV export',
    intro: 'Exports what the user sees: filtered, sorted, in the visible column order, across all pages.',
    body: () => (
      <>
        {demo('ExportDemo', ExportDemo, exportSrc)}
        <h2>Safe by default</h2>
        <ul>
          <li>Values containing the delimiter, quotes or line breaks are quoted; quotes are doubled.</li>
          <li>
            Text cells starting with <code>=</code>, <code>+</code>, <code>-</code> or <code>@</code> get a leading apostrophe so
            spreadsheets don't execute them as formulas (CSV injection). Numbers are never altered. Turn it off with{' '}
            <code>escapeFormulas: false</code>.
          </li>
          <li>A UTF-8 byte-order mark is added so Excel reads accents correctly (<code>bom: false</code> to omit).</li>
        </ul>
      </>
    ),
  },
  {
    id: 'virtualization',
    group: 'Advanced features',
    title: 'Virtualization',
    intro: 'Only the visible window of rows and columns exists in the DOM.',
    body: () => (
      <>
        {demo('VirtualizationDemo', VirtualizationDemo, virtualizationSrc)}
        <h2>How it works</h2>
        <ul>
          <li>Rows have a fixed height, so the row window is plain arithmetic: O(1).</li>
          <li>Columns use prefix sums of the widths and a binary search for the window: O(log n).</li>
          <li>
            Scroll events are batched to one store write per frame, and the grid re-renders only when the visible window changes, not on
            every scrolled pixel.
          </li>
          <li>Rows are memoized; moving focus or editing re-renders only the affected row.</li>
        </ul>
        <h2>Dragging the scrollbar very fast</h2>
        <p>
          Browsers scroll on a separate (compositor) thread, so they can paint a new scroll position <em>before</em> any JavaScript has seen it. If you
          drag the scrollbar thumb quickly through a very long list, the rows for the place you jumped to don't exist yet for a frame or two, and
          this is true of every DOM-virtualised grid (the MUI docs describe the same effect). We can't remove the gap, so we make it harmless: the
          scrolling area has striped placeholder rows behind the real ones, real rows cover them as soon as they render, and the grid keeps a
          buffer of 8 rows (<code>rowBufferPx</code>) on each side. Stopping the drag always shows the rows; nothing is left blank.
        </p>
        <p className="muted">
          Browsers cap an element's height (about 33 million px). At 36 px per row that is roughly 900,000 rows; beyond that a
          scroll-scaling strategy would be needed (not implemented).
        </p>
      </>
    ),
  },
  {
    id: 'pinning',
    group: 'Advanced features',
    title: 'Column pinning',
    intro: 'Pin columns to the left or right edge; the rest scrolls between them.',
    body: () => (
      <>
        {demo('PinningDemo', PinningDemo, pinningSrc)}
        <p>
          Pinned columns use native <code>position: sticky</code>, so the browser keeps them in place during scrolling with no JavaScript
          synchronisation. Pin from code with <code>initialState.pinnedColumns</code>, <code>api.pinColumn(field, side)</code>, or at
          runtime from the ⋮ column menu. Keyboard navigation accounts for pinned columns when scrolling a cell into view.
        </p>
      </>
    ),
  },
  {
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
  },
  {
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
  },
  {
    id: 'live-updates',
    group: 'Advanced features',
    title: 'Live updates',
    intro: 'Insert, edit and remove rows without rebuilding the grid: only the nodes on the changed rows\' paths are touched.',
    body: () => (
      <>
        {demo('LiveUpdatesDemo', LiveUpdatesDemo, liveSrc)}
        <h2>Two ways in</h2>
        <ul>
          <li>
            <code>api.updateRows({'{ insert, update, remove }'})</code>: imperative, for feeds (websockets, polling). <code>insert</code> and{' '}
            <code>update</code> are both upserts. <code>rows</code> can stay the same array.
          </li>
          <li>
            A <strong>new <code>rows</code> array</strong> (the React way): it is compared with the current rows and, when the change is small,
            applied incrementally. Row objects you didn't touch must keep their identity (keep using immutable updates).
          </li>
        </ul>
        <h2>What counts as small</h2>
        <p>
          Updates anywhere, removals anywhere and new rows appended at the end, up to about 1.5% of the rows (at least 64). A reorder is handled as
          remove + append while it stays under the same limit. Anything bigger, or a changed <code>columns</code> / grouping / tree on-off, rebuilds
          the hierarchy, which is still correct, just slower. <code>rows</code> from the owner always replaces edits made with{' '}
          <code>updateRows</code> or in-cell editing.
        </p>
        <h2>How it stays fast</h2>
        <ul>
          <li>The hierarchy is persistent. Each node stores whether its row passes the filter and how many rows pass below it, so a change adjusts the counts of its ancestors only (O(depth)).</li>
          <li>Every parent keeps its visible children in sorted order. A changed row is removed and re-inserted by <em>binary search</em>; if none of its sort keys changed, nothing moves and the update is O(1).</li>
          <li>Groups and tree folders appear and disappear on their own as their first / last row comes and goes.</li>
        </ul>
        <h2>Ordering guarantees</h2>
        <p>
          With a sort model, the result is identical to a fresh build: the repository has a randomized test that applies thousands of random
          inserts, edits, removals, group moves, reorders and filter / sort changes in flat, grouped and tree modes and compares every step with
          a from-scratch rebuild. Without a sort model, rows keep the order they were created in, and new rows and groups go to the end.
        </p>
      </>
    ),
  },
  {
    id: 'aggregation',
    group: 'Advanced features',
    title: 'Aggregation',
    intro: 'Sum, average, min, max and counts, on group rows and in a total row, following the filter.',
    body: () => (
      <>
        {demo('AggregationDemo', AggregationDemo, aggregationSrc)}
        <h2>Choosing functions</h2>
        <p>
          Pass <code>initialState.aggregationModel</code> (<code>{'{ salary: \'sum\' }'}</code>), call{' '}
          <code>api.setAggregation(field, name | null)</code>, or use <strong>Aggregate</strong> in a column's ⋮ menu. Which functions a column offers
          depends on its type (and on <code>aggregable</code> / <code>availableAggregationFunctions</code>).
        </p>
        <div className="table-wrap">
          <table className="props">
            <thead>
              <tr><th>Function</th><th>Result</th><th>Columns</th></tr>
            </thead>
            <tbody>
              <tr><td><code>sum</code></td><td>sum of the numbers; <code>null</code> if there are none</td><td>number</td></tr>
              <tr><td><code>avg</code></td><td>sum ÷ how many numbers</td><td>number</td></tr>
              <tr><td><code>min</code>, <code>max</code></td><td>smallest / largest value (numbers, dates, text)</td><td>number, date</td></tr>
              <tr><td><code>count</code></td><td>how many non-empty values</td><td>any</td></tr>
              <tr><td><code>size</code></td><td>how many rows</td><td>any</td></tr>
              <tr><td>your own</td><td><code>apply({'{ values, rows }'})</code> over every value in the group</td><td>as you declare</td></tr>
            </tbody>
          </table>
        </div>
        <h2>Where it shows</h2>
        <ul>
          <li><strong>Group rows</strong> show the aggregate of everything below them, in the columns that have a function. Tree parents show the aggregate of their <em>descendants</em> (not their own row).</li>
          <li>
            A <strong>total row</strong> sits at the bottom, over every row that passes the filter (<code>aggregationFooter={'{false}'}</code> hides it). It is sticky,
            like pinned rows.
          </li>
          <li>Only rows that pass the filter count. Filtering changes the aggregates and the counts together.</li>
          <li>The value goes through the column's <code>valueFormatter</code> (called without a row, so keep it a function of the value); counts show as plain numbers.</li>
        </ul>
        <h2>Cost</h2>
        <p>
          Built-in functions keep running totals on every group, so a changed row adjusts its ancestors in O(depth) (see <a href="#/live-updates">Live updates</a>):
          editing a salary in a 100,000-row grouped grid with sum and average costs about the same with aggregation on or off (0.24 ms vs 0.23 ms).
          Only <code>min</code> / <code>max</code> sometimes recompute a group, when the row that was the extreme leaves it. Custom functions
          read every value in the group each time the data changes, so they cost O(group size) per visible group.
        </p>
        <p className="muted">
          Floating-point sums are maintained by adding and subtracting, so after many live edits they can differ from a fresh sum in the last digits.
        </p>
      </>
    ),
  },
  {
    id: 'cell-selection',
    group: 'Advanced features',
    title: 'Cell selection',
    intro: 'Select blocks of cells like in a spreadsheet.',
    body: () => (
      <>
        {demo('CellSelectionDemo', CellSelectionDemo, cellSelectionSrc)}
        <p>Turn it on with <code>cellSelection</code>. It is separate from row selection (checkboxes): the two can be used together.</p>
        <ul>
          <li><strong>Mouse:</strong> drag across cells; Shift+click extends; Ctrl/Cmd+click starts another block. Dragging near an edge scrolls.</li>
          <li><strong>Keyboard:</strong> Shift+arrows / Home / End / PageUp / PageDown extend from the cursor; moving without Shift collapses the selection; Ctrl/Cmd+A selects all; Esc clears it.</li>
          <li>
            A block is anchored to <em>row ids and fields</em>, not positions: sort or reorder columns and it follows its cells. If one of its corners is filtered
            out, collapsed away or hidden, the block stops being drawn (and is ignored by copy / paste) until it is back.
          </li>
          <li>From code: <code>api.selectCells({'{ anchor, focus }'}, {'{ add }'})</code>, <code>extendCellSelection</code>, <code>clearCellSelection</code>, <code>getCellRects()</code> (index rectangles over the current rows and columns).</li>
        </ul>
      </>
    ),
  },
  {
    id: 'clipboard',
    group: 'Advanced features',
    title: 'Clipboard & fill',
    intro: 'Copy, cut and paste with spreadsheets, delete a block, and drag a corner to fill.',
    body: () => (
      <>
        {demo('ClipboardDemo', ClipboardDemo, clipboardSrc)}
        <h2>Copy and cut</h2>
        <ul>
          <li>
            Ctrl/Cmd+C copies the <strong>last</strong> selected block as tab-separated text (cells with tabs, line breaks or quotes are quoted), which pastes
            correctly into Excel, Sheets and Numbers. With no block it copies the checked rows, then the focused cell. Group rows inside a block are skipped.
          </li>
          <li>It copies <em>raw</em> values (a number as <code>1200.5</code>, a date as <code>2024-03-01</code>), not what a formatter shows, so what you paste back parses.</li>
          <li>Ctrl/Cmd+X copies and then clears the editable cells; <kbd>Delete</kbd> / <kbd>Backspace</kbd> clear without copying. Text columns become empty, others become <code>null</code>.</li>
        </ul>
        <h2>Paste</h2>
        <ul>
          <li>The text lands at the top-left of the selection (or at the focused cell). One value pasted over a bigger selection fills all of it.</li>
          <li>Each cell is parsed by its column: numbers, <code>yyyy-mm-dd</code> dates, booleans (<code>true/false/yes/no/1/0</code>), and select options by value or label. Add <code>valueParser</code> to a column for anything else.</li>
          <li>Cells that aren't editable, or whose text doesn't fit the column, are skipped. <code>api.pasteText(text)</code> returns <code>{'{ applied, skipped, rejected }'}</code>.</li>
          <li>
            Writes go through <code>valueSetter</code> and <strong>one <code>processRowUpdate</code> call per row</strong>. If it refuses a row, only that row is
            rejected (and <code>onProcessRowUpdateError</code> is called). Nothing waits on a slow row: they run in parallel.
          </li>
        </ul>
        <h2>Fill handle</h2>
        <p>
          The small square at the corner of the selection repeats the block over the cells you drag across, one direction at a time (whichever you moved
          further). A one-cell source copies its value; a block repeats as a pattern. A dashed preview shows what will change; read-only cells are skipped.
          Turn it off with <code>fillHandle={'{false}'}</code>. From code: <code>api.fillCells(source, {'{ row, col }'})</code>.
        </p>
        <p className="muted">Paste uses the browser's paste event, so the grid must have focus (click a cell first). Reading the clipboard without a user gesture isn't possible in browsers, which is why the demo has a text box.</p>
      </>
    ),
  },
  {
    id: 'detail-panel',
    group: 'Advanced features',
    title: 'Detail panel',
    intro: 'Open content under a row: order lines, a form, a nested table, a chart.',
    body: () => (
      <>
        {demo('DetailPanelDemo', DetailPanelDemo, detailSrc)}
        <h2>Turning it on</h2>
        <p>
          Give the grid <code>renderDetailPanel</code>. Rows get a <strong>›</strong> button in their first cell; the panel opens right under the row
          and pushes the rows below it down. Keyboard: <kbd>Alt</kbd>+<kbd>↓</kbd> opens and <kbd>Alt</kbd>+<kbd>↑</kbd> closes the panel of the focused row,
          and <kbd>Enter</kbd> toggles it when the cell can't be edited. From code: <code>api.toggleDetailPanel(id, open?)</code> and{' '}
          <code>api.setDetailPanelExpanded(ids)</code>; the open ids live in <code>state.detailPanelExpanded</code>, so they can be controlled and saved like any
          other state.
        </p>
        <h2>Height</h2>
        <ul>
          <li><code>detailPanelHeight=&#123;200&#125;</code> (the default): every panel is that tall; its content scrolls if it doesn't fit.</li>
          <li><code>detailPanelHeight=&#123;(row) =&gt; row.big ? 400 : 120&#125;</code>: chosen per row.</li>
          <li>
            <code>detailPanelHeight="auto"</code> (or <code>'auto'</code> from the function): the panel is as tall as its content. The grid measures it with a{' '}
            <code>ResizeObserver</code> and re-lays out when it changes (images loading, a nested list growing). Until the first measurement it assumes 160 px.
          </li>
          <li><code>isDetailPanelAvailable(row)</code> hides the button for rows that have nothing to show. It is called for visible rows only.</li>
        </ul>
        <h2>What it costs</h2>
        <p>
          Row positions come from a small layout model: rows have a fixed height, and each open panel adds its height below its row. Finding the rows
          for the viewport is a binary search over the open panels, so it stays cheap however many are open: with 20,000 panels open in a
          100,000-row grid, working out which rows and panels to render takes about a microsecond. Only visible rows and panels are rendered.
          Panels follow their row when you sort and disappear while it is filtered out (they are still open when it comes back).
        </p>
        <p className="muted">
          Not supported yet: panels on pinned rows or the total row, and keeping the scroll position anchored when a panel above the viewport opens.
          The panel's content is rendered by your function on every render of the grid, so keep it cheap or memoise what it builds.
        </p>
      </>
    ),
  },
  {
    id: 'excel-export',
    group: 'Advanced features',
    title: 'Excel export',
    intro: 'Download the grid as a real .xlsx file: typed cells, number formats, merged column groups, collapsible group rows. No dependencies.',
    body: () => (
      <>
        {demo('ExcelExportDemo', ExcelExportDemo, excelSrc)}
        <h2>Using it</h2>
        <p>
          The toolbar's <strong>Export</strong> menu has <em>Download Excel (.xlsx)</em>. From code, <code>await api.exportXlsx(options)</code> downloads the file
          and <code>await api.getXlsx(options)</code> gives you the bytes (a <code>Uint8Array</code>) to upload or post-process. The file has what the grid shows:
          visible columns in their order, rows as filtered and sorted, <em>every</em> row of a group (collapsed or not, not only the current page).
        </p>
        <div className="table-wrap">
          <table className="props">
            <thead>
              <tr><th>Option</th><th>Default</th><th>What it does</th></tr>
            </thead>
            <tbody>
              <tr><td><code>fileName</code></td><td>export.xlsx</td><td>Name of the download (<code>exportXlsx</code>).</td></tr>
              <tr><td><code>sheetName</code></td><td>Sheet1</td><td>Worksheet name; characters Excel forbids are replaced and it is cut to 31.</td></tr>
              <tr><td><code>includeHeaders</code></td><td>true</td><td>Title row and, for pivot tables, the column group rows above it.</td></tr>
              <tr><td><code>selectedOnly</code></td><td>false</td><td>Only the selected rows (group rows are kept).</td></tr>
              <tr><td><code>formatted</code></td><td>false</td><td>Write numbers, dates and booleans as the text the grid shows instead of typed cells.</td></tr>
              <tr><td><code>numFmts</code></td><td>-</td><td>Excel number format per field, e.g. <code>{'{ salary: \'$#,##0\' }'}</code>.</td></tr>
              <tr><td><code>freezeHeader</code></td><td>true</td><td>Keep the header rows in view while scrolling.</td></tr>
              <tr><td><code>autoFilter</code></td><td>false</td><td>Filter buttons on the title row (not with column groups, where they would sit under merged cells).</td></tr>
              <tr><td><code>compress</code></td><td>true</td><td>Deflate the parts (smaller files; stored when the browser has no <code>CompressionStream</code>).</td></tr>
              <tr><td><code>onProgress</code>, <code>signal</code></td><td>-</td><td>Rows written so far; an <code>AbortSignal</code> to cancel (rejects with <code>AbortError</code>).</td></tr>
            </tbody>
          </table>
        </div>
        <h2>What goes in a cell</h2>
        <ul>
          <li><strong>Numbers, booleans and dates are typed cells</strong>, not text, so Excel can sum, sort and format them. The grid's <code>valueFormatter</code> is not applied to them (use <code>numFmts</code> for Excel formats); other columns are written as their formatted text, and <code>singleSelect</code> as the option's label.</li>
          <li><strong>Dates</strong> are written as the wall-clock date and time (Excel has no time zones) with the format <code>yyyy-mm-dd</code>.</li>
          <li><strong>Text is never a formula.</strong> Values are stored as inline strings, so <code>=1+1</code> stays text and no CSV-style escaping is needed.</li>
          <li><strong>Group rows</strong> carry their label and aggregates and are bold; their rows are <em>outline levels</em>, so Excel can collapse them with the +/− buttons. A total row follows when the grid has one.</li>
          <li><strong>Pivot tables</strong> export with their column groups as merged header cells and the numbers as numbers.</li>
          <li>Empty values leave the cell empty; <code>NaN</code>, infinities and invalid dates too. Text over Excel's 32,767-character limit is cut.</li>
        </ul>
        <h2>How it differs from MUI</h2>
        <p>
          MUI loads a forked ExcelJS (a large dependency, imported on demand), builds the whole workbook as objects, one per row and cell, then serialises it,
          optionally in a web worker. data-grid-kit writes the XML itself: rows are turned into text as they are read and the ZIP is assembled from those pieces, so the
          memory used is about the size of the output, and the page stays responsive because the writer yields to the event loop every few thousand rows (and can be cancelled).
          The price is features ExcelJS has: no data validation lists for <code>singleSelect</code>, no per-cell styles, no formulas, no images, no multiple sheets, and
          no <code>exceljsPreProcess</code> / <code>exceljsPostProcess</code> hooks.
        </p>
        <h2>Limits</h2>
        <ul>
          <li>Excel's own limits apply: 1,048,576 rows and 16,384 columns. Exporting more rejects with a clear message; filter the data or export in parts.</li>
          <li>One sheet. The archive is not ZIP64, so the file must stay under 4 GB.</li>
          <li>With server-side data only the rows that have been loaded are exported.</li>
          <li>Validated by reading the files back with an independent library (openpyxl) and by tests of the XML; it has not been opened in Excel or LibreOffice here, so check the output in the programs you target.</li>
        </ul>
        <h2>What it costs</h2>
        <p>
          Measured in Node (writing 6 typed columns, no grid): 100,000 rows take about 280 ms and make a 3.2 MB file (150 ms and 26 MB if you pass{' '}
          <code>compress: false</code>); 500,000 rows take about 1.3 s and 16 MB. Time is spent in a few yields to the event loop, not in one long block, so the
          interface keeps responding.
        </p>
      </>
    ),
  },
  {
    id: 'pivoting',
    group: 'Advanced features',
    title: 'Pivoting',
    intro: 'Turn rows into a cross-tab: group the rows, spread a field into columns, aggregate the cells.',
    body: () => (
      <>
        {demo('PivotDemo', PivotDemo, pivotSrc)}
        <h2>Turning it on</h2>
        <p>
          Set <code>pivoting</code>. The toolbar gets a <strong>Pivot</strong> button that opens the panel; from code use <code>api.setPivotMode(on)</code> and{' '}
          <code>api.setPivotModel(model)</code> (or <code>initialState.pivotMode</code> / <code>pivotModel</code>). The model has three parts:
        </p>
        <pre><code>{`{
  rows:    ['team', 'country'],               // grouped, outermost first
  columns: [{ field: 'role', sort: 'asc' }],  // one column group per distinct value
  values:  [{ field: 'salary', aggFunc: 'avg' }]
}`}</code></pre>
        <p>
          Each distinct value of the <em>columns</em> fields becomes a column group in the header (nested when there are several fields), with one column
          per value under it. Rows show the group totals only: there are no leaf rows, and the deepest row level is where the table ends. The
          row-label column sorts the groups (all levels together); the value columns do not sort. <code>pivotTotals</code> adds a <em>Total</em> column per
          value, and the total row at the bottom works like in Aggregation.
        </p>
        <h2>The panel</h2>
        <p>
          Drag a field's grip (⋮⋮) from <em>Fields</em> into <em>Rows</em>, <em>Columns</em> or <em>Values</em>; drop it between two entries to choose its place, drag
          entries to reorder them or move them to another list, and drop one on <em>Fields</em> to remove it. A field leaves the list it was in; a column keeps its sort
          and a value its function when it moves within its list. <em>Values</em> refuses fields that can't be aggregated, and <kbd>Esc</kbd> cancels a drag. The
          drag uses pointer events (mouse, touch and pen), not the browser's native drag and drop. Every move also has buttons (Row / Column / Value, ↑ ↓ ✕) for keyboard users.
          The move rules are a pure function, <code>movePivotField(model, field, section | null, before?)</code>, if you build your own panel.
        </p>
        <h2>What you can pivot on</h2>
        <ul>
          <li>Any column can be a row, a column or a value. Only the built-in functions (<code>sum</code>, <code>avg</code>, <code>min</code>, <code>max</code>, <code>count</code>, <code>size</code>) work as values; custom aggregation functions are not supported in a pivot.</li>
          <li>Date columns also offer <em>year</em> and <em>quarter</em> fields (<code>hired-year</code>, <code>hired-quarter</code>). Replace that with <code>pivotDerivedColumns</code> (a function from a column to extra columns) or turn it off with <code>false</code>.</li>
          <li>Empty values get their own <em>(No value)</em> column, listed last.</li>
          <li>The filter and quick filter apply to the source rows before pivoting; columns without any matching row disappear.</li>
          <li><code>pivotColumnDef(valueField, path)</code> adjusts a generated column (width, formatter, …).</li>
        </ul>
        <h2>How it differs from MUI</h2>
        <p>
          MUI builds a pivot by copying every row with one extra property per column, creating a column definition per combination, and recomputing all of it
          whenever rows change. data-grid-kit has no copies: each row adds itself to the running totals of its groups, under the one column it belongs to, so a changed
          row adjusts its ancestors and nothing else (columns appear and vanish with the data). Columns are sorted by their values, ascending unless you choose
          otherwise, not in order of appearance, so the result does not depend on the order rows arrived in.
        </p>
        <h2>Limits</h2>
        <ul>
          <li>Client-side data only: with a <code>dataSource</code> the server would have to pivot, which is not supported yet.</li>
          <li>No per-field hide toggle, no sorting by a value column, and each field can be used once (dragging it elsewhere moves it).</li>
          <li>Cells can't be edited. Copy and range selection read cell values, so they don't see the aggregates. CSV export writes the table as shown (the group rows of the current page), with the column groups joined into the header text.</li>
        </ul>
        <h2>What it costs</h2>
        <p>
          Measured in Node, 100,000 rows (500,000): building a pivot of team × role with sum and average takes about 35 ms (300 ms), the same with 40 column
          values 37 ms (240 ms), and with two row levels 43 ms (290 ms). Editing one value in a warm pivot costs 0.3 ms (5 ms; that is the diff of the new
          rows array, the same as for any live update), and the same with 40 columns: cost depends on the rows' depth, not on how many columns there are.
          For scale, just copying every row with a column key, which is the first step of MUI's approach, takes 79 ms (410 ms) before anything is
          aggregated.
        </p>
      </>
    ),
  },
  {
    id: 'server-side-data',
    group: 'Advanced features',
    title: 'Server-side data',
    intro: 'Let the server sort, filter and page. The grid asks for the rows it needs, caches them and shows skeletons while they load.',
    body: () => (
      <>
        <h2>Paginated</h2>
        {demo('ServerPagesDemo', ServerPagesDemo, serverPagesSrc)}
        <p>
          Instead of <code>rows</code>, pass <code>dataSource=&#123;&#123; getRows &#125;&#125;</code>. <code>getRows(&#123; start, end, sortModel, filterModel, signal &#125;)</code> returns{' '}
          <code>&#123; rows, rowCount &#125;</code>; <code>end</code> is inclusive. Sorting, filtering and the page all become requests. Pages you have already
          seen come from the cache (watch the log: going back to a page sends nothing), and a request that is no longer needed is aborted through{' '}
          <code>signal</code> when the sort or filter changes.
        </p>
        <h2>Scrolling (lazy loading)</h2>
        {demo('ServerScrollDemo', ServerScrollDemo, serverScrollSrc)}
        <p>
          With <code>pagination=&#123;false&#125;</code> the grid scrolls over all <code>rowCount</code> rows. Rows that are not loaded draw as skeletons and are
          requested in blocks (<code>dataSourceChunkSize</code>, default 100) as they come into view, a few blocks ahead in the scroll direction. Fast
          scrolling is debounced, so rows you fly past are not requested. If the server can't count, leave out <code>rowCount</code>: return{' '}
          <code>pageInfo: &#123; hasNextPage &#125;</code> and the grid keeps growing as you reach the end (infinite scroll).
        </p>
        <h2>Cache and freshness</h2>
        <ul>
          <li>Responses are cached per block, keyed by sort and filter, with a least-recently-used limit and a time-to-live (<code>dataSourceCache</code>; pass <code>false</code> to disable or your own object to share it).</li>
          <li>Only missing blocks are requested, up to <code>dataSourceMaxConcurrent</code> at once. The nearest blocks stay in memory; evicted ones can come back from the cache.</li>
          <li>A failed block shows an error banner with <em>Try again</em> and is retried automatically after a pause. <code>onDataSourceError</code> receives the failure.</li>
          <li><code>api.refreshData()</code> clears the cache and reloads; the old rows stay on screen until the new ones arrive (<code>dataSourceKeepPreviousData</code>).</li>
          <li><code>dataSourceRevalidateMs</code> re-fetches the visible blocks on a timer and only updates rows that changed.</li>
          <li>Editing calls <code>dataSource.updateRow</code> when you provide it; its result replaces the row, and the visible blocks are then revalidated because the edit may change the order.</li>
        </ul>
        <h2>What it costs</h2>
        <p>
          Measured in Node with 500,000 slots and 40,000 rows loaded: presenting the loaded blocks to the grid takes about 1 ms, and a freshly arrived block of 100
          rows about 0.1 ms. Reading 1,000 slots takes 0.02 ms. Memory is the loaded rows only (about 40 MB for these 40,000), not the 500,000 slots.
        </p>
        <h2>Limits</h2>
        <ul>
          <li>Grouping, tree data, aggregation, row pinning and row reordering need every row on the client, so they are off with a <code>dataSource</code>.</li>
          <li>CSV export contains the rows that are loaded, not the whole data set.</li>
          <li>Pagination is by offset (<code>start</code>/<code>end</code>); cursor-based APIs are not supported yet.</li>
          <li>Browsers cap an element's height (around 17 million px in Chrome, less elsewhere), so scrolling spans about 900,000 rows at 36 px.</li>
        </ul>
      </>
    ),
  },
  {
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
  },
  {
    id: 'tree-data',
    group: 'Advanced features',
    title: 'Tree data',
    intro: 'Hierarchies from a flat list: each row declares its path.',
    body: () => (
      <>
        {demo('TreeDemo', TreeDemo, treeSrc)}
        <ul>
          <li>
            <code>getTreeDataPath(row)</code> returns the path of keys; ancestors that have no row of their own are created as group
            rows. Two rows with the same path throw an error that names both ids.
          </li>
          <li>Filtering keeps the ancestors of matches; sorting orders siblings; pagination counts top-level nodes.</li>
          <li>Arrow Right / Left expand and collapse on the focused row.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'row-grouping',
    group: 'Advanced features',
    title: 'Row grouping',
    intro: 'Group by one or more fields; group rows show counts that follow the filter.',
    body: () => (
      <>
        {demo('GroupingDemo', GroupingDemo, groupingSrc)}
        <ul>
          <li>Groups are built from <code>valueGetter</code> (or the field), nested in the order given to <code>setRowGroupingModel</code>.</li>
          <li>Sorting by a grouped column orders the groups; leaves use their own sort.</li>
          <li>Expansion state is kept by group id: expand all, collapse all, or toggle one.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'headless',
    group: 'Guides',
    title: 'Headless usage',
    intro: 'Skip the grid component and render your own markup with the core hook.',
    body: () => (
      <>
        {demo('HeadlessDemo', HeadlessDemo, headlessSrc)}
        <p>
          <code>useGrid</code> returns <code>rows</code> (the flattened, ready-to-render list), <code>layout</code> (column groups and
          widths), <code>state</code> and an <code>api</code>. Import it from <code>data-grid-kit/core</code>, which has no UI code.
        </p>
      </>
    ),
  },
  {
    id: 'performance',
    group: 'Guides',
    title: 'Performance',
    intro: 'Where the time goes, and a benchmark you can run on your own machine.',
    body: () => (
      <>
        <h2>Design choices</h2>
        <ul>
          <li>
            <strong>A persistent hierarchy.</strong> Rows live in a mutable tree. Filtering and sorting store their results on the nodes, so
            sorting never rebuilds the tree, filtering never re-sorts nodes it didn't touch, and a single row change walks only its own path to the
            root (see <a href="#/live-updates">Live updates</a>).
          </li>
          <li>
            <strong>Staged and memoised.</strong> Build, filter, sort and flatten each recompute only when their own inputs change: expanding a
            group re-runs only the flatten stage. Models are compared by content, so passing a fresh literal every render costs nothing.
          </li>
          <li>
            <strong>Sort keys decorated once</strong>, text turned into integer ranks, one shared <code>Intl.Collator</code>, and a plain-number fast
            path in the comparator. Never <code>localeCompare</code> inside a comparator: it was 50× slower here.
          </li>
          <li>
            <strong>Reused row objects.</strong> The flattened list reuses each node's last <code>RenderRow</code> while nothing about it changed, and
            the diff of a new <code>rows</code> array compares object identity first (no id lookups for untouched rows).
          </li>
          <li>
            <strong>Windowed rendering.</strong> Rows O(1), columns O(log n), one store write per frame, memoised rows.
          </li>
        </ul>
        <h2>Measured (Node, one run on a laptop, median of several)</h2>
        <div className="table-wrap">
          <table className="props">
            <thead>
              <tr>
                <th>Scenario</th>
                <th style={{ textAlign: 'right' }}>100k rows</th>
                <th style={{ textAlign: 'right' }}>500k rows</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Full rebuild, sorted flat list', '51 ms', '372 ms'],
                ['Edit one row, sorted flat list (new rows array)', '6.6 ms', '45 ms'],
                ['Edit the sort key, grouped (new rows array)', '0.23 ms', '5 ms'],
                ['Edit the sort key, tree data (new rows array)', '0.28 ms', '5.5 ms'],
                ['Same edit, grouped, with sum + average on', '0.24 ms', '4.6 ms'],
                ['Build grouped + aggregated from scratch', '≈40 ms', '≈270 ms'],
                ['Build a pivot (team × role, sum + avg) from scratch', '≈35 ms', '≈300 ms'],
                ['Edit one value in a pivot (new rows array)', '0.3 ms', '5 ms'],
                ['Sort 2 text columns (cold)', '≈70 ms', '≈480 ms'],
                ['Filter + quick filter (cold)', '≈25 ms', '≈120 ms'],
                ['Expand / collapse a group', '<0.1 ms', '<0.1 ms'],
              ].map(([a, b, c]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td style={{ textAlign: 'right' }}>{b}</td>
                  <td style={{ textAlign: 'right' }}>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Honest caveats: a flat list still pays O(n) per update to hand React a fresh array of rows (that is the 6.6 ms above, against 0.25 ms when
          rows sit in groups). The persistent hierarchy also makes cold sorts and groupings somewhat heavier than a throw-away design would be: we
          traded that for cheap updates. Numbers vary by machine; the live benchmark below measures yours.
        </p>
        <h2>Run it yourself</h2>
        {demo('BenchmarkDemo', BenchmarkDemo, benchmarkSrc)}
        <p className="muted">
          These measure the data pipeline only (no rendering). Browser numbers depend on your machine; the repository also has{' '}
          <code>scripts/bench.ts</code> for Node. Not measured here: frame rate while scrolling, and a head-to-head against other grids.
        </p>
      </>
    ),
  },
  {
    id: 'api',
    group: 'Reference',
    title: 'API reference',
    intro: 'Props, column definition and the imperative API.',
    body: () => (
      <>
        <h2>&lt;Grid&gt; props</h2>
        <PropsTable rows={gridProps} />
        <h2>Column definition</h2>
        <PropsTable rows={columnProps} />
        <h2>Imperative API</h2>
        <p>
          Available from <code>onReady</code> or from <code>useGrid()</code> (<code>grid.api</code>).
        </p>
        <PropsTable rows={apiMethods} />
      </>
    ),
  },
]
