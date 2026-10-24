---
'data-grid-kit': minor
---

Column autosize. `api.autosizeColumns(options)` fits columns to their header and the cells that are on screen (within `minWidth` / `maxWidth`; outliers are ignored unless asked), a double click on a column's divider fits that column, and `autosizeOnMount` does it once when the first rows appear. Headless renderers register their own measurer with `api.setColumnMeasurer`.
