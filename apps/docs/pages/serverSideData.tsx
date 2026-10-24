import ServerPagesDemo from '../demos/ServerPagesDemo'
import ServerScrollDemo from '../demos/ServerScrollDemo'
import serverPagesSrc from '../demos/ServerPagesDemo.tsx?raw'
import serverScrollSrc from '../demos/ServerScrollDemo.tsx?raw'
import { CodeBlock } from '../components/CodeBlock'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'server-side-data',
  group: 'Advanced features',
  title: 'Server-side data',
  intro: 'Let the server sort, filter and page. The grid asks for the rows it needs, caches them and shows skeletons while they load.',
  body: () => (
    <>
      <h2>Paginated</h2>
      {demo('ServerPagesDemo', ServerPagesDemo, serverPagesSrc)}
      <p>
        Instead of <code>rows</code>, pass <code>dataSource=&#123;&#123; getRows &#125;&#125;</code>. <code>getRows(&#123; start, end, sortModel, filterModel, signal &#125;)</code> returns{' '}
        <code>&#123; rows, rowCount &#125;</code>; <code>end</code> is inclusive. Sorting, filtering and the page all become requests. Pages you have already
        seen come from the cache (watch the log: going back to a page sends nothing), and a request that is no longer needed is aborted through{' '}
        <code>signal</code> when the sort or filter changes.
      </p>
      <h2>Scrolling (lazy loading)</h2>
      {demo('ServerScrollDemo', ServerScrollDemo, serverScrollSrc)}
      <p>
        With <code>pagination=&#123;false&#125;</code> the grid scrolls over all <code>rowCount</code> rows. Rows that are not loaded draw as skeletons and are
        requested in blocks (<code>dataSourceChunkSize</code>, default 100) as they come into view, a few blocks ahead in the scroll direction. Fast
        scrolling is debounced, so rows you fly past are not requested. If the server can't count, leave out <code>rowCount</code>: return{' '}
        <code>pageInfo: &#123; hasNextPage &#125;</code> and the grid keeps growing as you reach the end (infinite scroll).
      </p>
      <h2>Cursor-based APIs</h2>
      <p>
        Some APIs (GraphQL connections, many feeds) cannot jump to row 5,000: they give a cursor with each page and want it back to get the next one. Return it as{' '}
        <code>pageInfo.nextCursor</code> and the grid sends it as <code>params.cursor</code> with the request for the rows after it; <code>null</code> marks the last page.
        The grid keeps the cursors, so the app does not have to (with MUI the app tracks the cursor of every page itself).
      </p>
      <CodeBlock
        code={`const dataSource = {
  async getRows({ cursor, end, start, sortModel, signal }) {
    const res = await fetch(\`/api/feed?after=\${cursor ?? ''}&limit=\${end - start + 1}\`, { signal })
    const { items, next } = await res.json()
    return { rows: items, pageInfo: { nextCursor: next ?? null } }
  },
}`}
      />
      <p>
        Blocks are fetched in order from then on: scrolling or paging <em>ahead</em> loads the pages in between, one request each carrying the previous cursor, and every
        page is cached. A new sort or filter starts again from the first page. Sources that answer with a total (<code>rowCount</code>) and no cursor are not affected.
      </p>

      <h2>Cache and freshness</h2>
      <ul>
        <li>Responses are cached per block, keyed by sort and filter, with a least-recently-used limit and a time-to-live (<code>dataSourceCache</code>; pass <code>false</code> to disable or your own object to share it).</li>
        <li>Only missing blocks are requested, up to <code>dataSourceMaxConcurrent</code> at once. The nearest blocks stay in memory; evicted ones can come back from the cache.</li>
        <li>A failed block shows an error banner with <em>Try again</em> and is retried automatically after a pause. <code>onDataSourceError</code> receives the failure.</li>
        <li><code>api.refreshData()</code> clears the cache and reloads; the old rows stay on screen until the new ones arrive (<code>dataSourceKeepPreviousData</code>).</li>
        <li><code>dataSourceRevalidateMs</code> re-fetches the visible blocks on a timer and only updates rows that changed.</li>
        <li>Editing calls <code>dataSource.updateRow</code> when you provide it; its result replaces the row, and the visible blocks are then revalidated because the edit may change the order.</li>
      </ul>
      <h2>What it costs</h2>
      <p>
        Measured in Node with 500,000 slots and 40,000 rows loaded: presenting the loaded blocks to the grid takes about 1 ms, and a freshly arrived block of 100
        rows about 0.1 ms. Reading 1,000 slots takes 0.02 ms. Memory is the loaded rows only (about 40 MB for these 40,000), not the 500,000 slots.
      </p>
      <h2>Limits</h2>
      <ul>
        <li>Grouping, tree data, aggregation, row pinning and row reordering need every row on the client, so they are off with a <code>dataSource</code>.</li>
        <li>CSV export contains the rows that are loaded, not the whole data set.</li>
        <li>Pagination is by offset (<code>start</code>/<code>end</code>); cursor-based APIs are not supported yet.</li>
        <li>Browsers cap an element's height (around 17 million px in Chrome, less elsewhere), so scrolling spans about 900,000 rows at 36 px.</li>
      </ul>
    </>
  ),
}
