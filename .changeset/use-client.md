---
'data-grid-kit': patch
---

Next.js: the package entries are marked `'use client'`, so a Server Component can import `Grid` directly (serializable props only). The build fails if the directive is lost.
