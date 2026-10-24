import PinningDemo from '../demos/PinningDemo'
import pinningSrc from '../demos/PinningDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'pinning',
  group: 'Advanced features',
  title: 'Column pinning',
  intro: 'Pin columns to the left or right edge; the rest scrolls between them.',
  body: () => (
    <>
      {demo('PinningDemo', PinningDemo, pinningSrc)}
      <p>
        Pinned columns use native <code>position: sticky</code>, so the browser keeps them in place during scrolling with no JavaScript
        synchronisation. Pin from code with <code>initialState.pinnedColumns</code>, <code>api.pinColumn(field, side)</code>, or at
        runtime from the ⋮ column menu. Keyboard navigation accounts for pinned columns when scrolling a cell into view.
      </p>
    </>
  ),
}
