---
'data-grid-kit': minor
---

Excel export: `headerStyle` and `columnStyles` (bold, italic, text colour, fill, alignment, wrap), `validateSelects` (a drop-down for `singleSelect` columns), `extraSheets` (more worksheets in the same file) and, in `data-grid-kit/core`, `buildXlsxWorkbook(sheets)` plus explicit formula cells (`{ formula, value }`). Text that starts with `=` is still text. The worker export carries the extra sheets too.
