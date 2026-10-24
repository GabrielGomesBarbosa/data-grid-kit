---
'data-grid-kit': patch
---

Filter panel: the remove button is always live and shows the pointer cursor. Removing the last row (a filter, or the blank one the panel opens with) closes the panel, like closing a dialog you are finished with. `PanelProps` gets an optional `onClose`.
