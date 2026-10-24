import { CodeBlock } from '../components/CodeBlock'
import { features } from '../api'
import { type PageDef } from './shared'

export const page: PageDef = {
  id: 'overview',
  group: 'Getting started',
  title: 'Overview',
  intro: 'data-grid-kit is a React data grid built headless-first: a store and a row pipeline with no UI, and a ready-made grid on top of it.',
  body: () => (
    <>
      <h2>What you get</h2>
      <ul>
        <li>
          <strong>Headless core</strong> (<code>data-grid-kit/core</code>): state store, memoised row pipeline (filter → group/tree → sort →
          paginate), column layout and virtualization math, keyboard navigation, editing and CSV, all usable without any UI.
        </li>
        <li>
          <strong>A grid component</strong> (<code>data-grid-kit</code>) built on that core: virtualized rows and columns, pinning, tree data,
          row grouping, editing, keyboard navigation, column menu, filter and column panels, CSV export.
        </li>
        <li>
          <strong>No UI-library dependency.</strong> Styling is plain CSS with variables; light and dark follow the system theme.
        </li>
      </ul>
      <h2>Install</h2>
      <p>
        data-grid-kit is not published to npm yet. Until it is, build it from the repository and install the tarball (or use a workspace link):
      </p>
      <CodeBlock title="shell" code={`git clone https://github.com/GabrielGomesBarbosa/data-grid-kit && cd data-grid-kit\nnpm install && npm run build\ncd packages/data-grid-kit && npm pack   # creates data-grid-kit-0.1.0.tgz\nnpm install ../path/to/data-grid-kit-0.1.0.tgz   # in your app`} />
      <CodeBlock
        title="tsx"
        code={`import { Grid } from 'data-grid-kit'\nimport 'data-grid-kit/styles.css'`}
      />
      <p>
        Peer dependency: React 18 or newer. See the <a href="#/features">feature status</a> for exactly what exists today, and{' '}
        <a href="#/performance">Performance</a> for measured numbers.
      </p>
    </>
  ),
}
