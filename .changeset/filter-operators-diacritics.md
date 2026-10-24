---
'data-grid-kit': minor
---

More filter operators, your own operators, and accent-insensitive matching. Text columns get "does not contain", "does not equal" and "is any of"; number and date columns get "≠" and "is any of"; pick-one columns get "is not" and "is any of". A column can bring its own `filterOperators` (with `getApplyFilterFn` and an optional `renderInput`), and `getFilterOperators(col)` is the starting point to extend the built-in list. `ignoreDiacritics` makes accented and plain letters match in the filter panel and the quick filter.
