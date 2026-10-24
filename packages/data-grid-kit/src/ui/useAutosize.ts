import { useEffect, type MutableRefObject, type RefObject } from 'react'
import type { ColumnMeasurer, GridApi, GridInstance } from '../core'

/** the widest of `widths` that is not an outlier (past `factor` times the spread of the middle half), or the plain widest */
function widest(widths: number[], includeOutliers: boolean, factor: number): number {
  if (widths.length === 0) return 0
  if (includeOutliers || widths.length < 4) return Math.max(...widths)
  const sorted = [...widths].sort((a, b) => a - b)
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))]!
  const fence = q(0.75) + factor * (q(0.75) - q(0.25))
  return Math.max(...sorted.filter((w) => w <= fence), q(0.5))
}

/**
 * Registers how this grid measures a column: copies of the header and of the cells that are on screen go into an invisible box
 * that lays them out at their natural width, and the widest counts. Works with any `renderCell`, and costs nothing until asked.
 */
export function useAutosize<R>(api: GridApi<R>, scrollerRef: RefObject<HTMLDivElement>, gridRef: MutableRefObject<GridInstance<R>>) {
  useEffect(() => {
    const measure: ColumnMeasurer = (fields, options) => {
      const scroller = scrollerRef.current
      if (!scroller) return {}
      const probe = document.createElement('div')
      probe.className = `${scroller.closest('.gk-root')?.className ?? 'gk-root'} gk-measure`
      probe.setAttribute('aria-hidden', 'true')
      probe.style.cssText = 'position:fixed;left:-100000px;top:0;height:auto;width:auto;visibility:hidden;pointer-events:none;overflow:visible'
      const copies = new Map<string, { header?: HTMLElement; cells: HTMLElement[] }>()
      const add = (source: Element, field: string, header: boolean) => {
        const copy = source.cloneNode(true) as HTMLElement
        copy.removeAttribute('id')
        // natural width: no fixed width or position, and no ellipsis on the text inside
        copy.style.cssText = 'position:static;display:inline-flex;width:max-content;max-width:none;min-width:0;height:auto;flex:none;transform:none'
        for (const text of copy.querySelectorAll<HTMLElement>('.gk-cell-text, .gk-header-label, .gk-header-title')) {
          text.style.cssText = 'overflow:visible;text-overflow:clip;white-space:nowrap;flex:none;max-width:none'
        }
        const row = document.createElement('div')
        row.appendChild(copy)
        probe.appendChild(row)
        const entry = copies.get(field) ?? { cells: [] }
        if (header) entry.header = copy
        else entry.cells.push(copy)
        copies.set(field, entry)
      }
      for (const field of fields) {
        const sel = `[data-field="${field.replace(/["\\]/g, "\\$&")}"]`
        if (options.includeHeaders) {
          const h = scroller.querySelector(`.gk-header-cell${sel}`)
          if (h) add(h, field, true)
        }
        for (const cell of scroller.querySelectorAll(`.gk-row .gk-cell${sel}:not([data-editing])`)) add(cell, field, false)
      }
      document.body.appendChild(probe)
      const out: Record<string, number> = {}
      try {
        for (const [field, { header, cells }] of copies) {
          const body = widest(cells.map((c) => c.offsetWidth), options.includeOutliers, options.outliersFactor)
          out[field] = Math.max(header?.offsetWidth ?? 0, body) + 1
        }
      } finally {
        probe.remove()
      }
      return out
    }
    api.setColumnMeasurer(measure)
    return () => api.setColumnMeasurer(null)
  }, [api, scrollerRef, gridRef])
}
