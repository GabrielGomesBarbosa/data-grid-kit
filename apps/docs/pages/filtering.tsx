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
            <tr><td>string</td><td>contains, does not contain, equals, does not equal, starts with, ends with, is empty, is not empty, is any of</td></tr>
            <tr><td>number, date</td><td>=, ≠, &gt;, ≥, &lt;, ≤, is empty, is not empty, is any of (values are parsed as numbers / local dates)</td></tr>
            <tr><td>singleSelect</td><td>is, is not, is any of</td></tr>
            <tr><td>boolean</td><td>is</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        A filter whose value can't be parsed (for example text in a number filter) is ignored rather than hiding every row. In tree data
        a row stays visible when it or any descendant matches; with grouping, groups with no matching rows disappear and their counts
        reflect the filter.
      </p>
      <h2>Your own operators, and accents</h2>
      <ul>
        <li>
          <code>filterOperators</code> on a column replaces the operators the panel offers for it. Each one has a <code>value</code>, a <code>label</code>,
          <code> getApplyFilterFn(item, col)</code> (returns <code>(cellValue, row) =&gt; boolean</code>, or <code>null</code> while the filter is not complete) and
          optionally <code>renderInput</code> for its own value control (a range, a rating...). An operator without a function keeps the built-in logic of its
          <code> value</code>. Spread <code>getFilterOperators(column)</code> to extend the built-in list instead of replacing it.
        </li>
        <li>
          <code>ignoreDiacritics</code> makes <code>cafe</code> find <code>café</code> in the filter panel and the quick filter. Sorting and server-side filters are not
          affected.
        </li>
        <li>
          <strong>Is any of</strong> takes a list, typed with commas (<code>a, b, c</code>) or set as an array in the filter model.
        </li>
      </ul>
      <CodeBlock
        title="controlled filter model"
        code={`<Grid\n  state={{ filterModel }}\n  onStateChange={(next, prev) => {\n    if (next.filterModel !== prev.filterModel) setFilterModel(next.filterModel)\n  }}\n/>`}
      />
    </>
  ),
}
