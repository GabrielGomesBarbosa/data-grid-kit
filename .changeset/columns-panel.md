---
'data-grid-kit': minor
---

Columns panel: a search box, one tri-state Show/Hide All checkbox and Reset (back to each column's own `hidden`). Every column can now be hidden: the grid shows "No columns" with a Manage columns button that opens the panel. New `api.setColumnVisibilityModel(model)` replaces the visibility of all columns at once; `NoRowsOverlayProps` gets `onManageColumns`; `GridView` gets `openPanel`.
