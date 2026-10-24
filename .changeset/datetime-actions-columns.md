---
'data-grid-kit': minor
---

Two column types. `type: 'dateTime'` holds a `Date` with its time: shown with date and time in the grid's locale, edited and filtered with a date-time input, copied and pasted as `yyyy-mm-ddThh:mm`, exported to CSV in local time and to Excel as `yyyy-mm-dd hh:mm`. `type: 'actions'` is a column of buttons from `getActions({ id, row, field })` (an action with `showInMenu` goes in a ⋮ menu; `href` makes a link); it is never sorted, filtered, edited, grouped, aggregated or exported.
