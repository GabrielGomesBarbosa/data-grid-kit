import { toCsv } from '../csv'
import { buildXlsx, XLSX_MIME } from '../xlsx'
import { sheetOfGrid } from '../xlsxExport'
import { PIVOT_ROWS_FIELD } from '../pivot'
import { type ColumnDef, type RowId } from '../types'
import type { ApiContext } from './context'
import type { GridApi } from '../gridTypes'

export function exportApi<R>(c: ApiContext<R>): Pick<GridApi<R>, 'getXlsx' | 'exportXlsx' | 'getCsv'> {
  const { resultRef, layoutRef, optionsRef, store, apiRef, pinningActiveRef, rowIdOf } = c
  return {
    async getXlsx(options = {}) {
      const result = resultRef.current
      const layout = layoutRef.current
      if (!result || !layout) throw new Error('The grid is not ready')
      const o = optionsRef.current
      const sheet = sheetOfGrid({
        columns: layout.all,
        rows: result.getExportRows(),
        totals: o.aggregationFooter === false ? undefined : result.getTotals(),
        widthOf: layout.width,
        selection: options.selectedOnly ? new Set(store.getState().selection) : undefined,
        options,
      })
      return buildXlsx(sheet, options)
    },
    async exportXlsx(options = {}) {
      const bytes = await apiRef.current!.getXlsx(options)
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: XLSX_MIME }))
      const a = document.createElement('a')
      a.href = url
      a.download = options.fileName ?? 'export.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    },
    getCsv(options) {
      const result = resultRef.current
      const layout = layoutRef.current
      if (!result || !layout) return ''
      if (layout.all.some((c) => c.field === PIVOT_ROWS_FIELD)) {
        // a pivot table exports what it shows: group rows with their aggregates (numbers, not text)
        const cols: ColumnDef<{ label: string; values: Record<string, unknown> }>[] = layout.all.map((c) => ({
          field: c.field,
          headerName: [...(c.group ?? []), c.headerName ?? c.field].join(' / '),
          type: c.field === PIVOT_ROWS_FIELD ? 'string' : 'number',
          valueGetter: (r) => (c.field === PIVOT_ROWS_FIELD ? r.label : r.values[c.field]),
        }))
        const body = result.rows
          .filter((r) => r.type === 'group')
          .map((r) => ({ label: r.groupValue == null || r.groupValue === '' ? '(empty)' : String(r.groupValue), values: r.aggregates ?? {} }))
        return toCsv(cols, body, options)
      }
      let rows = result.getVisibleDataRows()
      const pinned = store.getState().pinnedRows
      const pinnedIdsNow = [...pinned.top, ...pinned.bottom]
      if (pinnedIdsNow.length && pinningActiveRef.current) {
        // same order the user sees: pinned-top rows, the scrolling rows, pinned-bottom rows
        const hidden = new Set(pinnedIdsNow)
        const pick = (ids: RowId[]) => ids.map((id) => result.getRow(id)).filter((r): r is R => r !== undefined)
        rows = [...pick(pinned.top), ...rows.filter((r) => !hidden.has(rowIdOf(r))), ...pick(pinned.bottom)]
      }
      if (options?.selectedOnly) {
        const chosen = new Set(store.getState().selection)
        rows = rows.filter((r) => chosen.has(rowIdOf(r)))
      }
      return toCsv(layout.all, rows, options)
    },
  }
}
