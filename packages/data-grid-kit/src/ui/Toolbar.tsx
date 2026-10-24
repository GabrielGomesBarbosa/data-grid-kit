import { useBase } from './base'
import { type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { cx } from './cx'
import { type CsvOptions, type GridInstance } from '../core'

/* ----------------------------------------------------------------- toolbar */

export type PanelKind = 'filters' | 'columns' | 'export' | 'pivot'
export interface PanelState {
  kind: PanelKind
  anchor: DOMRect
}

export function downloadText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export interface ToolbarProps<R> {
  grid: GridInstance<R>
  /** the panel that is open, if any */
  panel: PanelState | null
  onPanel: (kind: PanelKind, anchor: DOMRect) => void
  onExport: (options: CsvOptions & { selectedOnly?: boolean }) => void
  className?: string
  style?: CSSProperties
}

export function Toolbar<R>({ grid, panel, onPanel, onExport, className, style }: ToolbarProps<R>) {
  const { Button, Input } = useBase()
  const { api, state } = grid
  const activeFilters = state.filterModel.items.length
  const open = (kind: PanelKind) => (e: ReactMouseEvent<HTMLButtonElement>) =>
    onPanel(kind, e.currentTarget.getBoundingClientRect())
  void onExport
  return (
    <div className={cx('gk-toolbar', className)} style={style} role="toolbar" aria-label="Grid toolbar">
      {!grid.pivot && (
        <Button type="button" data-gk-anchor aria-haspopup="dialog" aria-expanded={panel?.kind === 'columns'} onClick={open('columns')}>
          Columns
        </Button>
      )}
      <Button type="button" data-gk-anchor aria-haspopup="dialog" aria-expanded={panel?.kind === 'filters'} onClick={open('filters')}>
        Filters{activeFilters > 0 && <span className="gk-badge">{activeFilters}</span>}
      </Button>
      <Button type="button" data-gk-anchor aria-haspopup="menu" aria-expanded={panel?.kind === 'export'} onClick={open('export')}>
        Export
      </Button>
      {grid.options.pivoting && !grid.options.dataSource && (
        <Button
          type="button"
          data-gk-anchor
          data-active={state.pivotMode ? '' : undefined}
          aria-haspopup="dialog"
          aria-expanded={panel?.kind === 'pivot'}
          onClick={open('pivot')}
        >
          Pivot
        </Button>
      )}
      <Input
        type="search"
        className="gk-search"
        placeholder="Search…"
        aria-label="Quick filter"
        value={state.filterModel.quickFilter ?? ''}
        onChange={(e) => api.setQuickFilter(e.target.value)}
      />
    </div>
  )
}
