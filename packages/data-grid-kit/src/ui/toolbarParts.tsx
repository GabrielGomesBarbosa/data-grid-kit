import { createContext, forwardRef, useContext, useEffect, useRef, useState, type HTMLAttributes, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { useBase, type BaseButtonProps } from './base'
import { useIcons } from './icons'
import { cx } from './cx'
import { operatorNeedsValue } from '../core'
import type { PanelKind, ToolbarProps } from './Toolbar'

/* ------------------------------------------------------------------ context */

/** What the grid hands its toolbar slot. The grid provides it around `slots.toolbar`, so the parts below work in any toolbar you write. */
export const ToolbarContext = createContext<ToolbarProps<any> | null>(null)

/** The grid, the open panel and the actions of the toolbar this is rendered in. Throws outside one. */
export function useToolbar<R = any>(): ToolbarProps<R> {
  const value = useContext(ToolbarContext)
  if (!value) throw new Error('Toolbar parts must be rendered inside the toolbar of a Grid (slots.toolbar) or in a <ToolbarContext.Provider>')
  return value
}

/* --------------------------------------------------------------- the layout */

/** The bar itself: lays its children in a row. Put any of the parts below, or your own elements, inside. */
export function Toolbar({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div role="toolbar" aria-label="Grid toolbar" {...rest} className={cx('gk-toolbar', className)} />
}

/** A title at the start of the bar; it takes the free space, which pushes the buttons to the end. */
export function ToolbarTitle({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span {...rest} className={cx('gk-toolbar-title', className)} />
}

export function ToolbarSeparator({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span role="separator" aria-orientation="vertical" {...rest} className={cx('gk-toolbar-sep', className)} />
}

export interface ToolbarButtonProps extends BaseButtonProps {
  /** the accessible name, also shown as the tooltip */
  label: string
}

/** An icon button of the bar (a `baseButton`, so your design system's button is used). */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton({ label, className, children, ...rest }, ref) {
  const { Button } = useBase()
  return (
    <Button ref={ref} type="button" aria-label={label} title={label} {...rest} className={cx('gk-toolbar-button', className)}>
      {children}
    </Button>
  )
})

/* ------------------------------------------------------------ the ready parts */

type PartProps = Omit<ToolbarButtonProps, 'label' | 'onClick'> & { label?: string }

/** one button that opens a panel next to it (`data-gk-anchor` tells the grid where to place it) */
function usePanelButton(kind: PanelKind) {
  const { panel, onPanel } = useToolbar()
  return {
    'data-gk-anchor': true,
    'aria-expanded': panel?.kind === kind,
    onClick: (e: ReactMouseEvent<HTMLButtonElement>) => onPanel(kind, e.currentTarget.getBoundingClientRect()),
  }
}

/** Opens the columns panel (show / hide columns). Not shown in pivot mode, where the columns are generated. */
export function ColumnsButton({ label = 'Columns', children, ...rest }: PartProps) {
  const { grid } = useToolbar()
  const icons = useIcons()
  const panel = usePanelButton('columns')
  if (grid.pivot) return null
  return (
    <ToolbarButton label={label} aria-haspopup="dialog" {...panel} {...rest}>
      {children ?? <icons.columns />}
    </ToolbarButton>
  )
}

/** Opens the filter panel; a badge shows how many filters are on. */
export function FilterButton({ label = 'Filters', children, ...rest }: PartProps) {
  const { grid } = useToolbar()
  const icons = useIcons()
  const panel = usePanelButton('filters')
  // a row nothing has been typed into yet filters nothing, so it is not counted
  const active = grid.state.filterModel.items.filter((f) => !operatorNeedsValue(f.operator) || (f.value !== undefined && f.value !== null && f.value !== '')).length
  return (
    <ToolbarButton label={active ? `${label}, ${active} active` : label} aria-haspopup="dialog" {...panel} {...rest}>
      {children ?? <icons.filter />}
      {active > 0 && (
        <span className="gk-badge" aria-hidden="true">
          {active}
        </span>
      )}
    </ToolbarButton>
  )
}

/** Opens the pivot panel. Only shown when the grid has `pivoting` on and its data is on the client. */
export function PivotButton({ label = 'Pivot', children, ...rest }: PartProps) {
  const { grid } = useToolbar()
  const icons = useIcons()
  const panel = usePanelButton('pivot')
  if (!grid.options.pivoting || grid.options.dataSource) return null
  return (
    <ToolbarButton label={label} aria-haspopup="dialog" data-active={grid.state.pivotMode ? '' : undefined} {...panel} {...rest}>
      {children ?? <icons.pivot />}
    </ToolbarButton>
  )
}

/** Opens the export menu (CSV, Excel). */
export function ExportButton({ label = 'Export', children, ...rest }: PartProps) {
  const panel = usePanelButton('export')
  const icons = useIcons()
  return (
    <ToolbarButton label={label} aria-haspopup="menu" {...panel} {...rest}>
      {children ?? <icons.download />}
    </ToolbarButton>
  )
}

export interface QuickFilterProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  placeholder?: string
  /** start with the box open (default: a search button that opens it) */
  defaultExpanded?: boolean
  children?: ReactNode
}

/** The quick search: a button that opens a search box (Escape closes it when it is empty). It filters every column. */
export function QuickFilter({ placeholder = 'Search…', defaultExpanded = false, className, children, ...rest }: QuickFilterProps) {
  const { grid } = useToolbar()
  const { Button, Input } = useBase()
  const icons = useIcons()
  const value = grid.state.filterModel.quickFilter ?? ''
  const [open, setOpen] = useState(defaultExpanded)
  const input = useRef<HTMLInputElement>(null)
  const shown = open || value !== '' // a search that is filtering stays visible
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])
  return (
    <span {...rest} className={cx('gk-quick-filter', className)} data-open={shown ? '' : undefined}>
      <ToolbarButton label="Search" aria-expanded={shown} onClick={() => setOpen((o) => !o)}>
        {children ?? <icons.search />}
      </ToolbarButton>
      {shown && (
        <>
          <Input
            ref={input}
            type="search"
            className="gk-search"
            placeholder={placeholder}
            aria-label="Quick filter"
            value={value}
            onChange={(e) => grid.api.setQuickFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && value === '') setOpen(false)
            }}
          />
          {value !== '' && (
            <Button type="button" aria-label="Clear search" title="Clear search" className="gk-toolbar-button" onClick={() => grid.api.setQuickFilter('')}>
              <icons.close />
            </Button>
          )}
        </>
      )}
    </span>
  )
}
