---
'data-grid-kit': minor
---

Density, "no results" and rows per page. `density` (`compact` / `standard` / `comfortable`, in the state, with `api.setDensity` and a `<DensityButton />` / `densitySelector` toolbar button) scales row and header heights. A filter that leaves no row now shows its own message (`noResults`, slot `noResultsOverlay`) instead of "No rows". `pageSizeOptions` adds a "Rows per page" select to the footer (`-1` for every row) and `autoPageSize` fits the page to the grid's height. Rows with no filter active show the same as before.
