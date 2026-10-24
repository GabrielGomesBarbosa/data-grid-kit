import EditingDemo from '../demos/EditingDemo'
import editingSrc from '../demos/EditingDemo.tsx?raw'
import { CodeBlock } from '../components/CodeBlock'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
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
}
