

export const isAbort = (e: unknown) => (e instanceof Error || (typeof DOMException !== 'undefined' && e instanceof DOMException)) && (e as Error).name === 'AbortError'

export function sameShallow(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  for (const k of ka) if (!Object.is((a as any)[k], (b as any)[k])) return false
  return true
}
