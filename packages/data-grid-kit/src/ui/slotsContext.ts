import { createContext, useContext } from 'react'
import type { GridSlotProps, GridSlots } from './slotTypes'

export interface SlotsValue<R = any> {
  /** every slot: the built-in component, or the one you passed */
  slots: GridSlots<R>
  slotProps: GridSlotProps<R>
}

const SlotsContext = createContext<SlotsValue | null>(null)
export const SlotsProvider = SlotsContext.Provider

/** The slots of the grid this component is rendered in. */
export function useSlots<R = any>(): SlotsValue<R> {
  const value = useContext(SlotsContext)
  if (!value) throw new Error('data-grid-kit: this component must be rendered inside a <Grid>')
  return value
}
