import { features } from '../api'
import { type PageDef, Status } from './shared'

export const page: PageDef = {
  id: 'features',
  group: 'Getting started',
  title: 'Feature status',
  intro: 'An honest board of what ships today and what is still ahead.',
  body: () => (
    <>
      <p>
        The <em>Edition</em> column shows where MUI X places the equivalent feature (Community = free, Pro/Premium = commercial). It is a
        reference for comparison only: every data-grid-kit feature ships under the same license.
      </p>
      <div className="table-wrap">
        <table className="props">
          <thead>
            <tr>
              <th>Feature</th>
              <th>MUI X edition</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.name}>
                <td>{f.name}</td>
                <td>{f.edition}</td>
                <td>
                  <Status s={f.status} />
                </td>
                <td className="muted">{f.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  ),
}
