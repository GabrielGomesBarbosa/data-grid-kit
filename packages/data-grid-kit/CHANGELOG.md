# data-grid-kit

## 0.5.0

### Minor Changes

- 7bd095f: Cursor-based pagination in `dataSource`: a response can carry `pageInfo.nextCursor` (`null` on the last page) and the grid sends it back as `params.cursor` with the request for the rows after it. The grid keeps the cursors and fetches blocks in order (a jump ahead walks the pages in between, each cached); a new sort or filter starts over.
- b1b35f8: Pivot: click a value or total column header to order the groups of every level by that aggregate (empty values last; paging and exports follow); `hidden` on column and value entries and `hiddenRows` keep a field in the pivot model without using it, with a checkbox for each in the panel; a field can be a value more than once with different functions (`+` in the panel). New core helpers: `setPivotHidden`, `addPivotValue`, `removePivotValue`, `moveValueEntry`, `setValueFunc`, `visiblePivot`, `pivotAggSortOf`.
- 80809fb: Variable row height: `getRowHeight({ id, row, depth })` returns a number, `null` / `undefined` for `rowHeight`, or `'auto'` to size the row to its content (measured on screen, with `getEstimatedRowHeight` until then). Positions come from a prefix sum with binary search, so virtualization stays fast, and detail panels sit under their own row. When a row above the visible ones is measured, the scroll position moves by the same amount so nothing jumps. As in MUI, columns are not virtualized while there are `'auto'` rows (`virtualizeColumnsWithAutoRowHeight` turns it back on). `useGrid` returns `reportRowHeights` for custom renderers.
- e7f7016: Tree data, row grouping and aggregation on the server. A data source with `getChildrenCount(row)` and `getGroupKey(row)` is a tree loaded level by level: `getRows` gets `groupKeys` (the path to the parent) when a row is expanded, plus `groupFields` (the row grouping model) and `aggregationModel`; rows with children show `getAggregatedValue(row, field)`. Each open level has its own blocks, errors and retries; all share one cache keyed by level, so reopening a row sends nothing. Needs `pagination={false}`; pivoting stays client-side.
- c16747b: Excel export: `headerStyle` and `columnStyles` (bold, italic, text colour, fill, alignment, wrap), `validateSelects` (a drop-down for `singleSelect` columns), `extraSheets` (more worksheets in the same file) and, in `data-grid-kit/core`, `buildXlsxWorkbook(sheets)` plus explicit formula cells (`{ formula, value }`). Text that starts with `=` is still text. The worker export carries the extra sheets too.
- 1a4849f: Excel export in a web worker: `getXlsx` / `exportXlsx` accept `worker: () => new Worker(...)`. The package ships a ready worker, `data-grid-kit/xlsx-worker` (self-contained, about 10 KB, no React), and `setupXlsxWorker()` in `data-grid-kit/core` for your own worker file. Rows are sent in batches so the page stays responsive; abort, progress and errors work as without a worker.

### Patch Changes

- cab8f57: Fast scrollbar drags no longer paint an empty region first: when a scroll leaves the rendered rows, the new window is committed inside the scroll event (`flushSync`) instead of on the next animation frame. Scrolls that stay inside the window are still batched to one store write per frame.

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
