---
'data-grid-kit': minor
---

Editing. `editMode="row"` edits every editable cell of a row together (Tab between them, Enter or a click outside saves the row in one `processRowUpdate`, Escape discards). A column's `validate` returns a message to refuse a value (it may be async; the editor shows the message and the edit stays open). `onCellEditStart`, `onCellEditStop`, `onRowEditStart` and `onRowEditStop` report when an edit starts and why it ends, and can stop or keep it by returning `false`. New `api.startRowEdit`, `setEditValue`, `commitRowEdit`, `cancelRowEdit`; `commitEdit` and `cancelEdit` take a reason. Cell editing is unchanged unless you set these.
