import type { ReactNode } from 'react'
import type { ColumnLayout } from '../core/layout'

/**
 * The three column groups of a row, header row or placeholder: pinned left, scrolling, pinned right.
 * A plain function (not a component) so rows pay no extra element for it.
 */
export function renderSections(layout: ColumnLayout, left: ReactNode, center: ReactNode, right: ReactNode): ReactNode {
  return (
    <>
      {layout.left.length > 0 && (
        <div className="gk-pinned gk-pinned-left" style={{ width: layout.leftWidth }}>
          {left}
        </div>
      )}
      <div className="gk-center" style={{ width: layout.centerWidth }}>
        {center}
      </div>
      {layout.right.length > 0 && (
        <div className="gk-pinned gk-pinned-right" style={{ width: layout.rightWidth }}>
          {right}
        </div>
      )}
    </>
  )
}
