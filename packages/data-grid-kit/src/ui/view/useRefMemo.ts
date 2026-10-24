import { useRef } from 'react'

/** useMemo that recomputes only when the dependency identities change */
export function useRefMemo<T>(factory: () => T, deps: unknown[]): T {
  const ref = useRef<{ deps: unknown[]; value: T }>()
  if (!ref.current || ref.current.deps.some((d, i) => !Object.is(d, deps[i]))) {
    ref.current = { deps, value: factory() }
  }
  return ref.current.value
}
