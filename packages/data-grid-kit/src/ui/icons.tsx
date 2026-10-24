import type { ComponentType, ReactNode } from 'react'
import { useSlots } from './slotsContext'

export interface IconProps {
  className?: string
}

/** The small symbols the grid draws. Replace any of them through `slots.icons`, e.g. with your icon set. */
export interface GridIcons {
  sortAsc: ComponentType<IconProps>
  sortDesc: ComponentType<IconProps>
  /** a column pinned to the left / right */
  pinLeft: ComponentType<IconProps>
  pinRight: ComponentType<IconProps>
  /** opens the column menu */
  columnMenu: ComponentType<IconProps>
  expand: ComponentType<IconProps>
  collapse: ComponentType<IconProps>
  /** opens a detail panel (rotated by the stylesheet when it is open) */
  detailToggle: ComponentType<IconProps>
  /** a grip to drag by (rows, pivot fields) */
  dragHandle: ComponentType<IconProps>
  pinTop: ComponentType<IconProps>
  pinBottom: ComponentType<IconProps>
  /** remove / unpin / cancel */
  close: ComponentType<IconProps>
  previousPage: ComponentType<IconProps>
  nextPage: ComponentType<IconProps>
  moveUp: ComponentType<IconProps>
  moveDown: ComponentType<IconProps>
  /** toolbar buttons */
  columns: ComponentType<IconProps>
  filter: ComponentType<IconProps>
  pivot: ComponentType<IconProps>
  download: ComponentType<IconProps>
  search: ComponentType<IconProps>
}

const glyph = (text: string): ComponentType<IconProps> => {
  const Icon = ({ className }: IconProps) => (className ? <span className={className}>{text}</span> : <>{text}</>)
  Icon.displayName = `Icon(${text})`
  return Icon
}

/** a small line icon: drawn with `currentColor`, so it takes the colour of the text around it */
const line = (name: string, shapes: ReactNode): ComponentType<IconProps> => {
  const Icon = ({ className }: IconProps) => (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {shapes}
    </svg>
  )
  Icon.displayName = `Icon(${name})`
  return Icon
}

export const defaultIcons: GridIcons = {
  sortAsc: glyph('↑'),
  sortDesc: glyph('↓'),
  pinLeft: glyph('⇤'),
  pinRight: glyph('⇥'),
  columnMenu: glyph('⋮'),
  expand: glyph('▸'),
  collapse: glyph('▾'),
  detailToggle: glyph('›'),
  dragHandle: glyph('⋮⋮'),
  pinTop: glyph('▲'),
  pinBottom: glyph('▼'),
  close: glyph('✕'),
  previousPage: glyph('‹'),
  nextPage: glyph('›'),
  moveUp: glyph('↑'),
  moveDown: glyph('↓'),
  columns: line(
    'columns',
    <>
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="9.5" y="4" width="5" height="16" rx="1" />
      <rect x="16" y="4" width="5" height="16" rx="1" />
    </>,
  ),
  filter: line('filter', <path d="M4 6h16M7 12h10M10 18h4" />),
  pivot: line(
    'pivot',
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M10 4v16" />
    </>,
  ),
  download: line('download', <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />),
  search: line(
    'search',
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l5 5" />
    </>,
  ),
}

/** the icons of the grid this component is rendered in */
export const useIcons = (): GridIcons => useSlots().slots.icons
