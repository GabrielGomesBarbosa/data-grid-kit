import { useCallback } from 'react'
import { defaultFilterItem, type CsvOptions } from '../core'
import { type PanelKind, downloadText } from './Toolbar'
import type { GridCtx } from './ctx'

export function usePanels<R>(c: GridCtx<R>) {
  const { setPanel, setMenu, menu, columns, state, api, csvFileName } = c

  /* ---- panels ---- */

  const openMenu = useCallback((field: string, anchor: DOMRect) => {
    setPanel(null)
    setMenu((m) => (m?.field === field ? null : { field, anchor }))
  }, [setMenu, setPanel])
  const openPanel = (kind: PanelKind, anchor: DOMRect) => {
    setMenu(null)
    setPanel((p) => (p?.kind === kind ? null : { kind, anchor }))
  }
  const openFilterFor = (field: string) => {
    const anchor = menu?.anchor
    setMenu(null)
    const col = columns.find((c) => c.field === field)
    if (col && state.filterModel.items.length === 0) {
      api.setFilterModel({ ...state.filterModel, items: [defaultFilterItem(col)] })
    }
    if (anchor) setPanel({ kind: 'filters', anchor })
  }
  const doExport = (opts: CsvOptions & { selectedOnly?: boolean }) => {
    downloadText(api.getCsv(opts), csvFileName)
    setPanel(null)
  }

  return { openMenu, openPanel, doExport, openFilterFor }
}
