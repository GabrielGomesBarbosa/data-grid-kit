import type { RefObject } from 'react'
import type { DropTarget, RowDrop } from './ctx'

/** The label that follows the pointer, and the line showing where a dragged row would land. */
export function RowDragFeedback({ drag, scroller }: { drag: { label: string; x: number; y: number; drop: RowDrop | null }; scroller: RefObject<HTMLElement> }) {
  const { drop } = drag
  return (
    <>
      <div className="gk-drag-ghost" style={{ left: drag.x + 12, top: drag.y + 12 }}>
        {drag.label}
      </div>
      {drop && (
        <div
          className="gk-row-drop"
          style={{
            left: scroller.current?.getBoundingClientRect().left ?? 0,
            width: scroller.current?.clientWidth ?? 0,
            top: (drop.placement === 'before' ? drop.rect.top : drop.rect.bottom) - 1.5,
          }}
        />
      )}
    </>
  )
}

/** The label that follows the pointer, and the marker showing where a dragged column would land. */
export function ColumnDragFeedback({ drag, label }: { drag: { x: number; y: number; target: DropTarget | null }; label: string }) {
  const { target } = drag
  return (
    <>
      <div className="gk-drag-ghost" style={{ left: drag.x + 12, top: drag.y + 12 }}>
        {label}
      </div>
      {target && (
        <div
          className="gk-drop-indicator"
          style={{ left: (target.placement === 'before' ? target.rect.left : target.rect.right) - 1, top: target.rect.top, height: target.rect.height }}
        />
      )}
    </>
  )
}
