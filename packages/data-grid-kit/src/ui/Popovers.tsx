import type { GridInstance } from '../core'
import { ColumnMenu, ColumnsPanel, FilterPanel, PivotPanel } from './panels'
import { Popover } from './Popover'
import type { PanelState } from './Toolbar'

export interface PopoversProps<R> {
  grid: GridInstance<R>
  menu: { field: string; anchor: DOMRect } | null
  panel: PanelState | null
  closeMenu: () => void
  closePanel: () => void
  onFilter: (field: string) => void
  aggregationMenu: boolean
  /** download CSV (all rows, or only the selected ones) */
  onExportCsv: (selectedOnly: boolean) => void
  onExportXlsx: () => void
}

/** The column menu and the toolbar panels (filters, columns, pivot, export), each in a popover next to its button. */
export function Popovers<R>(p: PopoversProps<R>) {
  const { grid, menu, panel } = p
  const item = 'gk-menu-item'
  return (
    <>
      {menu && (
        <Popover anchor={menu.anchor} onClose={p.closeMenu} label="Column menu" role="menu" align="end" className="gk-menu">
          <ColumnMenu grid={grid} field={menu.field} onClose={p.closeMenu} onFilter={p.onFilter} aggregation={p.aggregationMenu && !grid.pivot} />
        </Popover>
      )}
      {panel?.kind === 'filters' && (
        <Popover anchor={panel.anchor} onClose={p.closePanel} label="Filters">
          <FilterPanel grid={grid} />
        </Popover>
      )}
      {panel?.kind === 'columns' && (
        <Popover anchor={panel.anchor} onClose={p.closePanel} label="Columns">
          <ColumnsPanel grid={grid} />
        </Popover>
      )}
      {panel?.kind === 'pivot' && (
        <Popover anchor={panel.anchor} onClose={p.closePanel} label="Pivot">
          <PivotPanel grid={grid} />
        </Popover>
      )}
      {panel?.kind === 'export' && (
        <Popover anchor={panel.anchor} onClose={p.closePanel} label="Export" role="menu" className="gk-menu">
          <button type="button" role="menuitem" className={item} onClick={() => p.onExportCsv(false)}>
            Download CSV
          </button>
          <button type="button" role="menuitem" className={item} disabled={grid.state.selection.length === 0} onClick={() => p.onExportCsv(true)}>
            Download CSV (selected rows)
          </button>
          <button type="button" role="menuitem" className={item} onClick={p.onExportXlsx}>
            Download Excel (.xlsx)
          </button>
        </Popover>
      )}
    </>
  )
}
