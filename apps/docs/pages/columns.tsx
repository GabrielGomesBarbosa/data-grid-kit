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
      <h2>The column menu</h2>
      <ul>
        <li>
          Opened by the ⋮ button, or with <kbd>Ctrl/Cmd+Enter</kbd> on a focused header (Enter sorts, Shift+Enter adds to the sort). <code>columnControls={'{false}'}</code> turns the buttons off
          for every column, <code>columnMenu: false</code> for one.
        </li>
        <li>
          Through <code>slotProps.columnMenu</code>: <code>hiddenItems</code> leaves groups out (<code>'sort' | 'filter' | 'pin' | 'move' | 'aggregate' | 'hide'</code>), and{' '}
          <code>itemsBefore</code> / <code>itemsAfter</code> add your own items. They get <code>{'{ field, column, grid, close }'}</code>; draw them with <code>ColumnMenuItem</code> so they look like the others.
          For more, replace the whole <code>columnMenu</code> slot.
        </li>
        <li>
          <code>hideable: false</code> on a column keeps it visible (its Hide item and its checkbox in the columns panel are off). The columns panel takes{' '}
          <code>disableShowHideToggle</code>, <code>disableResetButton</code>, <code>getTogglableColumns</code> and <code>toggleAllMode</code> through <code>slotProps.columnsPanel</code>.
        </li>
      </ul>
      <h2>Column definition</h2>
      <PropsTable rows={columnProps} />
    </>
  ),
}
