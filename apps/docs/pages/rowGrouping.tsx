import GroupingDemo from '../demos/GroupingDemo'
import groupingSrc from '../demos/GroupingDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'row-grouping',
  group: 'Advanced features',
  title: 'Row grouping',
  intro: 'Group by one or more fields; group rows show counts that follow the filter.',
  body: () => (
    <>
      {demo('GroupingDemo', GroupingDemo, groupingSrc)}
      <ul>
        <li>Groups are built from <code>valueGetter</code> (or the field), nested in the order given to <code>setRowGroupingModel</code>.</li>
        <li>Sorting by a grouped column orders the groups; leaves use their own sort.</li>
        <li>Expansion state is kept by group id: expand all, collapse all, or toggle one.</li>
      </ul>
    </>
  ),
}
