import CellSelectionDemo from '../demos/CellSelectionDemo'
import cellSelectionSrc from '../demos/CellSelectionDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
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
}
