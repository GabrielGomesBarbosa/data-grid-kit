---
'data-grid-kit': minor
---

Localization. `localeText` replaces any of the texts the grid shows (labels, tooltips, placeholders, messages, the headers of generated pivot columns): a key holds a string, or a function when the text has a name or a number in it, and what you leave out stays in English. `locale` sets the locale of numbers and dates (cells, groups, aggregates, the footer, the Excel export). A Brazilian Portuguese pack is in the new `data-grid-kit/locales` entry (`<Grid {...ptBR} />`), `useLocaleText()` gives your own slots the same texts, and `grid.text` / `grid.locale` are on the grid instance for headless use. Nothing changes for an app that sets neither prop.
