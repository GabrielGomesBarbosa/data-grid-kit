---
'data-grid-kit': minor
---

Pivot: click a value or total column header to order the groups of every level by that aggregate (empty values last; paging and exports follow); `hidden` on column and value entries and `hiddenRows` keep a field in the pivot model without using it, with a checkbox for each in the panel; a field can be a value more than once with different functions (`+` in the panel). New core helpers: `setPivotHidden`, `addPivotValue`, `removePivotValue`, `moveValueEntry`, `setValueFunc`, `visiblePivot`, `pivotAggSortOf`.
