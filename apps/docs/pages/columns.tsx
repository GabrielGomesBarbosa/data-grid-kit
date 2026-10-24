import ColumnsDemo from '../demos/ColumnsDemo'
import columnsSrc from '../demos/ColumnsDemo.tsx?raw'
import { PropsTable } from '../components/PropsTable'
import { columnProps, features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'columns',
  group: 'Main features',
  title: 'Columns',
  intro: 'Typed columns, computed values, custom rendering and per-column switches.',
  body: () => (
    <>
      {demo('ColumnsDemo', ColumnsDemo, columnsSrc)}
      <p>
        Open the toolbar's <strong>Columns</strong> panel to show the hidden ID column, or drag a header edge to resize.
      </p>
      <h2>Column definition</h2>
      <PropsTable rows={columnProps} />
    </>
  ),
}
