import ExportDemo from '../demos/ExportDemo'
import exportSrc from '../demos/ExportDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
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
}
