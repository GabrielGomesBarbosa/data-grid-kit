---
'data-grid-kit': minor
---

Row selection modes. `rowSelectionOnClick` selects rows by clicking (click, Ctrl/Cmd+click, Shift+click for a range, Space, Ctrl/Cmd+A), `multipleRowSelection={false}` keeps one row at a time, and `isRowSelectable` marks rows that cannot be selected (disabled checkbox, skipped by ranges and select-all). New `api.setSelection(ids)`, `api.selectAll()` and `api.isRowSelectable(id)`. Nothing changes unless you set these props.
