import { PropsTable } from '../components/PropsTable'
import { apiMethods, columnProps, gridProps } from '../api'
import { type PageDef } from './shared'

export const page: PageDef = {
  id: 'api',
  group: 'Reference',
  title: 'API reference',
  intro: 'Props, column definition and the imperative API.',
  body: () => (
    <>
      <h2>&lt;Grid&gt; props</h2>
      <PropsTable rows={gridProps} />
      <h2>Column definition</h2>
      <PropsTable rows={columnProps} />
      <h2>Imperative API</h2>
      <p>
        Available from <code>onReady</code>, from an <code>apiRef</code> (<code>const apiRef = useGridApiRef()</code>, then <code>{'<Grid apiRef={apiRef} />'}</code> and{' '}
        <code>apiRef.current</code> in handlers and effects), from <code>useGridApiContext()</code> inside the grid (a slot, <code>renderCell</code>, <code>renderHeader</code>) or from{' '}
        <code>useGrid()</code> (<code>grid.api</code>). <code>useGridSelector((state) =&gt; state.sortModel.length)</code> reads a slice of the state inside the grid and re-renders only
        when it changes.
      </p>
      <PropsTable rows={apiMethods} />
    </>
  ),
}
