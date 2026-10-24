import { DEFAULT_MIN_WIDTH } from '../layout'
import type { ApiContext } from './context'
import type { AutosizeOptions, ColumnMeasurer, GridApi } from '../gridTypes'
import type { Store } from '../store'
import type { GridState } from '../types'

/** the measurer each grid's renderer registered (the core knows no markup, so it cannot measure) */
const measurers = new WeakMap<Store<GridState>, ColumnMeasurer>()

/** Fit columns to their content: the renderer measures, this applies the widths (within each column's min / max). */
export function autosizeApi<R>(c: ApiContext<R>): Pick<GridApi<R>, 'autosizeColumns' | 'setColumnMeasurer'> {
  const { store, layoutRef, set } = c
  return {
    setColumnMeasurer(measure) {
      if (measure) measurers.set(store, measure)
      else measurers.delete(store)
    },
    autosizeColumns(options = {}) {
      const layout = layoutRef.current
      const measure = measurers.get(store)
      if (!layout || !measure) return {}
      const all = layout.all.map((col) => col.field)
      const fields = (options.columns ?? all).filter((f) => all.includes(f))
      if (fields.length === 0) return {}
      const measured = measure(fields, {
        includeHeaders: options.includeHeaders ?? true,
        includeOutliers: options.includeOutliers ?? false,
        outliersFactor: options.outliersFactor ?? 1.5,
      })
      const widths: Record<string, number> = {}
      for (const f of fields) if (measured[f] !== undefined) widths[f] = Math.ceil(measured[f]!)
      if (options.expand) {
        // a spare edge of the grid is shared by the fitted columns, in proportion to their widths
        const fitted = Object.keys(widths)
        const others = all.filter((f) => !fitted.includes(f)).reduce((s, f) => s + layout.width(f), 0)
        const mine = fitted.reduce((s, f) => s + widths[f]!, 0)
        const spare = store.getState().viewport.width - others - mine
        if (spare > 0 && mine > 0) for (const f of fitted) widths[f] = Math.floor(widths[f]! + (spare * widths[f]!) / mine)
      }
      set((s) => ({ columnWidths: { ...s.columnWidths, ...widths } }))
      // the width each column really has: what was measured, within the column's limits
      for (const [field, width] of Object.entries(widths)) {
        const col = c.optionsRef.current.columns.find((x) => x.field === field)
        c.optionsRef.current.onColumnWidthChange?.({ field, width: Math.min(col?.maxWidth ?? Infinity, Math.max(col?.minWidth ?? DEFAULT_MIN_WIDTH, width)) })
      }
      return widths
    },
  }
}
