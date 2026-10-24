import type { ComponentType } from 'react'
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
}

const glyph = (text: string): ComponentType<IconProps> => {
  const Icon = ({ className }: IconProps) => (className ? <span className={className}>{text}</span> : <>{text}</>)
  Icon.displayName = `Icon(${text})`
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
}

/** the icons of the grid this component is rendered in */
export const useIcons = (): GridIcons => useSlots().slots.icons
