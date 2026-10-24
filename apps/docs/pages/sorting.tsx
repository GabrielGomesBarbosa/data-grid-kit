import SortingDemo from '../demos/SortingDemo'
import sortingSrc from '../demos/SortingDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'sorting',
  group: 'Main features',
  title: 'Sorting',
  intro: 'Multi-column sorting with a single pass of key extraction.',
  body: () => (
    <>
      {demo('SortingDemo', SortingDemo, sortingSrc)}
      <h2>How it works</h2>
      <p>
        Sort keys are read once per row and, for text columns, replaced by their rank among the distinct values, so sorting compares
        integers instead of calling <code>localeCompare</code> millions of times. Sorting 100,000 rows by two text columns takes tens of
        milliseconds (see <a href="#/performance">Performance</a>). Empty values always stay last, in both directions. With row grouping
        or tree data, only siblings are sorted.
      </p>
    </>
  ),
}
