---
'data-grid-kit': patch
---

The no-columns state is a message ("No columns are visible. Check the column visibility settings.") instead of a message with a button: the Manage columns button opened its panel away from the button when the page was scrolled. `NoRowsOverlayProps.onManageColumns` is removed (it was added in 0.6.0).
