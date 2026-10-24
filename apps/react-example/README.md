# react-example

A small Vite + React app that uses `data-grid-kit` the way a consumer would: `import { Grid } from 'data-grid-kit'` and
`import 'data-grid-kit/styles.css'`. It also shows the grid inside a product-style page (header, key figures, a card), in a light and a dark theme.

- **People directory** (`src/TeamPage.tsx`): sorting, filtering, editing, pagination, row grouping, a pivot view and Excel export, with the
  data kept in your own state. Copy this file into your own project as a starting point.
- **Stress test** (`src/StressPage.tsx`): up to 500,000 rows with grouping, tree data, pinning, detail panels and cell selection.

```bash
npm run dev     # from this folder or from the repository root: npx turbo run dev --filter=react-example   → http://localhost:5400
npm run build   # uses the built package, not the source
```

The animation and screenshots in the repository README are recorded from this app with `tools/media` (see below).

## Recording the README media

```bash
npm run dev -w react-example           # the example must be running
node tools/media/capture.mjs           # drives Chrome headlessly and saves PNG frames (needs Google Chrome)
python3 tools/media/assemble.py        # builds docs/media/demo.gif and screenshot-dark.png (needs Pillow)
```
