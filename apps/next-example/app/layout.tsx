import type { ReactNode } from 'react'
import Link from 'next/link'
// the stylesheet is plain CSS: import it once in the root layout
import 'data-grid-kit/styles.css'
import './globals.css'

export const metadata = { title: 'data-grid-kit · Next.js example' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>data-grid-kit · Next.js example</h1>
          <nav>
            <Link href="/">Client grid (SSR)</Link>
            <Link href="/server-data">Server-side data</Link>
            <Link href="/no-ssr">Browser-only grid</Link>
          </nav>
          {children}
        </main>
      </body>
    </html>
  )
}
