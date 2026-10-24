import { Header } from './Header'
import { ColumnDragFeedback, RowDragFeedback } from './DragFeedback'
import { Popovers } from './Popovers'
import { SlotsProvider } from './slotsContext'
import { ToolbarContext } from './toolbarParts'
import { type UIColumnDef, type GridProps } from './types'
import { useGridView } from './useGridView'

export type { GridProps, UIColumnDef }

/**
 * The ready-made grid: a renderer over `useGridView`, drawing each part with its slot (see `GridSlots`).
 * Everything it renders comes from the view, so a grid drawn with your own markup behaves the same.
 */
export function Grid<R = any>(props: GridProps<R>) {
  const view = useGridView<R>(props)
  const { slots, slotProps } = view.slotsValue
  const { row: RowSlot, skeletonRow: SkeletonRowSlot, detailPanel: DetailPanelSlot } = slots
  const { pinnedTop, pinnedBottom } = view

  const pinnedBlock = (block: NonNullable<typeof pinnedTop>) => (
    <div className={`gk-pinned-rows gk-pinned-rows-${block.side}`} role="rowgroup" aria-label={block.label} style={block.style}>
      {block.rows.map((row) => (
        <RowSlot key={row.row.id} {...row} {...slotProps.row} />
      ))}
    </div>
  )

  return (
    <SlotsProvider value={view.slotsValue}>
      <div {...view.getRootProps()}>
        {view.toolbar && (
          <ToolbarContext.Provider value={view.toolbar}>
            <slots.toolbar {...view.toolbar} {...slotProps.toolbar} />
          </ToolbarContext.Provider>
        )}
        {view.loading && <slots.loadingOverlay {...slotProps.loadingOverlay} />}
        {view.error && <slots.errorOverlay message={view.error.message} onRetry={view.error.retry} {...slotProps.errorOverlay} />}
        <div {...view.getScrollerProps()}>
          <div {...view.getContentProps()}>
            <Header {...view.header} />
            {pinnedTop && pinnedBlock(pinnedTop)}
            <div {...view.getBodyProps()}>
              {view.bodyRows.map((item) =>
                item.type === 'row' ? (
                  <RowSlot key={item.key} {...item.props} {...slotProps.row} />
                ) : (
                  <SkeletonRowSlot key={item.key} {...item.props} {...slotProps.skeletonRow} />
                ),
              )}
              {props.renderDetailPanel &&
                view.detailItems.map((item) => (
                  <DetailPanelSlot key={item.key} {...item.props} {...slotProps.detailPanel}>
                    {props.renderDetailPanel!({ row: item.row })}
                  </DetailPanelSlot>
                ))}
            </div>
            {pinnedBottom && pinnedBlock(pinnedBottom)}
            <slots.noRowsOverlay grid={view.grid} onManageColumns={(anchor) => view.openPanel('columns', anchor)} {...slotProps.noRowsOverlay} />
          </div>
        </div>
        {view.footer && <slots.footer {...view.footer} {...slotProps.footer} />}
        {view.rowDrag && <RowDragFeedback drag={view.rowDrag} scroller={view.scrollerRef} />}
        <div className="gk-sr-only" role="status" aria-live="polite">
          {view.announcement}
        </div>
        {view.columnDrag && <ColumnDragFeedback drag={view.columnDrag} label={view.columnDrag.label} />}
        <Popovers {...view.popovers} />
      </div>
    </SlotsProvider>
  )
}
