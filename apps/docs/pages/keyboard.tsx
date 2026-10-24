import { features, shortcuts } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'keyboard',
  group: 'Main features',
  title: 'Keyboard & accessibility',
  intro: 'Full cell navigation with the WAI-ARIA grid pattern.',
  body: () => (
    <>
      <p>
        Focus lives on the grid element and points at the active cell with <code>aria-activedescendant</code>, so it survives
        virtualization (a cell scrolled out of the DOM doesn't drop the focus). Rows, headers and cells carry <code>row</code>,{' '}
        <code>columnheader</code> and <code>gridcell</code> roles, plus <code>aria-rowcount</code>/<code>aria-colcount</code> for the full
        size even though only the visible window is rendered.
      </p>
      <div className="table-wrap">
        <table className="props">
          <thead>
            <tr><th>Keys</th><th>Action</th></tr>
          </thead>
          <tbody>
            {shortcuts.map(([k, a]) => (
              <tr key={k}><td><kbd>{k}</kbd></td><td>{a}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Try it in the <a href="#/editing">editing demo</a>. Note: structure and roles follow the ARIA pattern, but screen-reader testing
        is still pending.
      </p>
    </>
  ),
}
