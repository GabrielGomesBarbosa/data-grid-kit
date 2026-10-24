import LiveUpdatesDemo from '../demos/LiveUpdatesDemo'
import liveSrc from '../demos/LiveUpdatesDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'live-updates',
  group: 'Advanced features',
  title: 'Live updates',
  intro: 'Insert, edit and remove rows without rebuilding the grid: only the nodes on the changed rows\' paths are touched.',
  body: () => (
    <>
      {demo('LiveUpdatesDemo', LiveUpdatesDemo, liveSrc)}
      <h2>Two ways in</h2>
      <ul>
        <li>
          <code>api.updateRows({'{ insert, update, remove }'})</code>: imperative, for feeds (websockets, polling). <code>insert</code> and{' '}
          <code>update</code> are both upserts. <code>rows</code> can stay the same array.
        </li>
        <li>
          A <strong>new <code>rows</code> array</strong> (the React way): it is compared with the current rows and, when the change is small,
          applied incrementally. Row objects you didn't touch must keep their identity (keep using immutable updates).
        </li>
      </ul>
      <h2>What counts as small</h2>
      <p>
        Updates anywhere, removals anywhere and new rows appended at the end, up to about 1.5% of the rows (at least 64). A reorder is handled as
        remove + append while it stays under the same limit. Anything bigger, or a changed <code>columns</code> / grouping / tree on-off, rebuilds
        the hierarchy, which is still correct, just slower. <code>rows</code> from the owner always replaces edits made with{' '}
        <code>updateRows</code> or in-cell editing.
      </p>
      <h2>How it stays fast</h2>
      <ul>
        <li>The hierarchy is persistent. Each node stores whether its row passes the filter and how many rows pass below it, so a change adjusts the counts of its ancestors only (O(depth)).</li>
        <li>Every parent keeps its visible children in sorted order. A changed row is removed and re-inserted by <em>binary search</em>; if none of its sort keys changed, nothing moves and the update is O(1).</li>
        <li>Groups and tree folders appear and disappear on their own as their first / last row comes and goes.</li>
      </ul>
      <h2>Ordering guarantees</h2>
      <p>
        With a sort model, the result is identical to a fresh build: the repository has a randomized test that applies thousands of random
        inserts, edits, removals, group moves, reorders and filter / sort changes in flat, grouped and tree modes and compares every step with
        a from-scratch rebuild. Without a sort model, rows keep the order they were created in, and new rows and groups go to the end.
      </p>
    </>
  ),
}
