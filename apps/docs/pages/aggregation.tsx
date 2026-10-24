import AggregationDemo from '../demos/AggregationDemo'
import aggregationSrc from '../demos/AggregationDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'aggregation',
  group: 'Advanced features',
  title: 'Aggregation',
  intro: 'Sum, average, min, max and counts, on group rows and in a total row, following the filter.',
  body: () => (
    <>
      {demo('AggregationDemo', AggregationDemo, aggregationSrc)}
      <h2>Choosing functions</h2>
      <p>
        Pass <code>initialState.aggregationModel</code> (<code>{'{ salary: \'sum\' }'}</code>), call{' '}
        <code>api.setAggregation(field, name | null)</code>, or use <strong>Aggregate</strong> in a column's ⋮ menu. Which functions a column offers
        depends on its type (and on <code>aggregable</code> / <code>availableAggregationFunctions</code>).
      </p>
      <div className="table-wrap">
        <table className="props">
          <thead>
            <tr><th>Function</th><th>Result</th><th>Columns</th></tr>
          </thead>
          <tbody>
            <tr><td><code>sum</code></td><td>sum of the numbers; <code>null</code> if there are none</td><td>number</td></tr>
            <tr><td><code>avg</code></td><td>sum ÷ how many numbers</td><td>number</td></tr>
            <tr><td><code>min</code>, <code>max</code></td><td>smallest / largest value (numbers, dates, text)</td><td>number, date</td></tr>
            <tr><td><code>count</code></td><td>how many non-empty values</td><td>any</td></tr>
            <tr><td><code>size</code></td><td>how many rows</td><td>any</td></tr>
            <tr><td>your own</td><td><code>apply({'{ values, rows }'})</code> over every value in the group</td><td>as you declare</td></tr>
          </tbody>
        </table>
      </div>
      <h2>Where it shows</h2>
      <ul>
        <li><strong>Group rows</strong> show the aggregate of everything below them, in the columns that have a function. Tree parents show the aggregate of their <em>descendants</em> (not their own row).</li>
        <li>
          A <strong>total row</strong> sits at the bottom, over every row that passes the filter (<code>aggregationFooter={'{false}'}</code> hides it). It is sticky,
          like pinned rows.
        </li>
        <li>Only rows that pass the filter count. Filtering changes the aggregates and the counts together.</li>
        <li>The value goes through the column's <code>valueFormatter</code> (called without a row, so keep it a function of the value); counts show as plain numbers.</li>
      </ul>
      <h2>Cost</h2>
      <p>
        Built-in functions keep running totals on every group, so a changed row adjusts its ancestors in O(depth) (see <a href="#/live-updates">Live updates</a>):
        editing a salary in a 100,000-row grouped grid with sum and average costs about the same with aggregation on or off (0.24 ms vs 0.23 ms).
        Only <code>min</code> / <code>max</code> sometimes recompute a group, when the row that was the extreme leaves it. Custom functions
        read every value in the group each time the data changes, so they cost O(group size) per visible group.
      </p>
      <p className="muted">
        Floating-point sums are maintained by adding and subtracting, so after many live edits they can differ from a fresh sum in the last digits.
      </p>
    </>
  ),
}
