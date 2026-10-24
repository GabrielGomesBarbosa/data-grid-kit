'use client'

import dynamic from 'next/dynamic'
import type { Employee } from '../lib/data'

// If you ever see a hydration warning in your own setup, rendering the grid only in the browser is the fallback:
// next/dynamic with ssr: false skips the server render (and the first page is no longer in the HTML).
const TeamGrid = dynamic(() => import('./TeamGrid').then((m) => m.TeamGrid), {
  ssr: false,
  loading: () => <p className="note">Loading the grid…</p>,
})

export function BrowserOnlyGrid({ rows }: { rows: Employee[] }) {
  return <TeamGrid rows={rows} />
}
