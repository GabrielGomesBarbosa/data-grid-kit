import { useState } from 'react'
import { StressPage } from './StressPage'
import { TeamPage } from './TeamPage'

const pages = { team: 'Team directory', stress: 'Stress test (100,000 rows)' } as const
type PageId = keyof typeof pages

export function App() {
  const [page, setPage] = useState<PageId>('team')
  return (
    <main>
      <h1>data-grid-kit · React example</h1>
      <p className="lead">The library used like an app would use it: installed as a package, styled with its stylesheet.</p>
      <div className="tabs" role="tablist">
        {(Object.keys(pages) as PageId[]).map((id) => (
          <button key={id} role="tab" aria-selected={page === id} onClick={() => setPage(id)}>
            {pages[id]}
          </button>
        ))}
      </div>
      {page === 'team' ? <TeamPage /> : <StressPage />}
    </main>
  )
}
