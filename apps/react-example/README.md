# react-example

A small Vite + React app that uses `data-grid-kit` the way a consumer would: `import { Grid } from 'data-grid-kit'` and
`import 'data-grid-kit/styles.css'`.

- **Team directory** (`src/TeamPage.tsx`): sorting, filtering, editing, pagination, row grouping, a pivot view and Excel export.
  Copy this file into your own project as a starting point.
- **Stress test** (`src/StressPage.tsx`): up to 500,000 rows with grouping, tree data, pinning, detail panels and cell selection.

```bash
npm run dev     # from this folder or from the repository root: npx turbo run dev --filter=react-example
npm run build   # uses the built package, not the source
```
