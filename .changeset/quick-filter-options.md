---
'data-grid-kit': minor
---

Quick filter options. `quickFilterParser` changes how the typed text is split into terms, `quickFilterLogicOperator="or"` needs only one term to match, `quickFilterIncludeHidden` searches the columns that start hidden, a column's `quickFilter` leaves it out of the search (`false`) or decides for itself (a function), and `<QuickFilter debounceMs={300} />` waits for a pause in typing.
