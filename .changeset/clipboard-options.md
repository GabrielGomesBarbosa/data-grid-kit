---
'data-grid-kit': minor
---

Clipboard events and options. `onClipboardCopy`, `onBeforeClipboardPasteStart` (return `false`, or a promise of it, to cancel a paste), `onClipboardPasteStart` and `onClipboardPasteEnd`, and `disableClipboardPaste`. Ctrl/Cmd+D and Ctrl/Cmd+R fill the selection down and to the right (`api.fillSelection`), and `fillSeries` makes the fill handle continue numbers a constant step apart instead of repeating them (off by default: fills repeat as before).
