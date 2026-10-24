import EditingDemo from '../demos/EditingDemo'
import editingSrc from '../demos/EditingDemo.tsx?raw'
import { CodeBlock } from '../components/CodeBlock'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'editing',
  group: 'Main features',
  title: 'Editing',
  intro: 'Edit a cell or a whole row, with typed editors, validation (async too), events and custom editors.',
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
      <h2>Row mode, validation, events</h2>
      <ul>
        <li>
          <code>editMode="row"</code> opens an editor in every editable cell of the row; <strong>Tab</strong> moves between them, <strong>Enter</strong> or a click outside the
          row saves it (one <code>processRowUpdate</code> for the whole row) and <strong>Escape</strong> discards. <code>api.startRowEdit(id, field?)</code>,
          <code> setEditValue</code>, <code>commitRowEdit</code> and <code>cancelRowEdit</code> do the same from code.
        </li>
        <li>
          <code>validate({'{ value, row, field }'})</code> on a column returns a message to refuse the value (or nothing), and may be async. The editor shows the message
          (<code>aria-invalid</code>, a tooltip and a red outline) while you type, and a refused edit stays open. In a row every editable cell is checked when it is saved.
        </li>
        <li>
          <code>onCellEditStart</code> / <code>onRowEditStart</code> can stop an edit by returning <code>false</code>; <code>onCellEditStop</code> /{' '}
          <code>onRowEditStop</code> say why it ended (<code>enter</code>, <code>tab</code>, <code>escape</code>, <code>blur</code> or <code>api</code>), whether it was cancelled, and can
          keep it open by returning <code>false</code>.
        </li>
        <li>
          Editing is part of the grid's state: control it with <code>state={'{{ editingCell, editingRow }}'}</code> and <code>onStateChange</code>, like any other slice.
          A <code>renderEditCell</code> gets <code>setValue</code> (call it on every change so the value is checked and, in a row, kept), <code>error</code> and <code>rowMode</code>.
        </li>
      </ul>
      <h2>Recipes</h2>
      <ul>
        <li>
          <strong>Single-click editing</strong>: <code>onCellClick={'{({ id, field }) => api.startEdit(id, field)}'}</code> (keep the api from <code>onReady</code>).
        </li>
        <li>
          <strong>Bulk editing</strong>: select rows, then apply a value to each of them with <code>api.applyCellValues</code>, or call <code>api.updateRows</code> with the changed rows.
        </li>
        <li>
          <strong>A button column to edit a row</strong>: an <code>actions</code> column whose action calls <code>api.startRowEdit(id)</code>.
        </li>
      </ul>
      <CodeBlock
        title="custom editor"
        code={`{\n  field: 'status',\n  editable: true,\n  renderEditCell: ({ value, commit, cancel }) => (\n    <select autoFocus defaultValue={String(value)}\n      onChange={(e) => commit(e.target.value)}\n      onBlur={cancel}>\n      <option>open</option>\n      <option>closed</option>\n    </select>\n  ),\n}`}
      />
    </>
  ),
}
