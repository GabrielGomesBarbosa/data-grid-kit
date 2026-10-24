---
'data-grid-kit': patch
---

Fast scrollbar drags no longer paint an empty region first: when a scroll leaves the rendered rows, the new window is committed inside the scroll event (`flushSync`) instead of on the next animation frame. Scrolls that stay inside the window are still batched to one store write per frame.
