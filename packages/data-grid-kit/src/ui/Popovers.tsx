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
  const t = grid.text
  const { slots, slotProps } = useSlots<R>()
  const { popover: Popover, columnMenu: ColumnMenu, filterPanel: FilterPanel, columnsPanel: ColumnsPanel, pivotPanel: PivotPanel } = slots
  const item = 'gk-menu-item'
  /** the popover's own class names, plus the ones from `slotProps.popover` */
  const popoverProps = (own?: string) => ({ ...slotProps.popover, className: cx(own, slotProps.popover?.className) || undefined })
  return (
    <>
      {menu && (
        <Popover anchor={menu.anchor} onClose={p.closeMenu} label={t.columnMenu} role="menu" align="end" {...popoverProps('gk-menu')}>
          <ColumnMenu grid={grid} field={menu.field} onClose={p.closeMenu} onFilter={p.onFilter} aggregation={p.aggregationMenu && !grid.pivot} {...slotProps.columnMenu} />
        </Popover>
      )}
      {panel?.kind === 'filters' && (
        <Popover anchor={panel.anchor} onClose={p.closePanel} label={t.toolbarFilters} {...popoverProps()}>
          <FilterPanel grid={grid} onClose={p.closePanel} {...slotProps.filterPanel} />
        </Popover>
      )}
      {panel?.kind === 'columns' && (
        <Popover anchor={panel.anchor} onClose={p.closePanel} label={t.toolbarColumns} {...popoverProps()}>
          <ColumnsPanel grid={grid} {...slotProps.columnsPanel} />
        </Popover>
      )}
      {panel?.kind === 'pivot' && (
        <Popover anchor={panel.anchor} onClose={p.closePanel} label={t.toolbarPivot} {...popoverProps()}>
          <PivotPanel grid={grid} onClose={p.closePanel} {...slotProps.pivotPanel} />
        </Popover>
      )}
      {panel?.kind === 'export' && (
        <Popover anchor={panel.anchor} onClose={p.closePanel} label={t.toolbarExport} role="menu" {...popoverProps('gk-menu')}>
          <Button type="button" role="menuitem" className={item} onClick={() => p.onExportCsv(false)}>
            {t.exportCsv}
          </Button>
          <Button type="button" role="menuitem" className={item} disabled={grid.state.selection.length === 0} onClick={() => p.onExportCsv(true)}>
            {t.exportCsvSelected}
          </Button>
          <Button type="button" role="menuitem" className={item} onClick={p.onExportXlsx}>
            {t.exportXlsx}
          </Button>
        </Popover>
      )}
    </>
  )
}
