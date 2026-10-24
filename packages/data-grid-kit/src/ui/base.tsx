import { forwardRef, type ComponentType, type InputHTMLAttributes, type ButtonHTMLAttributes, type RefAttributes, type SelectHTMLAttributes } from 'react'
import { useSlots } from './slotsContext'

/**
 * The form controls the grid's own panels, menus, pager and cells are made of. They are slots (`baseButton`,
 * `baseCheckbox`, `baseSelect`, `baseInput`), so a design system replaces each once and every part of the grid uses it.
 * A replacement must accept (and for the checkbox: forward) the props and ref of the native element.
 */
export type BaseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & RefAttributes<HTMLButtonElement>
export type BaseInputProps = InputHTMLAttributes<HTMLInputElement> & RefAttributes<HTMLInputElement>
export type BaseSelectProps = SelectHTMLAttributes<HTMLSelectElement> & RefAttributes<HTMLSelectElement>

export interface BaseSlots {
  baseButton: ComponentType<BaseButtonProps>
  baseCheckbox: ComponentType<BaseInputProps>
  baseSelect: ComponentType<BaseSelectProps>
  baseInput: ComponentType<BaseInputProps>
}

export const BaseButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function BaseButton({ type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} {...rest} />
})
export const BaseCheckbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function BaseCheckbox(props, ref) {
  return <input ref={ref} type="checkbox" {...props} />
})
export const BaseSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function BaseSelect(props, ref) {
  return <select ref={ref} {...props} />
})
export const BaseInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function BaseInput(props, ref) {
  return <input ref={ref} {...props} />
})

/** the controls of the grid this component is rendered in */
export function useBase() {
  const { slots } = useSlots()
  return { Button: slots.baseButton, Checkbox: slots.baseCheckbox, Select: slots.baseSelect, Input: slots.baseInput }
}
