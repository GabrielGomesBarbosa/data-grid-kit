import ColumnsDemo from '../demos/ColumnsDemo'
import columnsSrc from '../demos/ColumnsDemo.tsx?raw'
import { PropsTable } from '../components/PropsTable'
import { columnProps, features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
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
      <h2>Widths</h2>
      <ul>
        <li>
          <code>width</code> / <code>minWidth</code> / <code>maxWidth</code> are pixels. <code>flex</code> shares the width the other columns leave free, in
          proportion (<code>flex: 2</code> gets twice the share of <code>flex: 1</code>) within the min and the max; a column the user resizes becomes fixed, and with no
          room a flex column keeps its <code>minWidth</code> (default 100) and the grid scrolls.
        </li>
        <li>
          <strong>Autosize</strong>: <code>api.autosizeColumns(options)</code>, a double click on a column's divider, or <code>autosizeOnMount</code> fit columns to the
          header and the cells that are on screen (rows scrolled out of view are not measured). Unusually wide values are ignored unless{' '}
          <code>includeOutliers</code>; <code>expand</code> shares a spare edge of the grid among the fitted columns.
        </li>
      </ul>
      <h2>Types, headers and class names</h2>
      <ul>
        <li>
          Types: <code>string</code>, <code>number</code>, <code>boolean</code>, <code>date</code>, <code>dateTime</code> (a date with its time), <code>singleSelect</code>
          and <code>actions</code> (a column of buttons from <code>getActions</code>; never sorted, filtered, edited or exported).
        </li>
        <li>
          <code>renderHeader</code>, <code>headerAlign</code>, <code>description</code> (a tooltip) and <code>headerClassName</code> shape the header;{' '}
          <code>cellClassName</code> (fixed, or from the value and the row), the grid's <code>getCellClassName</code> and <code>getRowClassName</code> add class names from the data.
          Keep functions you give the grid the same between renders (<code>useCallback</code>).
        </li>
        <li>
          The grid reports <code>onRowClick</code>, <code>onCellClick</code>, <code>onCellDoubleClick</code>, <code>onCellKeyDown</code> and <code>onColumnHeaderClick</code>;{' '}
          <code>event.preventDefault()</code> inside one stops what the grid would do with it.
        </li>
      </ul>
      <h2>Column definition</h2>
      <PropsTable rows={columnProps} />
    </>
  ),
}
