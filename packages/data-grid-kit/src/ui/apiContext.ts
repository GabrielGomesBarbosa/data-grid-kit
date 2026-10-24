import { createContext, useContext, useRef, type MutableRefObject } from 'react'
import { useStore, type GridApi, type GridState } from '../core'

const ApiContext = createContext<GridApi<any> | null>(null)
export const ApiProvider = ApiContext.Provider

/** The api of the grid this component is rendered in (a slot, a `renderCell`, a toolbar part). Throws outside a `<Grid>`. */
export function useGridApiContext<R = any>(): GridApi<R> {
  const api = useContext(ApiContext)
  if (!api) throw new Error('data-grid-kit: this hook must be called inside a <Grid> (a slot or a renderer), or use useGridApiRef and the Grid\'s apiRef prop outside it')
  return api
}

/** A ref for the api of a grid you render yourself: pass it as `apiRef`, read `.current` in handlers and effects (it is `null` until the grid has mounted). */
export function useGridApiRef<R = any>(): MutableRefObject<GridApi<R> | null> {
  return useRef<GridApi<R> | null>(null)
}

/** A slice of the grid's state, inside the grid: re-renders only when the slice changes (compare with `Object.is`, so select values, not new objects). */
export function useGridSelector<T>(selector: (state: GridState) => T): T {
  return useStore(useGridApiContext().store, selector)
}
