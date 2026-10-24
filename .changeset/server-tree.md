---
'data-grid-kit': minor
---

Tree data, row grouping and aggregation on the server. A data source with `getChildrenCount(row)` and `getGroupKey(row)` is a tree loaded level by level: `getRows` gets `groupKeys` (the path to the parent) when a row is expanded, plus `groupFields` (the row grouping model) and `aggregationModel`; rows with children show `getAggregatedValue(row, field)`. Each open level has its own blocks, errors and retries; all share one cache keyed by level, so reopening a row sends nothing. Needs `pagination={false}`; pivoting stays client-side.
