import { cellToText, emptyValueFor, parseCellText, parseTsv, toTsv } from '../clipboard'
import { fillSourceOf, fillTarget, type RangeRect } from '../range'
import { getCellValue } from '../values'
import { DataSourceError } from '../dataSource'
import { type RowId } from '../types'
import type { ApiContext } from './context'
import type { ApplyResult, GridApi } from '../gridTypes'

export function cellsApi<R>(c: ApiContext<R>): Pick<GridApi<R>, 'focusCell' | 'selectCells' | 'extendCellSelection' | 'clearCellSelection' | 'getCellRects' | 'copySelection' | 'applyCellValues' | 'pasteText' | 'clearSelectedCells' | 'fillCells'> {
  const { set, rectsNow, resultRef, layoutRef, store, rowIdOf, optionsRef, canEdit, persist, commitRows, apiRef, pointAt } = c
  return {
    focusCell(cell) {
      set((s) => {
        const editing = s.editingCell
        const keepEdit = editing && cell && editing.rowId === cell.rowId && editing.field === cell.field
        return { focusedCell: cell, editingCell: keepEdit ? editing : null }
      })
    },
    selectCells: (range, opts) =>
      set((s) => ({ cellSelection: opts?.add ? [...s.cellSelection, range] : [range] })),
    extendCellSelection: (focus) =>
      set((s) => {
        const list = s.cellSelection
        const last = list[list.length - 1]
        if (last) return { cellSelection: [...list.slice(0, -1), { anchor: last.anchor, focus }] }
        const f = s.focusedCell
        return f ? { cellSelection: [{ anchor: { rowId: f.rowId, field: f.field }, focus }] } : {}
      }),
    clearCellSelection: () => set({ cellSelection: [] }),
    getCellRects: () => rectsNow(),
    copySelection() {
      const res = resultRef.current
      const layout = layoutRef.current
      if (!res || !layout) return ''
      const cols = layout.all
      const rects = rectsNow()
      const last = rects[rects.length - 1]
      const matrix: string[][] = []
      if (last) {
        for (let r = last.r0; r <= last.r1; r++) {
          const row = res.rows[r]?.row
          if (row === undefined) continue // group rows have no values
          matrix.push(cols.slice(last.c0, last.c1 + 1).map((c) => cellToText(c, row)))
        }
      } else {
        const s = store.getState()
        if (s.selection.length) {
          const chosen = new Set(s.selection)
          for (const row of res.getVisibleDataRows()) if (chosen.has(rowIdOf(row))) matrix.push(cols.map((c) => cellToText(c, row)))
        } else if (s.focusedCell) {
          const row = res.getRow(s.focusedCell.rowId)
          const col = cols.find((c) => c.field === s.focusedCell!.field)
          if (row !== undefined && col) matrix.push([cellToText(col, row)])
        }
      }
      return toTsv(matrix)
    },
    async applyCellValues(changes) {
      const res = resultRef.current
      const o = optionsRef.current
      const out: ApplyResult = { applied: 0, skipped: 0, rejected: 0 }
      if (!res) return out
      const byRow = new Map<RowId, { field: string; value: unknown }[]>()
      for (const ch of changes) {
        if (!canEdit(ch.rowId, ch.field)) {
          out.skipped++
          continue
        }
        const list = byRow.get(ch.rowId)
        if (list) list.push(ch)
        else byRow.set(ch.rowId, [ch])
      }
      const updated: R[] = []
      await Promise.all(
        [...byRow].map(async ([rowId, list]) => {
          const old = res.getRow(rowId) as R
          let next: R = old
          for (const { field, value } of list) {
            const col = o.columns.find((c) => c.field === field)!
            next = col.valueSetter ? col.valueSetter(value, next) : ({ ...next, [field]: value } as R)
          }
          const same =
            next === old || Object.keys(next as object).every((k) => Object.is((next as any)[k], (old as any)[k]))
          if (same) {
            out.skipped += list.length
            return
          }
          try {
            updated.push(await persist(next, old, rowId))
            out.applied += list.length
          } catch (error) {
            out.rejected += list.length
            if (!(error instanceof DataSourceError)) o.onProcessRowUpdateError?.(error)
          }
        }),
      )
      if (updated.length) commitRows(updated)
      return out
    },
    async pasteText(text) {
      const res = resultRef.current
      const layout = layoutRef.current
      const empty: ApplyResult = { applied: 0, skipped: 0, rejected: 0 }
      const matrix = parseTsv(text)
      if (!res || !layout || !matrix.length) return empty
      const cols = layout.all
      const rects = rectsNow()
      const active = rects[rects.length - 1]
      let origin: { r: number; c: number } | null = active ? { r: active.r0, c: active.c0 } : null
      if (!origin) {
        const f = store.getState().focusedCell
        const r = f ? res.indexOf(f.rowId) : -1
        const c = f ? cols.findIndex((x) => x.field === f.field) : -1
        if (r < 0 || c < 0) return empty
        origin = { r, c }
      }
      // one value pasted over a bigger selection fills all of it, like a spreadsheet
      const single = matrix.length === 1 && matrix[0]!.length === 1
      const width = Math.max(...matrix.map((m) => m.length))
      const area: RangeRect =
        single && active
          ? active
          : { r0: origin.r, r1: origin.r + matrix.length - 1, c0: origin.c, c1: origin.c + width - 1 }
      const changes: { rowId: RowId; field: string; value: unknown }[] = []
      let invalid = 0
      for (let r = area.r0; r <= area.r1 && r < res.rows.length; r++) {
        const row = res.rows[r]?.row
        if (row === undefined) continue
        for (let c = area.c0; c <= area.c1 && c < cols.length; c++) {
          const cell = single ? matrix[0]![0] : matrix[r - area.r0]?.[c - area.c0]
          if (cell === undefined) continue
          const parsed = parseCellText(cols[c]!, cell, row)
          if (!parsed.ok) invalid++
          else changes.push({ rowId: res.rows[r]!.id, field: cols[c]!.field, value: parsed.value })
        }
      }
      const done = await apiRef.current!.applyCellValues(changes)
      done.skipped += invalid
      const a = pointAt(area.r0, area.c0)
      const b = pointAt(Math.min(area.r1, res.rows.length - 1), Math.min(area.c1, cols.length - 1))
      if (a && b) set({ cellSelection: [{ anchor: a, focus: b }] })
      return done
    },
    async clearSelectedCells() {
      const res = resultRef.current
      const layout = layoutRef.current
      if (!res || !layout) return { applied: 0, skipped: 0, rejected: 0 }
      const changes: { rowId: RowId; field: string; value: unknown }[] = []
      let rects = rectsNow()
      if (!rects.length) {
        const f = store.getState().focusedCell
        const r = f ? res.indexOf(f.rowId) : -1
        const c = f ? layout.all.findIndex((x) => x.field === f.field) : -1
        if (r >= 0 && c >= 0) rects = [{ r0: r, r1: r, c0: c, c1: c }]
      }
      for (const rect of rects) {
        for (let r = rect.r0; r <= rect.r1; r++) {
          if (res.rows[r]?.row === undefined) continue
          for (let c = rect.c0; c <= rect.c1; c++) {
            const col = layout.all[c]!
            changes.push({ rowId: res.rows[r]!.id, field: col.field, value: emptyValueFor(col) })
          }
        }
      }
      return apiRef.current!.applyCellValues(changes)
    },
    async fillCells(source, to) {
      const res = resultRef.current
      const layout = layoutRef.current
      const none: ApplyResult = { applied: 0, skipped: 0, rejected: 0 }
      if (!res || !layout) return none
      const target = fillTarget(source, to.row, to.col)
      if (!target) return none
      const cols = layout.all
      const changes: { rowId: RowId; field: string; value: unknown }[] = []
      for (let r = target.r0; r <= target.r1; r++) {
        const dest = res.rows[r]
        if (dest?.row === undefined) continue
        for (let c = target.c0; c <= target.c1; c++) {
          const from = fillSourceOf(source, r, c)
          const srcRow = res.rows[from.row]?.row
          const srcCol = cols[from.col]
          const dstCol = cols[c]
          if (srcRow === undefined || !srcCol || !dstCol) continue
          changes.push({ rowId: dest.id, field: dstCol.field, value: getCellValue(srcCol, srcRow) })
        }
      }
      const done = await apiRef.current!.applyCellValues(changes)
      const a = pointAt(Math.min(source.r0, target.r0), Math.min(source.c0, target.c0))
      const b = pointAt(Math.max(source.r1, target.r1), Math.max(source.c1, target.c1))
      if (a && b) set({ cellSelection: [{ anchor: a, focus: b }] })
      return done
    },
  }
}
