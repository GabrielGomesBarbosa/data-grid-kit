import { createContext, useContext } from 'react'
import { defaultLocaleText, type GridLocaleText } from '../core'

export interface LocaleValue {
  /** every text the grid shows (the defaults with the grid's `localeText` on top) */
  text: GridLocaleText
  /** the locale numbers and dates are written in (`undefined`: the browser's) */
  locale: string | undefined
}

const LocaleContext = createContext<LocaleValue>({ text: defaultLocaleText, locale: undefined })
export const LocaleProvider = LocaleContext.Provider

/** The texts and the locale of the grid this component is rendered in. Outside a grid: English and the browser's locale. */
export function useLocaleText(): LocaleValue {
  return useContext(LocaleContext)
}
