import { useCallback, useRef, useState } from 'react'
import type { RowId } from './types'

/**
 * The heights of `'auto'` rows, as measured on screen, by row id. `report` takes what a renderer measured; the grid's row
 * positions follow (`version` changes whenever a height does). Heights stay known while a row is out of view.
 */
export function useMeasuredHeights() {
  const measured = useRef(new Map<RowId, number>())
  const [version, setVersion] = useState(0)
  const report = useCallback((heights: ReadonlyMap<RowId, number>) => {
    let changed = false
    for (const [id, h] of heights) {
      if (!(h > 0) || measured.current.get(id) === h) continue
      measured.current.set(id, h)
      changed = true
    }
    if (changed) setVersion((v) => v + 1)
  }, [])
  return { measured: measured.current, version, report }
}
