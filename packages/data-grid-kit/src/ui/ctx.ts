import { type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ClipboardEvent as ReactClipboardEvent } from 'react'
import { type DropPlacement, type CsvOptions, type EditStopReason, type RangeRect, type RenderRow, type GridApi, type GridState, type GridInstance } from '../core'
import { type EditMove } from './Editors'
import { type UIColumnDef } from './types'
import { type PanelKind, type PanelState } from './Toolbar'
import { type ColumnLayout } from '../core/layout'

export interface RowDrop {
  target: RenderRow['id']
  placement: DropPlacement
  rect: DOMRect
}

export interface DropTarget {
  field: string
  placement: DropPlacement
  rect: DOMRect
}

/** What the interaction hooks share: values from the grid component and what earlier hooks produced. */
export interface GridCtx<R> {
  cellSelection: boolean
  api: GridApi<R>
  state: GridState
  grid: GridInstance<R>
  layout: ColumnLayout<R>
  fillHandle: boolean
  scrollerRef: React.RefObject<HTMLDivElement>
  gridRef: React.MutableRefObject<GridInstance<R>>
  trackPointer: (start: { x: number; y: number; pointerType?: string }, onMove: (x: number, y: number) => void, onEnd: () => void) => (() => void)
  trackDrag: (start: { x: number; y: number; pointerType?: string }, onCell: (cell: { row: number; col: number; }) => void, onEnd: (last: { row: number; col: number; } | null) => void) => void
  setFillPreview: React.Dispatch<React.SetStateAction<RangeRect | null>>
  hasHierarchy: boolean
  hierarchyField: string | undefined
  selectAllCells: () => void
  announceMove: (id: RenderRow["id"]) => NodeJS.Timeout
  hasDetail: (r: RenderRow<R>) => boolean
  checkboxSelection: boolean
  rowSelectionOnClick: boolean
  rows: RenderRow<R>[]
  clipboard: boolean
  onClipboardCopy: ((text: string) => void) | undefined
  setPanel: React.Dispatch<React.SetStateAction<PanelState | null>>
  setMenu: React.Dispatch<React.SetStateAction<{ field: string; anchor: DOMRect; } | null>>
  menu: { field: string; anchor: DOMRect; } | null
  columns: UIColumnDef<R>[]
  csvFileName: string
  rangeKeyFor: (i: number) => string
  fillColFor: (i: number) => number
  rects: RangeRect[]
  onFillStart: (e: ReactPointerEvent<HTMLElement>) => void
  onRowDragStart: (id: RenderRow["id"], e: ReactPointerEvent<HTMLElement>) => void
  rowDrag: { id: RenderRow["id"]; label: string; x: number; y: number; drop: RowDrop | null; } | null
  onBodyPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  announcement: string
  finishEdit: (value: unknown, move?: EditMove) => Promise<boolean>
  cancelEdit: (reason?: EditStopReason) => void
  onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void
  onBodyClick: (e: ReactMouseEvent<HTMLDivElement>) => void
  onBodyDoubleClick: (e: ReactMouseEvent<HTMLDivElement>) => void
  onCopy: (e: ReactClipboardEvent<HTMLDivElement>) => void
  onCut: (e: ReactClipboardEvent<HTMLDivElement>) => void
  onPaste: (e: ReactClipboardEvent<HTMLDivElement>) => void
  startColumnDrag: (field: string, e: ReactPointerEvent<HTMLElement>) => void
  justDragged: React.MutableRefObject<boolean>
  drag: { field: string; x: number; y: number; target: DropTarget | null; } | null
  openMenu: (field: string, anchor: DOMRect) => void
  openPanel: (kind: PanelKind, anchor: DOMRect) => void
  doExport: (opts: CsvOptions & { selectedOnly?: boolean; }) => void
  openFilterFor: (field: string) => void
}
