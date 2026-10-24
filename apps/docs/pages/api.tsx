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
        Available from <code>onReady</code> or from <code>useGrid()</code> (<code>grid.api</code>).
      </p>
      <PropsTable rows={apiMethods} />
    </>
  ),
}
