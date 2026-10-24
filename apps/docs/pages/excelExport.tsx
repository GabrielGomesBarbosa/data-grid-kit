import ExcelExportDemo from '../demos/ExcelExportDemo'
import excelSrc from '../demos/ExcelExportDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'excel-export',
  group: 'Advanced features',
  title: 'Excel export',
  intro: 'Download the grid as a real .xlsx file: typed cells, number formats, merged column groups, collapsible group rows. No dependencies.',
  body: () => (
    <>
      {demo('ExcelExportDemo', ExcelExportDemo, excelSrc)}
      <h2>Using it</h2>
      <p>
        The toolbar's <strong>Export</strong> menu has <em>Download Excel (.xlsx)</em>. From code, <code>await api.exportXlsx(options)</code> downloads the file
        and <code>await api.getXlsx(options)</code> gives you the bytes (a <code>Uint8Array</code>) to upload or post-process. The file has what the grid shows:
        visible columns in their order, rows as filtered and sorted, <em>every</em> row of a group (collapsed or not, not only the current page).
      </p>
      <div className="table-wrap">
        <table className="props">
          <thead>
            <tr><th>Option</th><th>Default</th><th>What it does</th></tr>
          </thead>
          <tbody>
            <tr><td><code>fileName</code></td><td>export.xlsx</td><td>Name of the download (<code>exportXlsx</code>).</td></tr>
            <tr><td><code>sheetName</code></td><td>Sheet1</td><td>Worksheet name; characters Excel forbids are replaced and it is cut to 31.</td></tr>
            <tr><td><code>includeHeaders</code></td><td>true</td><td>Title row and, for pivot tables, the column group rows above it.</td></tr>
            <tr><td><code>selectedOnly</code></td><td>false</td><td>Only the selected rows (group rows are kept).</td></tr>
            <tr><td><code>formatted</code></td><td>false</td><td>Write numbers, dates and booleans as the text the grid shows instead of typed cells.</td></tr>
            <tr><td><code>numFmts</code></td><td>-</td><td>Excel number format per field, e.g. <code>{'{ salary: \'$#,##0\' }'}</code>.</td></tr>
            <tr><td><code>freezeHeader</code></td><td>true</td><td>Keep the header rows in view while scrolling.</td></tr>
            <tr><td><code>autoFilter</code></td><td>false</td><td>Filter buttons on the title row (not with column groups, where they would sit under merged cells).</td></tr>
            <tr><td><code>compress</code></td><td>true</td><td>Deflate the parts (smaller files; stored when the browser has no <code>CompressionStream</code>).</td></tr>
            <tr><td><code>onProgress</code>, <code>signal</code></td><td>-</td><td>Rows written so far; an <code>AbortSignal</code> to cancel (rejects with <code>AbortError</code>).</td></tr>
          </tbody>
        </table>
      </div>
      <h2>What goes in a cell</h2>
      <ul>
        <li><strong>Numbers, booleans and dates are typed cells</strong>, not text, so Excel can sum, sort and format them. The grid's <code>valueFormatter</code> is not applied to them (use <code>numFmts</code> for Excel formats); other columns are written as their formatted text, and <code>singleSelect</code> as the option's label.</li>
        <li><strong>Dates</strong> are written as the wall-clock date and time (Excel has no time zones) with the format <code>yyyy-mm-dd</code>.</li>
        <li><strong>Text is never a formula.</strong> Values are stored as inline strings, so <code>=1+1</code> stays text and no CSV-style escaping is needed.</li>
        <li><strong>Group rows</strong> carry their label and aggregates and are bold; their rows are <em>outline levels</em>, so Excel can collapse them with the +/− buttons. A total row follows when the grid has one.</li>
        <li><strong>Pivot tables</strong> export with their column groups as merged header cells and the numbers as numbers.</li>
        <li>Empty values leave the cell empty; <code>NaN</code>, infinities and invalid dates too. Text over Excel's 32,767-character limit is cut.</li>
      </ul>
      <h2>How it differs from MUI</h2>
      <p>
        MUI loads a forked ExcelJS (a large dependency, imported on demand), builds the whole workbook as objects, one per row and cell, then serialises it,
        optionally in a web worker. data-grid-kit writes the XML itself: rows are turned into text as they are read and the ZIP is assembled from those pieces, so the
        memory used is about the size of the output, and the page stays responsive because the writer yields to the event loop every few thousand rows (and can be cancelled).
        The price is features ExcelJS has: no data validation lists for <code>singleSelect</code>, no per-cell styles, no formulas, no images, no multiple sheets, and
        no <code>exceljsPreProcess</code> / <code>exceljsPostProcess</code> hooks.
      </p>
      <h2>Limits</h2>
      <ul>
        <li>Excel's own limits apply: 1,048,576 rows and 16,384 columns. Exporting more rejects with a clear message; filter the data or export in parts.</li>
        <li>One sheet. The archive is not ZIP64, so the file must stay under 4 GB.</li>
        <li>With server-side data only the rows that have been loaded are exported.</li>
        <li>Validated by reading the files back with an independent library (openpyxl) and by tests of the XML; it has not been opened in Excel or LibreOffice here, so check the output in the programs you target.</li>
      </ul>
      <h2>What it costs</h2>
      <p>
        Measured in Node (writing 6 typed columns, no grid): 100,000 rows take about 280 ms and make a 3.2 MB file (150 ms and 26 MB if you pass{' '}
        <code>compress: false</code>); 500,000 rows take about 1.3 s and 16 MB. Time is spent in a few yields to the event loop, not in one long block, so the
        interface keeps responding.
      </p>
    </>
  ),
}
