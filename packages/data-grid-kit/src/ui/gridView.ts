import type { CSSProperties, HTMLAttributes, RefObject } from 'react'
import type { GridInstance, RangeRect } from '../core'
import type { DetailPanelProps } from './DetailPanel'
import type { RowDrop, DropTarget } from './ctx'
import type { FooterProps } from './Footer'
import type { HeaderProps } from './Header'
import type { PopoversProps } from './Popovers'
import type { RowProps } from './Row'
import type { SkeletonRowProps } from './SkeletonRow'
import type { SlotsValue } from './slotsContext'
import type { ToolbarProps } from './Toolbar'

/** A row of the scrolling body: a real row, or the placeholder of a server row that has not arrived. */
export type BodyRow<R> = { type: 'row'; key: string | number; props: RowProps<R> } | { type: 'skeleton'; key: string; props: SkeletonRowProps }

/** An open detail panel: its props and the row it belongs to (render your content from it). */
export interface DetailItem<R> {
  key: string
  props: Omit<DetailPanelProps, 'children'>
  row: R
}

/** The pinned rows (and the total row) stuck to the top or bottom of the scrolling area. */
export interface PinnedBlock<R> {
  side: 'top' | 'bottom'
  label: string
  style: CSSProperties
  rows: RowProps<R>[]
}

export type GetProps<E extends HTMLAttributes<HTMLElement> = HTMLAttributes<HTMLElement>> = (extra?: E & Record<string, unknown>) => E & Record<string, unknown>

/**
 * Everything a grid needs to be drawn, as data and prop getters: `useGridView` computes it, the default `<Grid>`
 * renders it, and you can render it yourself with your own markup. A getter returns the attributes, handlers and
 * styles of one element; what you pass is merged in (class names joined, styles merged, event handlers chained).
 */
export interface GridView<R> {
  grid: GridInstance<R>
  /** provide this to the components that read slots (`SlotsProvider`), if you render the built-in parts */
  slotsValue: SlotsValue<R>
  getRootProps: GetProps
  /** the scrolling element: attach `ref`, it carries the keyboard, clipboard and scroll handling */
  getScrollerProps: GetProps<HTMLAttributes<HTMLDivElement>>
  /** the box inside the scroller that is as big as all the rows and columns */
  getContentProps: GetProps
  getBodyProps: GetProps
  scrollerRef: RefObject<HTMLDivElement>
  header: HeaderProps<R>
  bodyRows: BodyRow<R>[]
  detailItems: DetailItem<R>[]
  pinnedTop: PinnedBlock<R> | null
  pinnedBottom: PinnedBlock<R> | null
  toolbar: ToolbarProps<R> | null
  footer: FooterProps<R> | null
  loading: boolean
  error: { message: string; retry: () => void } | null
  popovers: PopoversProps<R>
  /** while a row or a column is being dragged: the label and drop marker to draw */
  rowDrag: { label: string; x: number; y: number; drop: RowDrop | null } | null
  columnDrag: { x: number; y: number; target: DropTarget | null; label: string } | null
  /** screen-reader announcements (row moved ...) */
  announcement: string
  /** the selected cell blocks (for the footer summary) */
  rects: RangeRect[]
}
