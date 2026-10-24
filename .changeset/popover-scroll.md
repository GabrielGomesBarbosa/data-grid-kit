---
'data-grid-kit': patch
---

Popovers no longer shake when the page scrolls. A portalled popover cannot be glued to its button by the browser, and a position written from a scroll handler is always a frame behind the scrolling, so it does not follow: it closes when its button moves (scrolling inside the popover does not count). It still moves when its own size changes or the window is resized.
