import VirtualizationDemo from '../demos/VirtualizationDemo'
import virtualizationSrc from '../demos/VirtualizationDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'virtualization',
  group: 'Advanced features',
  title: 'Virtualization',
  intro: 'Only the visible window of rows and columns exists in the DOM.',
  body: () => (
    <>
      {demo('VirtualizationDemo', VirtualizationDemo, virtualizationSrc)}
      <h2>How it works</h2>
      <ul>
        <li>Rows have a fixed height, so the row window is plain arithmetic: O(1).</li>
        <li>Columns use prefix sums of the widths and a binary search for the window: O(log n).</li>
        <li>
          Scroll events are batched to one store write per frame, and the grid re-renders only when the visible window changes, not on
          every scrolled pixel.
        </li>
        <li>Rows are memoized; moving focus or editing re-renders only the affected row.</li>
      </ul>
      <h2>Dragging the scrollbar very fast</h2>
      <p>
        Browsers scroll on a separate (compositor) thread, so they can paint a new scroll position <em>before</em> any JavaScript has seen it. If you
        drag the scrollbar thumb quickly through a very long list, the rows for the place you jumped to don't exist yet for a frame or two, and
        this is true of every DOM-virtualised grid (the MUI docs describe the same effect). We can't remove the gap, so we make it harmless: the
        scrolling area has striped placeholder rows behind the real ones, real rows cover them as soon as they render, and the grid keeps a
        buffer of 8 rows (<code>rowBufferPx</code>) on each side. Stopping the drag always shows the rows; nothing is left blank.
      </p>
      <p className="muted">
        Browsers cap an element's height (about 33 million px). At 36 px per row that is roughly 900,000 rows; beyond that a
        scroll-scaling strategy would be needed (not implemented).
      </p>
    </>
  ),
}
