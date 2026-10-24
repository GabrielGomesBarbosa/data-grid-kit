import SlotsDemo from '../demos/SlotsDemo'
import slotsSrc from '../demos/SlotsDemo.tsx?raw'
import { CodeBlock } from '../components/CodeBlock'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'customization',
  group: 'Guides',
  title: 'Customization',
  intro: 'Restyle or replace any part of the grid: slots, slotProps, an unstyled mode, state attributes, or your own markup over useGridView.',
  body: () => (
    <>
      {demo('SlotsDemo', SlotsDemo, slotsSrc)}
      <p>
        There are four levels, from least to most work. Each one keeps the behaviour (keyboard, selection, virtualization, editing): you change what is
        drawn, not what happens.
      </p>

      <h2>1. slotProps: classes and styles</h2>
      <p>
        <code>slotProps</code> are merged over the props the grid gives a part, so they win. Use them for <code>className</code> and <code>style</code>. For
        column-positioned parts (<code>cell</code>, <code>headerCell</code>) a <code>style</code> is merged with the positioning style, never instead of it.
      </p>
      <CodeBlock code={`<Grid slotProps={{ row: { className: 'my-row' }, footer: { style: { padding: 8 } } }} />`} />

      <h2>2. slots: replace a part</h2>
      <p>
        A slot is a React component that receives the props the built-in one receives. Render <code>defaultSlots.cell</code> yourself to wrap or decorate
        it, or return something else entirely. Parts: <code>toolbar</code>, <code>footer</code>, <code>headerCell</code>, <code>row</code>, <code>cell</code>,{' '}
        <code>skeletonRow</code>, <code>detailPanel</code>, <code>loadingOverlay</code>, <code>errorOverlay</code>, <code>noRowsOverlay</code>,{' '}
        <code>columnMenu</code>, <code>filterPanel</code>, <code>columnsPanel</code>, <code>pivotPanel</code>, <code>popover</code>, the base controls{' '}
        <code>baseButton</code>, <code>baseCheckbox</code>, <code>baseSelect</code>, <code>baseInput</code> (so every button and input matches your design
        system) and <code>icons</code> (16 symbols, each replaceable).
      </p>
      <CodeBlock
        code={`import { Grid, defaultSlots } from 'data-grid-kit'

// every button in the grid, toolbar to pager, becomes yours
const MyButton = forwardRef((props, ref) => <MyDsButton ref={ref} size="sm" {...props} />)

<Grid slots={{ baseButton: MyButton, icons: { ...defaultSlots.icons, close: XIcon } }} />`}
      />
      <h3>Performance of custom rows and cells</h3>
      <p>
        Define slots outside the component (or memoise them): a new component type every render remounts the part. A custom <code>row</code> slot is
        wrapped by the grid with the same comparator the built-in row uses (<code>rowPropsEqual</code>), so it is skipped when nothing it shows changed, even if
        you did not memoise it. A custom <code>cell</code> is called only for the cells of a row that re-renders. The test suite counts this: a parent re-render
        calls no row or cell; moving the focus calls two rows; updating one row calls that row; scrolling by one row calls only the row that entered.
      </p>

      <h2>3. Unstyled mode: your look, the grid's structure</h2>
      <p>
        The default stylesheet is split in two. <code>structure.css</code> has only what the grid needs to work (positioning, sticky pinned columns, the
        virtualized layout, overflow); <code>theme.css</code> has colours, borders, fonts and spacing. Import the structure and write your own theme, or
        import nothing and style the class names yourself.
      </p>
      <CodeBlock
        title="css"
        code={`import 'data-grid-kit/structure.css' // layout only
// import 'data-grid-kit/theme.css'  // the default look, if you want to start from it
// import 'data-grid-kit/styles.css' // both`}
      />
      <p>Class names are stable and prefixed <code>gk-</code>. State is exposed as attributes, so a theme never needs JavaScript:</p>
      <div className="table-wrap">
        <table className="props">
          <thead>
            <tr><th>Element</th><th>Attributes</th></tr>
          </thead>
          <tbody>
            <tr><td><code>.gk-root</code></td><td><code>data-loading</code>, <code>data-pivot</code></td></tr>
            <tr><td><code>.gk-header-cell</code></td><td><code>data-sort</code> (asc / desc), <code>data-pinned</code> (left / right), <code>data-align</code></td></tr>
            <tr><td><code>.gk-row</code></td><td><code>data-selected</code>, <code>data-odd</code>, <code>data-group</code>, <code>data-footer</code>, <code>data-pinned</code>, <code>data-detail-open</code>, <code>data-dragging</code></td></tr>
            <tr><td><code>.gk-cell</code></td><td><code>data-align</code>, <code>data-editing</code>, plus the focus and range-selection attributes</td></tr>
          </tbody>
        </table>
      </div>
      <CodeBlock
        title="css"
        code={`.gk-row[data-selected] { background: oklch(95% 0.04 250); }
.gk-header-cell[data-sort='asc']::after { content: ' ↑'; }`}
      />

      <h2>4. useGridView: your own markup</h2>
      <p>
        <code>&lt;Grid&gt;</code> is a thin renderer over <code>useGridView</code>, which returns the grid as data and prop getters. Render the same view
        with different elements and you keep everything the grid does. A getter returns the attributes, handlers and styles of one element; what you pass
        is merged (class names joined, styles merged, event handlers chained).
      </p>
      <CodeBlock
        code={`import { useGridView } from 'data-grid-kit'

function MyGrid(props) {
  const view = useGridView(props)
  return (
    <section {...view.getRootProps({ className: 'card' })}>
      <div {...view.getScrollerProps()}>
        <div {...view.getContentProps()}>
          {/* view.header, view.bodyRows, view.pinnedTop ... are data: draw them how you like */}
          <div {...view.getBodyProps()}>{view.bodyRows.map(renderRow)}</div>
        </div>
      </div>
    </section>
  )
}`}
      />
      <p>
        For no UI code at all, <code>data-grid-kit/core</code> has the headless <code>useGrid</code> (see <a href="#headless">Headless usage</a>).
      </p>

      <h2>Recipes</h2>
      <ul>
        <li><strong>Tailwind:</strong> import <code>structure.css</code> and pass utility classes through <code>slotProps</code> (<code>row</code>, <code>cell</code>, <code>headerCell</code>); use <code>data-*</code> variants such as <code>data-[selected]:bg-sky-50</code>.</li>
        <li><strong>CSS Modules / vanilla-extract:</strong> pass the generated class to <code>slotProps</code>, or select the stable <code>gk-</code> names under your own root class.</li>
        <li><strong>styled-components / Emotion:</strong> <code>styled(defaultSlots.cell)</code> works because slots take <code>className</code>.</li>
        <li><strong>A design system:</strong> set <code>baseButton</code>, <code>baseCheckbox</code>, <code>baseSelect</code>, <code>baseInput</code> and <code>icons</code> once in a wrapper component and reuse it in every grid.</li>
      </ul>

      <h2>Accessibility when you replace markup</h2>
      <p>
        The grid is an ARIA <code>grid</code>: <code>role="row"</code> with <code>aria-rowindex</code>, <code>role="gridcell"</code>,{' '}
        <code>aria-selected</code>, <code>aria-sort</code> and a live region for announcements. Slots receive the props that carry these (for example{' '}
        <code>ariaRow</code>); keep the roles when you change the element, and spread the getters' props on the elements they are meant for.
      </p>
    </>
  ),
}
