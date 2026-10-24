import FilteringDemo from '../demos/FilteringDemo'
import filteringSrc from '../demos/FilteringDemo.tsx?raw'
import { CodeBlock } from '../components/CodeBlock'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'filtering',
  group: 'Main features',
  title: 'Filtering',
  intro: 'Typed operators, and/or logic, a filter panel and a quick filter.',
  body: () => (
    <>
      {demo('FilteringDemo', FilteringDemo, filteringSrc)}
      <h2>Operators by column type</h2>
      <div className="table-wrap">
        <table className="props">
          <tbody>
            <tr><td>string</td><td>contains, equals, starts with, ends with, is empty, is not empty</td></tr>
            <tr><td>number, date</td><td>=, &gt;, ≥, &lt;, ≤, is empty, is not empty (values are parsed as numbers / local dates)</td></tr>
            <tr><td>boolean, singleSelect</td><td>is</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        A filter whose value can't be parsed (for example text in a number filter) is ignored rather than hiding every row. In tree data
        a row stays visible when it or any descendant matches; with grouping, groups with no matching rows disappear and their counts
        reflect the filter.
      </p>
      <CodeBlock
        title="controlled filter model"
        code={`<Grid\n  state={{ filterModel }}\n  onStateChange={(next, prev) => {\n    if (next.filterModel !== prev.filterModel) setFilterModel(next.filterModel)\n  }}\n/>`}
      />
    </>
  ),
}
