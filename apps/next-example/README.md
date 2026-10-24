# next-example

A Next.js (App Router) app using `data-grid-kit`.

| Route | Shows |
|---|---|
| `/` | A Server Component passes rows to a Client Component grid. The first page is server-side rendered. |
| `/server-data` | Server-side data: `dataSource.getRows` backed by a Route Handler (`app/api/employees`). |
| `/no-ssr` | The same grid with `next/dynamic` and `ssr: false`, the fallback if SSR ever gives trouble. |

```bash
npm install                 # at the repository root
npm run build               # builds the library, then this app
npm run dev -w next-example # http://localhost:5500 (the library must be built)
```

Notes
- The grid uses state and effects, so import it from a file with `"use client"` (see `components/TeamGrid.tsx`).
- Import the stylesheet once, in the root layout: `import 'data-grid-kit/styles.css'`.
