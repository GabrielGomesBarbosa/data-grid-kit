import ClipboardDemo from '../demos/ClipboardDemo'
import clipboardSrc from '../demos/ClipboardDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
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
}
