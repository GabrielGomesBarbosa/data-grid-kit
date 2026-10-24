---
'data-grid-kit': minor
---

The pivot panel is docked at the right inside the grid's frame (as in MUI): the grid narrows to make room, keeps its scroll position, and the panel stays open while you work, scrolls on its own and closes with its X, the toolbar button or Escape. `pivotPanelMode: 'docked' | 'popover'` chooses (docked by default; `'popover'` is the previous behaviour). The grid's content now sits in a `gk-main` element next to the optional `gk-dock`. The toolbar wraps to a second line when the grid is narrow instead of cutting buttons off.
