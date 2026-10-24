import { BrowserOnlyGrid } from '../../components/BrowserOnlyGrid'
import { makeEmployees } from '../../lib/data'

export default function Page() {
  return (
    <>
      <p className="note">The same grid, rendered only in the browser with <code>next/dynamic</code> and <code>ssr: false</code>.</p>
      <BrowserOnlyGrid rows={makeEmployees(500)} />
    </>
  )
}
