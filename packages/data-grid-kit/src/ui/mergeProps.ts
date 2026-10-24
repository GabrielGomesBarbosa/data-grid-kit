import type { CSSProperties } from 'react'

type Props = Record<string, unknown>

/**
 * Merge two prop objects the way a prop getter's caller expects: class names are joined, styles are merged (the
 * second wins), `on*` handlers are chained (the grid's first, then yours) and everything else is overridden.
 */
export function mergeProps<T extends Props>(own: T, extra?: Props): T {
  if (!extra) return own
  const out: Props = { ...own }
  for (const key of Object.keys(extra)) {
    const mine = own[key]
    const theirs = extra[key]
    if (key === 'className') out[key] = [mine, theirs].filter(Boolean).join(' ') || undefined
    else if (key === 'style') out[key] = { ...(mine as CSSProperties), ...(theirs as CSSProperties) }
    else if (/^on[A-Z]/.test(key) && typeof mine === 'function' && typeof theirs === 'function') {
      out[key] = (...args: unknown[]) => {
        ;(mine as (...a: unknown[]) => void)(...args)
        ;(theirs as (...a: unknown[]) => void)(...args)
      }
    } else out[key] = theirs
  }
  return out as T
}
