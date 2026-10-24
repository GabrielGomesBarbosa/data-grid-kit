import BenchmarkDemo from '../demos/BenchmarkDemo'
import benchmarkSrc from '../demos/BenchmarkDemo.tsx?raw'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'performance',
  group: 'Guides',
  title: 'Performance',
  intro: 'Where the time goes, and a benchmark you can run on your own machine.',
  body: () => (
    <>
      <h2>Design choices</h2>
      <ul>
        <li>
          <strong>A persistent hierarchy.</strong> Rows live in a mutable tree. Filtering and sorting store their results on the nodes, so
          sorting never rebuilds the tree, filtering never re-sorts nodes it didn't touch, and a single row change walks only its own path to the
          root (see <a href="#/live-updates">Live updates</a>).
        </li>
        <li>
          <strong>Staged and memoised.</strong> Build, filter, sort and flatten each recompute only when their own inputs change: expanding a
          group re-runs only the flatten stage. Models are compared by content, so passing a fresh literal every render costs nothing.
        </li>
        <li>
          <strong>Sort keys decorated once</strong>, text turned into integer ranks, one shared <code>Intl.Collator</code>, and a plain-number fast
          path in the comparator. Never <code>localeCompare</code> inside a comparator: it was 50× slower here.
        </li>
        <li>
          <strong>Reused row objects.</strong> The flattened list reuses each node's last <code>RenderRow</code> while nothing about it changed, and
          the diff of a new <code>rows</code> array compares object identity first (no id lookups for untouched rows).
        </li>
        <li>
          <strong>Windowed rendering.</strong> Rows O(1), columns O(log n), one store write per frame, memoised rows.
        </li>
      </ul>
      <h2>Measured (Node, one run on a laptop, median of several)</h2>
      <div className="table-wrap">
        <table className="props">
          <thead>
            <tr>
              <th>Scenario</th>
              <th style={{ textAlign: 'right' }}>100k rows</th>
              <th style={{ textAlign: 'right' }}>500k rows</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Full rebuild, sorted flat list', '51 ms', '372 ms'],
              ['Edit one row, sorted flat list (new rows array)', '6.6 ms', '45 ms'],
              ['Edit the sort key, grouped (new rows array)', '0.23 ms', '5 ms'],
              ['Edit the sort key, tree data (new rows array)', '0.28 ms', '5.5 ms'],
              ['Same edit, grouped, with sum + average on', '0.24 ms', '4.6 ms'],
              ['Build grouped + aggregated from scratch', '≈40 ms', '≈270 ms'],
              ['Build a pivot (team × role, sum + avg) from scratch', '≈35 ms', '≈300 ms'],
              ['Edit one value in a pivot (new rows array)', '0.3 ms', '5 ms'],
              ['Sort 2 text columns (cold)', '≈70 ms', '≈480 ms'],
              ['Filter + quick filter (cold)', '≈25 ms', '≈120 ms'],
              ['Expand / collapse a group', '<0.1 ms', '<0.1 ms'],
            ].map(([a, b, c]) => (
              <tr key={a}>
                <td>{a}</td>
                <td style={{ textAlign: 'right' }}>{b}</td>
                <td style={{ textAlign: 'right' }}>{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Honest caveats: a flat list still pays O(n) per update to hand React a fresh array of rows (that is the 6.6 ms above, against 0.25 ms when
        rows sit in groups). The persistent hierarchy also makes cold sorts and groupings somewhat heavier than a throw-away design would be: we
        traded that for cheap updates. Numbers vary by machine; the live benchmark below measures yours.
      </p>
      <h2>Run it yourself</h2>
      {demo('BenchmarkDemo', BenchmarkDemo, benchmarkSrc)}
      <p className="muted">
        These measure the data pipeline only (no rendering). Browser numbers depend on your machine; the repository also has{' '}
        <code>scripts/bench.ts</code> for Node. Not measured here: frame rate while scrolling, and a head-to-head against other grids.
      </p>
    </>
  ),
}
