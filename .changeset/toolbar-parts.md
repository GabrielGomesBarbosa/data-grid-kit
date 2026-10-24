---
'data-grid-kit': minor
---

The toolbar is made of exported parts: `Toolbar`, `ToolbarTitle`, `ToolbarSeparator`, `ToolbarButton`, `ColumnsButton`, `FilterButton`, `PivotButton`, `ExportButton`, `QuickFilter` and `useToolbar()` (the grid provides a context around `slots.toolbar`), so a toolbar of your own can mix them with any controls. The default toolbar is now a bar of icon buttons with tooltips, a title (`slotProps.toolbar.title`) and a quick search that opens from its button. Five new replaceable icons: `columns`, `filter`, `pivot`, `download`, `search`. Behaviour change: the quick search box is opened from its button instead of always visible.
