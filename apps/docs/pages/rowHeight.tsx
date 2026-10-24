import RowHeightDemo from '../demos/RowHeightDemo'
import rowHeightSrc from '../demos/RowHeightDemo.tsx?raw'
import { CodeBlock } from '../components/CodeBlock'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'row-height',
  group: 'Advanced features',
  title: 'Row height',
  intro: 'One height for every row, a height per row, or rows that fit their content, all virtualized.',
  body: () => (
    <>
      {demo('RowHeightDemo', RowHeightDemo, rowHeightSrc)}
      <h2>Using it</h2>
      <CodeBlock
        code={`<Grid
  rowHeight={36}                                   // the default for every row
  getRowHeight={({ row }) => (row?.big ? 84 : null)}  // a number, null for the default, or 'auto'
  getEstimatedRowHeight={76}                       // assumed for 'auto' rows until they are measured
/>`}
      />
      <ul>
        <li>
          <code>getRowHeight</code> returns a number (px), <code>null</code> / <code>undefined</code> for <code>rowHeight</code>, or <code>'auto'</code>. A number that is not positive
          and finite counts as <code>null</code>. It gets <code>{'{ id, row, depth }'}</code>; group rows have no <code>row</code>.
        </li>
        <li>
          It runs for every row of the current list whenever <code>rows</code>, the sort, the filter or the function change, so give it a stable identity (<code>useCallback</code>), as with MUI.
          With numbers only, positions come from one prefix sum (O(n) once) and a scroll position is found by binary search (O(log n)).
        </li>
        <li>
          <strong>Auto rows</strong> take the height of their tallest cell: the cells wrap their text and keep the height of their content. A row is measured when it first renders and again
          whenever one of its cells changes size (a font loads, an image arrives, a column is resized). Until then it is <code>getEstimatedRowHeight</code> tall (default: <code>rowHeight</code>), so
          set it near the real average to keep the scrollbar steady.
        </li>
        <li>
          <strong>No jumping.</strong> When a row above the visible ones is measured and changes height, the scroll position moves by the same amount, so what you are reading stays where it is.
          Measured heights are kept while a row is out of view.
        </li>
        <li>Detail panels, row grouping, tree data and pagination work with all of this; the panel sits under its own row, whatever that row's height is.</li>
      </ul>
      <h2>How it differs from MUI</h2>
      <p>
        The API is the same shape (<code>getRowHeight</code>, <code>getEstimatedRowHeight</code>, <code>virtualizeColumnsWithAutoRowHeight</code>). As in MUI, while any row is
        <code>'auto'</code> every column is rendered: a row is as tall as its tallest cell, and a cell that is not in the DOM cannot be measured. Set{' '}
        <code>virtualizeColumnsWithAutoRowHeight</code> to keep virtualizing columns; row heights can then change while you scroll sideways. Rows with numbers only keep virtualizing columns.
        Density does not apply to rows with their own heights, here either.
      </p>
      <h2>Limits</h2>
      <ul>
        <li>With auto rows every column is rendered, so a grid with hundreds of columns and auto rows renders more cells than usual (rows are still virtualized).</li>
        <li>The content of an auto row must not depend on the row's own height (a cell that fills 100% of it never settles; the grid stops measuring after a few passes in one frame).</li>
        <li>Pinned rows and the footer use <code>rowHeight</code>. The placeholder stripes shown during a very fast scrollbar drag use <code>rowHeight</code> too.</li>
        <li>Changing <code>getEstimatedRowHeight</code> while rows are scrolled moves the rows that were not measured, and the scroll position is not compensated for that.</li>
      </ul>
    </>
  ),
}
