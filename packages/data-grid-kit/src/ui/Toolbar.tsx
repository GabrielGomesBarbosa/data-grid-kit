import { type CSSProperties, type ReactNode } from 'react'
import { ColumnsButton, DensityButton, ExportButton, FilterButton, PivotButton, QuickFilter, Toolbar, ToolbarContext, ToolbarSeparator, ToolbarTitle } from './toolbarParts'
import { type CsvOptions, type GridInstance } from '../core'

/* ----------------------------------------------------------------- toolbar */

export type PanelKind = 'filters' | 'columns' | 'export' | 'pivot' | 'density'
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
  /** the default toolbar shows the density button */
  densitySelector?: boolean
  /** shown at the start of the default toolbar (`slotProps.toolbar.title`) */
  title?: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * The toolbar of a grid with `toolbar`: a title (`slotProps.toolbar.title`), the panel buttons, export and the quick search.
 * It is made of the exported parts, so a toolbar of your own can use any of them and add its own controls.
 */
export function DefaultToolbar<R>(props: ToolbarProps<R>) {
  const { title, className, style } = props
  void props.onExport
  return (
    <ToolbarContext.Provider value={props}>
      <Toolbar className={className} style={style}>
        <ToolbarTitle>{title}</ToolbarTitle>
        <ColumnsButton />
        <FilterButton />
        <PivotButton />
        {props.densitySelector && <DensityButton />}
        <ToolbarSeparator />
        <ExportButton />
        <ToolbarSeparator />
        <QuickFilter />
      </Toolbar>
    </ToolbarContext.Provider>
  )
}
