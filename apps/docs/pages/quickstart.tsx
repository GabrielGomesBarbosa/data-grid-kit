import QuickstartDemo from '../demos/QuickstartDemo'
import quickstartSrc from '../demos/QuickstartDemo.tsx?raw'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'quickstart',
  group: 'Getting started',
  title: 'Quickstart',
  intro: 'A grid needs rows, columns and a height.',
  body: () => (
    <>
      {demo('QuickstartDemo', QuickstartDemo, quickstartSrc)}
      <h2>Things to know</h2>
      <ul>
        <li>
          Define <code>columns</code> outside the component (or memoize them). A new array on every render rebuilds the layout and the
          row pipeline.
        </li>
        <li>
          Rows need a unique, stable id: an <code>id</code> field, or pass <code>getRowId</code>.
        </li>
        <li>
          The grid scrolls inside its own <code>height</code>. Rows have a fixed height, which is what keeps virtualization O(1).
        </li>
      </ul>
    </>
  ),
}
