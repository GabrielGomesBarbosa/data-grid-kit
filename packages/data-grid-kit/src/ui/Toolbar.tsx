import { type MouseEvent as ReactMouseEvent } from 'react'
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

export function Toolbar<R>({
  grid,
  panel,
  onPanel,
  onExport,
}: {
  grid: GridInstance<R>
  panel: PanelState | null
  onPanel: (kind: PanelKind, anchor: DOMRect) => void
  onExport: (options: CsvOptions & { selectedOnly?: boolean }) => void
}) {
  const { api, state } = grid
  const activeFilters = state.filterModel.items.length
  const open = (kind: PanelKind) => (e: ReactMouseEvent<HTMLButtonElement>) =>
    onPanel(kind, e.currentTarget.getBoundingClientRect())
  void onExport
  return (
    <div className="gk-toolbar" role="toolbar" aria-label="Grid toolbar">
      {!grid.pivot && (
        <button type="button" data-gk-anchor aria-haspopup="dialog" aria-expanded={panel?.kind === 'columns'} onClick={open('columns')}>
          Columns
        </button>
      )}
      <button type="button" data-gk-anchor aria-haspopup="dialog" aria-expanded={panel?.kind === 'filters'} onClick={open('filters')}>
        Filters{activeFilters > 0 && <span className="gk-badge">{activeFilters}</span>}
      </button>
      <button type="button" data-gk-anchor aria-haspopup="menu" aria-expanded={panel?.kind === 'export'} onClick={open('export')}>
        Export
      </button>
      {grid.options.pivoting && !grid.options.dataSource && (
        <button
          type="button"
          data-gk-anchor
          data-active={state.pivotMode ? '' : undefined}
          aria-haspopup="dialog"
          aria-expanded={panel?.kind === 'pivot'}
          onClick={open('pivot')}
        >
          Pivot
        </button>
      )}
      <input
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
