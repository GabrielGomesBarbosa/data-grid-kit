---
'data-grid-kit': minor
---

Variable row height: `getRowHeight({ id, row, depth })` returns a number, `null` / `undefined` for `rowHeight`, or `'auto'` to size the row to its content (measured on screen, with `getEstimatedRowHeight` until then). Positions come from a prefix sum with binary search, so virtualization stays fast, and detail panels sit under their own row. When a row above the visible ones is measured, the scroll position moves by the same amount so nothing jumps. As in MUI, columns are not virtualized while there are `'auto'` rows (`virtualizeColumnsWithAutoRowHeight` turns it back on). `useGrid` returns `reportRowHeights` for custom renderers.
