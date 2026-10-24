import PivotDemo from '../demos/PivotDemo'
import pivotSrc from '../demos/PivotDemo.tsx?raw'
import { CodeBlock } from '../components/CodeBlock'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
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
      <h2>Sort, hide, repeat</h2>
      <ul>
        <li>
          <strong>Sort by a value column.</strong> Click the header of a value (or total) column: the groups of every level are ordered by that aggregate, ascending then descending, a
          third click clears it. Groups with no value come last in both directions. Clicking the row-label column orders by label as before. It only reorders the list, so it costs
          no rebuild; paging and the exports follow the same order.
        </li>
        <li>
          <strong>Hide without losing the setting.</strong> Each entry in the panel has a checkbox. A hidden row, column or value stays in the model (with its sort and function) but the
          table ignores it: <code>hidden: true</code> on a column or value entry, <code>hiddenRows: ['field']</code> for rows.
        </li>
        <li>
          <strong>The same field more than once.</strong> A field can be a value several times with different functions (the <em>+</em> button in the panel), each one a column per column value.
        </li>
      </ul>
      <CodeBlock
        code={`<Grid pivoting initialState={{ pivotMode: true, pivotModel: {
  rows: ['team', 'role'],
  columns: [{ field: 'country', sort: 'asc' }],
  values: [
    { field: 'salary', aggFunc: 'sum' },
    { field: 'salary', aggFunc: 'avg' },          // the same field again
    { field: 'age', aggFunc: 'avg', hidden: true }, // kept, not shown
  ],
  hiddenRows: ['role'],                             // group by team only, for now
} }} />`}
      />
      <p>
        For your own panel, <code>data-grid-kit/core</code> has the helpers the built-in one uses: <code>setPivotHidden</code>, <code>addPivotValue</code>, <code>removePivotValue</code>,{' '}
        <code>moveValueEntry</code>, <code>setValueFunc</code> and <code>visiblePivot</code>.
      </p>
      <h2>How it differs from MUI</h2>
      <p>
        MUI builds a pivot by copying every row with one extra property per column, creating a column definition per combination, and recomputing all of it
        whenever rows change. data-grid-kit has no copies: each row adds itself to the running totals of its groups, under the one column it belongs to, so a changed
        row adjusts its ancestors and nothing else (columns appear and vanish with the data). Columns are sorted by their values, ascending unless you choose
        otherwise, not in order of appearance, so the result does not depend on the order rows arrived in. MUI documents a <code>hidden</code> flag and sorting of the column
        values; its docs say using the same field twice is not supported yet and do not describe ordering rows by a value column, which is available here.
      </p>
      <h2>Limits</h2>
      <ul>
        <li>Client-side data only: with a <code>dataSource</code> the server would have to pivot, which is not supported yet.</li>
        <li>A field is in one of rows, columns or values (dragging it elsewhere moves it, with all its entries); only values can hold it more than once.</li>
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
}
