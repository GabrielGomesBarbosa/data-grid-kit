---
'data-grid-kit': minor
---

Events and styling hooks. `onRowClick`, `onRowDoubleClick`, `onCellClick`, `onCellDoubleClick`, `onCellKeyDown`, `onColumnHeaderClick` and `onColumnHeaderDoubleClick` report what was hit (and `event.preventDefault()` stops what the grid would do with it). `cellClassName` (column), `getCellClassName` and `getRowClassName` (grid) add class names from the data. Columns get `renderHeader`, `headerAlign`, `description` (a header tooltip) and `headerClassName`.
