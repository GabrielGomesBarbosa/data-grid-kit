# gridkit

A headless-first React data grid: a store + row pipeline with no UI (`gridkit/core`), and a
ready-made grid component on top of it (`gridkit`). No dependency on any UI library.

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

## Layout

- `src/core` — store, pipeline (tree → filter → sort → flatten, each stage memoised), layout and
  virtualization math, keyboard navigation, CSV, `useGrid`.
- `src/ui` — `Grid`, editors, panels, popover, styles.
- `docs` — documentation site (every demo is a real file shown as its own source).
- `playground` — large-data sandbox. `scripts/bench.ts` — Node benchmark.

## Notes on provenance

Features were designed by studying the documented behavior and the structure of MUI X Data Grid
(Community, Pro and Premium). No code from the commercial packages was copied; the implementation
is original.
