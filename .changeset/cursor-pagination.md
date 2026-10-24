---
'data-grid-kit': minor
---

Cursor-based pagination in `dataSource`: a response can carry `pageInfo.nextCursor` (`null` on the last page) and the grid sends it back as `params.cursor` with the request for the rows after it. The grid keeps the cursors and fetches blocks in order (a jump ahead walks the pages in between, each cached); a new sort or filter starts over.
