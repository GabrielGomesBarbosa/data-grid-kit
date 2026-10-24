import type { ColumnDef } from '../../core'

/** the text a column shows in menus and panels */
export const title = (c: ColumnDef) => c.headerName ?? c.field
