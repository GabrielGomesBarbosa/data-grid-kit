# data-grid-kit

## 0.4.0

### Minor Changes

- Touch: dragging a column header or selecting a cell range now works with a finger. Hold for 350 ms to start; moving earlier is a scroll and the browser pans as usual. While a held drag is on, the page does not scroll under the finger. Row drag handles, the fill handle and pivot grips already used `touch-action: none` and start at once.

### Patch Changes

- 2e60db2: Accessibility tests: axe-core runs over the default grid, the grid with checkboxes / toolbar / pager and a grid with a custom cell slot (structural ARIA rules), and the grid roles and counts (`aria-rowcount`, `aria-colcount`, `aria-rowindex`) are asserted.
- d6564f9: The package now ships ESM and CommonJS builds (`require('data-grid-kit')` works) with matching type declarations (`.d.ts` / `.d.cts`) and a `typesVersions` fallback for `data-grid-kit/core` under classic `node10` resolution. Both formats share one copy of the code between the two entries, so `instanceof` checks (for example `DataSourceError`) agree. `publint` and `arethetypeswrong` run as part of `npm run check`.
- bf0fc30: Next.js: the package entries are marked `'use client'`, so a Server Component can import `Grid` directly (serializable props only). The build fails if the directive is lost.

## 0.3.0

### Minor Changes

- Customizable architecture. Every part of the grid is a replaceable **slot** (`toolbar`, `footer`, `row`, `cell`, `headerCell`, overlays, column menu, panels, popover, base controls `baseButton` / `baseCheckbox` / `baseSelect` / `baseInput`, and 16 `icons`) with `slotProps` merged over the internal props. An **unstyled mode** ships `structure.css` (layout only) and `theme.css` (the default look) next to `styles.css`, and state is exposed as `data-*` attributes. `useGridView` returns the grid as data and prop getters (with `mergeProps`) so you can render your own markup; `<Grid>` is a thin renderer over it. A custom `row` slot is memoised by the grid (`rowPropsEqual`, exported), and scrolling by a row no longer re-renders every row. Adds the Customization guide, a public API policy and a test that snapshots the exports.

## 0.2.1

### Patch Changes

- Internal restructuring with no API change: the row pipeline, `useGrid`, the data source and the grid UI are split into small modules (no source file over 500 lines, enforced by lint), one pointer-drag helper replaces three copies, and the stylesheet is built from per-feature partials (same CSS output).

## 0.2.0

### Minor Changes

- 5322b6b: Server-side rendering fixes: `useGrid` now provides a server snapshot for its external stores and avoids layout-effect warnings during SSR.
