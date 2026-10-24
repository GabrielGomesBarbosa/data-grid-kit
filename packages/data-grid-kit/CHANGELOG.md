# data-grid-kit

## 0.2.1

### Patch Changes

- Internal restructuring with no API change: the row pipeline, `useGrid`, the data source and the grid UI are split into small modules (no source file over 500 lines, enforced by lint), one pointer-drag helper replaces three copies, and the stylesheet is built from per-feature partials (same CSS output).

## 0.2.0

### Minor Changes

- 5322b6b: Server-side rendering fixes: `useGrid` now provides a server snapshot for its external stores and avoids layout-effect warnings during SSR.
