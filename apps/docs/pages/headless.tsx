import HeadlessDemo from '../demos/HeadlessDemo'
import headlessSrc from '../demos/HeadlessDemo.tsx?raw'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'headless',
  group: 'Guides',
  title: 'Headless usage',
  intro: 'Skip the grid component and render your own markup with the core hook.',
  body: () => (
    <>
      {demo('HeadlessDemo', HeadlessDemo, headlessSrc)}
      <p>
        <code>useGrid</code> returns <code>rows</code> (the flattened, ready-to-render list), <code>layout</code> (column groups and
        widths), <code>state</code> and an <code>api</code>. Import it from <code>data-grid-kit/core</code>, which has no UI code.
      </p>
    </>
  ),
}
