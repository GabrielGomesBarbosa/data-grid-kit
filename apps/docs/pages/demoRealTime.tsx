import RealTimeDemo from '../demos/RealTimeDemo'
import realTimeSrc from '../demos/RealTimeDemo.tsx?raw'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'demo-real-time',
  group: 'Demos',
  title: 'Real-time data',
  intro: 'A market table that changes several times a second: a flash on every new price, a trend line per row, sorting and filtering while it moves.',
  body: () => (
    <>
      {demo('RealTimeDemo', RealTimeDemo, realTimeSrc)}
      <h2>What it uses</h2>
      <ul>
        <li><code>api.updateRows</code>: each tick sends 3 to 5 changed rows. Only those rows render again (the rest keep their identity), so the update rate can be high.</li>
        <li><code>renderCell</code> for the symbol badge, the trend line (an SVG built from the row's history) and the price pill; the pill's flash is a CSS animation replayed by a changing <code>key</code>.</li>
        <li>The default toolbar (columns, filters, export, quick search). Try sorting by <strong>% Change</strong> or filtering while it runs: the order follows the data.</li>
      </ul>
      <h2>Compared with MUI's demo</h2>
      <p>
        Same idea (a stock table with a coloured price, change columns and a sparkline per row; it has company logos where this has coloured badges). Notes for feedback:
        a column has <code>renderCell</code> but no <code>renderHeader</code> and no <code>cellClassName</code>, so colours come from elements inside the cell; the sparkline is drawn by hand because the grid has no chart cell.
      </p>
    </>
  ),
}
