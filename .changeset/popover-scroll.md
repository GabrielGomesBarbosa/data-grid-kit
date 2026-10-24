---
'data-grid-kit': patch
---

Popovers stay glued to their button when the page scrolls, without shaking and without closing. They are positioned in page coordinates, so the browser moves them with the scroll and no script runs on the way. They no longer look for the button under the anchor either, which put the column menu of some columns (Price) off its button.
