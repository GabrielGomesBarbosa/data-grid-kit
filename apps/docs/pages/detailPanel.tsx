import DetailPanelDemo from '../demos/DetailPanelDemo'
import detailSrc from '../demos/DetailPanelDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'detail-panel',
  group: 'Advanced features',
  title: 'Detail panel',
  intro: 'Open content under a row: order lines, a form, a nested table, a chart.',
  body: () => (
    <>
      {demo('DetailPanelDemo', DetailPanelDemo, detailSrc)}
      <h2>Turning it on</h2>
      <p>
        Give the grid <code>renderDetailPanel</code>. Rows get a <strong>›</strong> button in their first cell; the panel opens right under the row
        and pushes the rows below it down. Keyboard: <kbd>Alt</kbd>+<kbd>↓</kbd> opens and <kbd>Alt</kbd>+<kbd>↑</kbd> closes the panel of the focused row,
        and <kbd>Enter</kbd> toggles it when the cell can't be edited. From code: <code>api.toggleDetailPanel(id, open?)</code> and{' '}
        <code>api.setDetailPanelExpanded(ids)</code>; the open ids live in <code>state.detailPanelExpanded</code>, so they can be controlled and saved like any
        other state.
      </p>
      <h2>Height</h2>
      <ul>
        <li><code>detailPanelHeight=&#123;200&#125;</code> (the default): every panel is that tall; its content scrolls if it doesn't fit.</li>
        <li><code>detailPanelHeight=&#123;(row) =&gt; row.big ? 400 : 120&#125;</code>: chosen per row.</li>
        <li>
          <code>detailPanelHeight="auto"</code> (or <code>'auto'</code> from the function): the panel is as tall as its content. The grid measures it with a{' '}
          <code>ResizeObserver</code> and re-lays out when it changes (images loading, a nested list growing). Until the first measurement it assumes 160 px.
        </li>
        <li><code>isDetailPanelAvailable(row)</code> hides the button for rows that have nothing to show. It is called for visible rows only.</li>
      </ul>
      <h2>What it costs</h2>
      <p>
        Row positions come from a small layout model: rows have a fixed height, and each open panel adds its height below its row. Finding the rows
        for the viewport is a binary search over the open panels, so it stays cheap however many are open: with 20,000 panels open in a
        100,000-row grid, working out which rows and panels to render takes about a microsecond. Only visible rows and panels are rendered.
        Panels follow their row when you sort and disappear while it is filtered out (they are still open when it comes back).
      </p>
      <p className="muted">
        Not supported yet: panels on pinned rows or the total row, and keeping the scroll position anchored when a panel above the viewport opens.
        The panel's content is rendered by your function on every render of the grid, so keep it cheap or memoise what it builds.
      </p>
    </>
  ),
}
