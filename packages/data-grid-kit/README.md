# data-grid-kit

A headless-first React data grid: a store + row pipeline with no UI (`data-grid-kit/core`), and a
ready-made grid component on top of it (`data-grid-kit`). No dependency on any UI library.

## Run it

```bash
npm install
npm run docs        # documentation site with live demos  → http://localhost:5300
npm run dev         # 100k-row playground                 → http://localhost:5199
npm test            # unit + randomized tests (incremental updates are fuzzed against a full rebuild)
npm run typecheck
npm run build       # library → dist/
npx vite-node scripts/bench.ts   # pipeline benchmark in Node
```

## What exists today

Community-tier: sorting (multi-column), typed filtering (+ filter panel, quick filter), pagination,
row selection, cell editing, keyboard navigation (ARIA grid), column menu, columns panel, toolbar,
column resize/hide, CSV export.
Pro/Premium-tier: row + column virtualization, column pinning, row pinning, column reordering by drag
(with a keyboard-accessible menu alternative), tree data, row grouping, live updates
(`api.updateRows` or a new `rows` array are applied incrementally instead of rebuilding),
**aggregation** (sum, avg, min, max, count, size and custom functions, on group rows and a total row),
**cell range selection**, **clipboard** (copy, cut, paste as tab-separated text), a **fill handle**,
**detail panels** (content under a row; fixed, per-row or measured height), **row reordering** (drag or Alt+Shift+arrows), **server-side data** (`dataSource.getRows`: server sort/filter/pages,
lazy loading with skeleton rows, block cache with abort and retry, infinite scroll; no server-side grouping/aggregation yet) and **pivoting** (rows × columns × values with nested column
groups, incremental on live updates; client-side data) and **Excel export** (`api.exportXlsx` / `getXlsx`: dependency-free .xlsx with typed cells, number formats,
merged column groups and outline levels for group rows).

All features of the MUI X roadmap that were in scope are implemented; see the feature-status page for the honest limits.
The docs site has a feature-status page with the full, honest list, and a Light / Dark / System theme switch
(the grid follows the system theme, or `data-theme="light|dark"` on `<html>`).

## Layout of this package

- `src/core` — store, pipeline (tree → filter → sort → flatten, each stage memoised), layout and
  virtualization math, keyboard navigation, CSV / xlsx, `useGrid`.
- `src/ui` — `Grid`, editors, panels, popover, styles.
- `scripts` — Node benchmarks (`npm run bench`).

The documentation site and example apps live in the repository root, under `apps/`.
