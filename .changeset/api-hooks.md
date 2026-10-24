---
'data-grid-kit': minor
---

The api from outside and inside the grid. `useGridApiRef()` and the `apiRef` prop give the api to the component that renders the grid; `useGridApiContext()` gives it to slots and renderers (`renderCell`, `renderHeader`...); `useGridSelector(selector)` reads a slice of the state and re-renders only when that slice changes.
