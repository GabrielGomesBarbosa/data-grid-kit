import { memo, useMemo, type ComponentType, type FunctionComponent } from 'react'
import { defaultSlots } from '../defaultSlots'
import { rowPropsEqual } from '../Row'
import type { GridSlotProps, GridSlots } from '../slotTypes'

const NO_SLOT_PROPS: GridSlotProps = {}

/** a custom `row` slot, memoised once with the grid's own comparison (the same component object gives the same wrapper) */
const memoRows = new WeakMap<object, ComponentType<any>>()
function memoRow(component: ComponentType<any>): ComponentType<any> {
  let wrapped = memoRows.get(component)
  if (!wrapped) memoRows.set(component, (wrapped = memo(component as FunctionComponent<any>, rowPropsEqual as (a: any, b: any) => boolean)))
  return wrapped
}

/** The slots of a grid: the built-in ones with the ones the user gave on top, and the props for them. */
export function useSlotsValue<R>(userSlots: Partial<GridSlots<R>> | undefined, slotProps: GridSlotProps<R> = NO_SLOT_PROPS) {
  return useMemo(() => {
    const slots = { ...defaultSlots, ...userSlots, icons: { ...defaultSlots.icons, ...userSlots?.icons } } as GridSlots<R>
    // the speed of the grid must not depend on how a replacement row was written
    if (userSlots?.row) slots.row = memoRow(userSlots.row)
    return { slots, slotProps }
  }, [userSlots, slotProps])
}
