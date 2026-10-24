import SelectionDemo from '../demos/SelectionDemo'
import selectionSrc from '../demos/SelectionDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'selection',
  group: 'Main features',
  title: 'Row selection',
  intro: 'Checkbox selection with tri-state group rows.',
  body: () => (
    <>
      {demo('SelectionDemo', SelectionDemo, selectionSrc)}
      <p>
        Selecting a group (or a tree parent) selects its <em>visible</em> descendants, so filtered-out rows are never selected by
        accident. The group checkbox shows an indeterminate state when only some descendants are selected. Press Space on the focused
        row to toggle it.
      </p>
    </>
  ),
}
