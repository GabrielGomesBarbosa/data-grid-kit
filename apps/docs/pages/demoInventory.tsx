import InventoryDemo from '../demos/InventoryDemo'
import inventorySrc from '../demos/InventoryDemo.tsx?raw'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'demo-inventory',
  group: 'Demos',
  title: 'Inventory',
  intro: 'A product dashboard: status tabs, product pictures, ratings, a detail panel with a restock button and a footer that adds up profit and sales.',
  body: () => (
    <>
      {demo('InventoryDemo', InventoryDemo, inventorySrc)}
      <h2>What it uses</h2>
      <ul>
        <li>The tabs set a filter on the <code>status</code> column (<code>setFilterModel</code>), so they combine with the search box and the column filters.</li>
        <li><code>renderCell</code> for the product tile, the status chip and the stars; a <code>singleSelect</code> column for the status.</li>
        <li>The <strong>detail panel</strong> (chevron on the left) with a chart and a button that edits the row through <code>api.updateRows</code>; the status and stock change on screen, and the tabs react.</li>
        <li><strong>Aggregation</strong> in the total row: the sales column uses <code>sum</code>, the cost column a custom <code>profit</code> function (price minus cost, times sales) registered in <code>aggregationFunctions</code>.</li>
      </ul>
      <h2>Compared with MUI's demo</h2>
      <ul>
        <li>Same structure. Product pictures are coloured tiles with an emoji instead of photos.</li>
        <li>The second line in the Cost and Sales headers ("profit", "sum") is typed into <code>headerName</code>: there is no <code>renderHeader</code>, and the grid does not show the aggregation function in the header by itself.</li>
        <li>The total row sits at the bottom of the grid, as in MUI; it has no label such as "Profit:" next to the value.</li>
      </ul>
    </>
  ),
}
