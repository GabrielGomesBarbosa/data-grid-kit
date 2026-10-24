import { TeamGrid } from '../components/TeamGrid'
import { makeEmployees } from '../lib/data'

// A Server Component: it builds the rows on the server and hands them to the Client Component that draws the grid.
// The first page of the grid is already in the HTML that arrives in the browser (server-side rendering).
export default function Page() {
  const rows = makeEmployees(500)
  return (
    <>
      <p className="note">
        This page is a Server Component. It creates 500 rows on the server and passes them to <code>TeamGrid</code>, a Client Component that renders the grid. View
        the page source to see the first rows in the HTML.
      </p>
      <TeamGrid rows={rows} />
    </>
  )
}
