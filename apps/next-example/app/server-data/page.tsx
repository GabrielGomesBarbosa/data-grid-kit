import { ServerGrid } from '../../components/ServerGrid'

export default function Page() {
  return (
    <>
      <p className="note">
        100,000 rows live behind a Route Handler (<code>app/api/employees/route.ts</code>). The grid loads blocks as you scroll, caches them and aborts requests it no
        longer needs. Sorting and the quick filter run on the server.
      </p>
      <ServerGrid />
    </>
  )
}
