# data-grid-kit

## 0.3.0

### Minor Changes

- Customizable architecture. Every part of the grid is a replaceable **slot** (`toolbar`, `footer`, `row`, `cell`, `headerCell`, overlays, column menu, panels, popover, base controls `baseButton` / `baseCheckbox` / `baseSelect` / `baseInput`, and 16 `icons`) with `slotProps` merged over the internal props. An **unstyled mode** ships `structure.css` (layout only) and `theme.css` (the default look) next to `styles.css`, and state is exposed as `data-*` attributes. `useGridView` returns the grid as data and prop getters (with `mergeProps`) so you can render your own markup; `<Grid>` is a thin renderer over it. A custom `row` slot is memoised by the grid (`rowPropsEqual`, exported), and scrolling by a row no longer re-renders every row. Adds the Customization guide, a public API policy and a test that snapshots the exports.

## 0.2.1

### Patch Changes

- Internal restructuring with no API change: the row pipeline, `useGrid`, the data source and the grid UI are split into small modules (no source file over 500 lines, enforced by lint), one pointer-drag helper replaces three copies, and the stylesheet is built from per-feature partials (same CSS output).

## 0.2.0

### Minor Changes

- 5322b6b: Server-side rendering fixes: `useGrid` now provides a server snapshot for its external stores and avoids layout-effect warnings during SSR.
