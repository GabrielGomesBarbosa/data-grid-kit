import TreeDemo from '../demos/TreeDemo'
import treeSrc from '../demos/TreeDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'tree-data',
  group: 'Advanced features',
  title: 'Tree data',
  intro: 'Hierarchies from a flat list: each row declares its path.',
  body: () => (
    <>
      {demo('TreeDemo', TreeDemo, treeSrc)}
      <ul>
        <li>
          <code>getTreeDataPath(row)</code> returns the path of keys; ancestors that have no row of their own are created as group
          rows. Two rows with the same path throw an error that names both ids.
        </li>
        <li>Filtering keeps the ancestors of matches; sorting orders siblings; pagination counts top-level nodes.</li>
        <li>Arrow Right / Left expand and collapse on the focused row.</li>
      </ul>
    </>
  ),
}
