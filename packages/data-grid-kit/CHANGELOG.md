# data-grid-kit

## 0.10.0

### Minor Changes

- 2893a12: Column autosize. `api.autosizeColumns(options)` fits columns to their header and the cells that are on screen (within `minWidth` / `maxWidth`; outliers are ignored unless asked), a double click on a column's divider fits that column, and `autosizeOnMount` does it once when the first rows appear. Headless renderers register their own measurer with `api.setColumnMeasurer`.
- 4e1e71d: Two column types. `type: 'dateTime'` holds a `Date` with its time: shown with date and time in the grid's locale, edited and filtered with a date-time input, copied and pasted as `yyyy-mm-ddThh:mm`, exported to CSV in local time and to Excel as `yyyy-mm-dd hh:mm`. `type: 'actions'` is a column of buttons from `getActions({ id, row, field })` (an action with `showInMenu` goes in a ⋮ menu; `href` makes a link); it is never sorted, filtered, edited, grouped, aggregated or exported.
- ef44327: Density, "no results" and rows per page. `density` (`compact` / `standard` / `comfortable`, in the state, with `api.setDensity` and a `<DensityButton />` / `densitySelector` toolbar button) scales row and header heights. A filter that leaves no row now shows its own message (`noResults`, slot `noResultsOverlay`) instead of "No rows". `pageSizeOptions` adds a "Rows per page" select to the footer (`-1` for every row) and `autoPageSize` fits the page to the grid's height. Rows with no filter active show the same as before.
- 6b2c217: Events and styling hooks. `onRowClick`, `onRowDoubleClick`, `onCellClick`, `onCellDoubleClick`, `onCellKeyDown`, `onColumnHeaderClick` and `onColumnHeaderDoubleClick` report what was hit (and `event.preventDefault()` stops what the grid would do with it). `cellClassName` (column), `getCellClassName` and `getRowClassName` (grid) add class names from the data. Columns get `renderHeader`, `headerAlign`, `description` (a header tooltip) and `headerClassName`.
- b9575c9: More filter operators, your own operators, and accent-insensitive matching. Text columns get "does not contain", "does not equal" and "is any of"; number and date columns get "≠" and "is any of"; pick-one columns get "is not" and "is any of". A column can bring its own `filterOperators` (with `getApplyFilterFn` and an optional `renderInput`), and `getFilterOperators(col)` is the starting point to extend the built-in list. `ignoreDiacritics` makes accented and plain letters match in the filter panel and the quick filter.
- a93354b: Fluid columns. `flex` on a column shares the width the other columns leave free, in proportion (`flex: 2` gets twice the share of `flex: 1`), within `minWidth` and `maxWidth`; a column the user resizes becomes fixed. `maxWidth` also caps any fixed column. Columns without `flex` behave as before.
- 1e5ea92: Row selection modes. `rowSelectionOnClick` selects rows by clicking (click, Ctrl/Cmd+click, Shift+click for a range, Space, Ctrl/Cmd+A), `multipleRowSelection={false}` keeps one row at a time, and `isRowSelectable` marks rows that cannot be selected (disabled checkbox, skipped by ranges and select-all). New `api.setSelection(ids)`, `api.selectAll()` and `api.isRowSelectable(id)`. Nothing changes unless you set these props.
- d7ffa94: Scroll API. `api.scrollToRow(id)`, `scrollToColumn(field)`, `scrollToCell(id, field)` and `scrollToIndexes({ rowIndex, colIndex })` scroll to a row and / or column ('nearest' by default, or `'start'`, `'center'`, `'end'`), accounting for the header, pinned columns and rows, per-row heights and open detail panels. `initialState.scroll` now puts the grid at that position when it appears.

## 0.9.0

### Minor Changes

- f239b64: Localization. `localeText` replaces any of the texts the grid shows (labels, tooltips, placeholders, messages, the headers of generated pivot columns): a key holds a string, or a function when the text has a name or a number in it, and what you leave out stays in English. `locale` sets the locale of numbers and dates (cells, groups, aggregates, the footer, the Excel export). A Brazilian Portuguese pack is in the new `data-grid-kit/locales` entry (`<Grid {...ptBR} />`), `useLocaleText()` gives your own slots the same texts, and `grid.text` / `grid.locale` are on the grid instance for headless use. Nothing changes for an app that sets neither prop.

## 0.8.2

### Patch Changes

- 3a78fb0: A column menu no longer hangs in the air when the grid is scrolled sideways: the button moves and the menu cannot follow it without shaking, so the menu closes. Scrolling the page does not close it (the menu moves with the page).
- 628773c: Popovers stay glued to their button when the page scrolls, without shaking and without closing. They are positioned in page coordinates, so the browser moves them with the scroll and no script runs on the way. They no longer look for the button under the anchor either, which put the column menu of some columns (Price) off its button.
- 3723d1e: A popover too tall for the room under its button no longer flickers between two sizes (the column menu of a numeric column): it is measured at its natural height every time, and it scrolls inside when capped.

## 0.8.1

### Patch Changes

- 7bd22fe: Column headers: the title no longer picks up a host page's `button` styles (a dark box on hover, a border, a faded label on columns that cannot be sorted): it says what it looks like itself. The dividers between columns, which were only visible under the pointer, are always drawn as a thin line, and widen to a soft bar when hovered.

## 0.8.0

### Minor Changes

- 307eb67: The pivot panel is docked at the right inside the grid's frame (as in MUI): the grid narrows to make room, keeps its scroll position, and the panel stays open while you work, scrolls on its own and closes with its X, the toolbar button or Escape. `pivotPanelMode: 'docked' | 'popover'` chooses (docked by default; `'popover'` is the previous behaviour). The grid's content now sits in a `gk-main` element next to the optional `gk-dock`. The toolbar wraps to a second line when the grid is narrow instead of cutting buttons off.

## 0.7.2

### Patch Changes

- 3d4c56e: Pivot panel redesigned after MUI's: a Pivot switch with a close button, a field search with a magnifier, the unused fields first (each with a +), then Rows, Columns and Values as foldable sections with a count. Entries show their actions on hover or focus, and each has a checkbox to switch it off. The panel is a fixed 340 px wide and takes `onClose` through `PanelProps`.

## 0.7.1

### Patch Changes

- 3597257: Filter panel: the remove button is always live and shows the pointer cursor. Removing the last row (a filter, or the blank one the panel opens with) closes the panel, like closing a dialog you are finished with. `PanelProps` gets an optional `onClose`.

## 0.7.0

### Minor Changes

- 21f60f9: Popovers line their right edge up with the button when they do not fit on its left edge (they used to be pushed against the window edge), and they follow the button when the page or a container scrolls. The filter panel is redesigned: outlined fields with their names (Column, Operator, Value), a quiet remove icon first in each row, and Add filter / Remove all with icons along the bottom. The `close` icon is now a line icon, and `add` and `trash` are new replaceable icons (23 in all).
- 21f60f9: The filter panel opens on one ready row (no "No filters" text to click past): the row is only shown, and becomes a filter when you change something in it. The Filters button counts only filters that filter (a row with nothing typed is not counted). Popovers move the focus inside once they are positioned (a hidden element cannot take focus, so it never worked in a browser) and the filter panel's value box gets it.

### Patch Changes

- 21f60f9: Docs: the price flash in the real-time demo keeps its round corners (the flash is a layer that fades, instead of animating the pill's background and shadow).
- 2da47c8: The no-columns state is a message ("No columns are visible. Check the column visibility settings.") instead of a message with a button: the Manage columns button opened its panel away from the button when the page was scrolled. `NoRowsOverlayProps.onManageColumns` is removed (it was added in 0.6.0).

## 0.6.0

### Minor Changes

- cd0a34c: Columns panel: a search box, one tri-state Show/Hide All checkbox and Reset (back to each column's own `hidden`). Every column can now be hidden: the grid shows "No columns" with a Manage columns button that opens the panel. New `api.setColumnVisibilityModel(model)` replaces the visibility of all columns at once; `NoRowsOverlayProps` gets `onManageColumns`; `GridView` gets `openPanel`.
- 1ba08d9: The toolbar is made of exported parts: `Toolbar`, `ToolbarTitle`, `ToolbarSeparator`, `ToolbarButton`, `ColumnsButton`, `FilterButton`, `PivotButton`, `ExportButton`, `QuickFilter` and `useToolbar()` (the grid provides a context around `slots.toolbar`), so a toolbar of your own can mix them with any controls. The default toolbar is now a bar of icon buttons with tooltips, a title (`slotProps.toolbar.title`) and a quick search that opens from its button. Five new replaceable icons: `columns`, `filter`, `pivot`, `download`, `search`. Behaviour change: the quick search box is opened from its button instead of always visible.

### Patch Changes

- d7ebccc: Popovers (filter panel, column menu, panels) stay inside the window when their content grows or the window is resized: the position is computed again when the popover changes size. The filter row wraps on narrow screens.
- 80d5d47: The quick search button and the box it opens have room between them, and the box is as tall as the toolbar buttons.
- db1415b: Selects inside the grid (toolbar, filter and pivot panels, pager) draw their own arrow with room around it instead of the native one against the border. The arrow is part of the theme stylesheet, so `structure.css` leaves selects native.

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
