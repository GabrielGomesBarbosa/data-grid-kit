import { useBase } from './base'
import type { GridInstance } from '../core'
import { cx } from './cx'
import { useSlots } from './slotsContext'
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
  const { Button } = useBase()
  const { grid, menu, panel } = p
  const { slots, slotProps } = useSlots<R>()
  const { popover: Popover, columnMenu: ColumnMenu, filterPanel: FilterPanel, columnsPanel: ColumnsPanel, pivotPanel: PivotPanel } = slots
  const item = 'gk-menu-item'
  /** the popover's own class names, plus the ones from `slotProps.popover` */
  const popoverProps = (own?: string) => ({ ...slotProps.popover, className: cx(own, slotProps.popover?.className) || undefined })
  return (
    <>
      {menu && (
        <Popover anchor={menu.anchor} onClose={p.closeMenu} label="Column menu" role="menu" align="end" {...popoverProps('gk-menu')}>
          <ColumnMenu grid={grid} field={menu.field} onClose={p.closeMenu} onFilter={p.onFilter} aggregation={p.aggregationMenu && !grid.pivot} {...slotProps.columnMenu} />
        </Popover>
      )}
      {panel?.kind === 'filters' && (
        <Popover anchor={panel.anchor} onClose={p.closePanel} label="Filters" {...popoverProps()}>
          <FilterPanel grid={grid} onClose={p.closePanel} {...slotProps.filterPanel} />
        </Popover>
      )}
      {panel?.kind === 'columns' && (
        <Popover anchor={panel.anchor} onClose={p.closePanel} label="Columns" {...popoverProps()}>
          <ColumnsPanel grid={grid} {...slotProps.columnsPanel} />
        </Popover>
      )}
      {panel?.kind === 'pivot' && (
        <Popover anchor={panel.anchor} onClose={p.closePanel} label="Pivot" {...popoverProps()}>
          <PivotPanel grid={grid} {...slotProps.pivotPanel} />
        </Popover>
      )}
      {panel?.kind === 'export' && (
        <Popover anchor={panel.anchor} onClose={p.closePanel} label="Export" role="menu" {...popoverProps('gk-menu')}>
          <Button type="button" role="menuitem" className={item} onClick={() => p.onExportCsv(false)}>
            Download CSV
          </Button>
          <Button type="button" role="menuitem" className={item} disabled={grid.state.selection.length === 0} onClick={() => p.onExportCsv(true)}>
            Download CSV (selected rows)
          </Button>
          <Button type="button" role="menuitem" className={item} onClick={p.onExportXlsx}>
            Download Excel (.xlsx)
          </Button>
        </Popover>
      )}
    </>
  )
}
