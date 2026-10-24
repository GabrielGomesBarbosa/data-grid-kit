import TimeOffDemo from '../demos/TimeOffDemo'
import timeOffSrc from '../demos/TimeOffDemo.tsx?raw'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'demo-time-off',
  group: 'Demos',
  title: 'Time off calendar',
  intro: 'Who is away and when: employees down the side, the days of a month across, holidays, vacations and sick leave drawn in the cells.',
  body: () => (
    <>
      {demo('TimeOffDemo', TimeOffDemo, timeOffSrc)}
      <h2>What it uses</h2>
      <ul>
        <li>One column per day, made from the month: a header with the weekday and the date, <code>renderCell</code> for the icons and the vacation bar.</li>
        <li>The employee column is pinned left and a <strong>pinned row</strong> on top counts who is out each day; it recounts when you hide a leave type.</li>
        <li><code>setQuickFilter</code> for the search, new <code>rows</code> when a chip or the month changes (the grid diffs them), and the row height for the density switch.</li>
      </ul>
      <h2>Compared with MUI's demo</h2>
      <p>
        Same layout and controls. Differences, which are useful feedback on the components:
      </p>
      <ul>
        <li><strong>No column span.</strong> MUI draws a vacation as one cell spanning several days. Here each day is its own cell, styled so the pieces join into a bar. A <code>colSpan</code> on columns is not implemented yet.</li>
        <li><strong>No <code>renderHeader</code>.</strong> The two-line day header is a newline in <code>headerName</code> plus one CSS rule (<code>white-space: pre-line</code>).</li>
        <li><strong>No scroll API.</strong> The Today button sets <code>scrollLeft</code> on the scroller element; there is no <code>api.scrollToColumn</code>.</li>
        <li>Avatars are coloured initials instead of photos, and the flags are emoji.</li>
      </ul>
    </>
  ),
}
