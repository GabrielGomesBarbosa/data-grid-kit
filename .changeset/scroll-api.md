---
'data-grid-kit': minor
---

Scroll API. `api.scrollToRow(id)`, `scrollToColumn(field)`, `scrollToCell(id, field)` and `scrollToIndexes({ rowIndex, colIndex })` scroll to a row and / or column ('nearest' by default, or `'start'`, `'center'`, `'end'`), accounting for the header, pinned columns and rows, per-row heights and open detail panels. `initialState.scroll` now puts the grid at that position when it appears.
