import SelectionDemo from '../demos/SelectionDemo'
import selectionSrc from '../demos/SelectionDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'selection',
  group: 'Main features',
  title: 'Row selection',
  intro: 'Checkbox selection with tri-state group rows, click selection with ranges, and rows that cannot be selected.',
  body: () => (
    <>
      {demo('SelectionDemo', SelectionDemo, selectionSrc)}
      <p>
        Selecting a group (or a tree parent) selects its <em>visible</em> descendants, so filtered-out rows are never selected by
        accident. The group checkbox shows an indeterminate state when only some descendants are selected. Press Space on the focused
        row to toggle it.
      </p>
      <ul>
        <li>
          <code>rowSelectionOnClick</code>: a click selects that row alone (a click on the only selected row unselects it), <strong>Ctrl/Cmd+click</strong> adds
          or removes one, <strong>Shift+click</strong> selects the range from the last click (Ctrl+Shift adds it), and <strong>Ctrl/Cmd+A</strong> selects every
          selectable row. It is off by default and ignored with <code>cellSelection</code>, which uses those clicks.
        </li>
        <li>
          <code>multipleRowSelection={'{false}'}</code> keeps one row at a time. <code>isRowSelectable</code> marks rows that cannot be selected: clicks, ranges and
          select-all skip them and their checkbox is disabled.
        </li>
        <li>
          The selection is not dropped when rows leave the data or the filters hide them, so it also works across pages and server-side data.
          <code> api.setSelection(ids)</code>, <code>api.selectAll()</code> and <code>api.isRowSelectable(id)</code> do the same from code.
        </li>
      </ul>
    </>
  ),
}
