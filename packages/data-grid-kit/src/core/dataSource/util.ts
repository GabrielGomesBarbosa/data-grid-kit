

export const isAbort = (e: unknown) => (e instanceof Error || (typeof DOMException !== 'undefined' && e instanceof DOMException)) && (e as Error).name === 'AbortError'

export function sameShallow(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  for (const k of ka) if (!Object.is((a as any)[k], (b as any)[k])) return false
  return true
}

/** the blocks around the view that should exist (`rowCount` < 0 when the server has not said) */
export function wantedBlocks(view: { start: number; end: number } | null, chunkSize: number, prefetch: number, rowCount: number) {
  const v = view ?? { start: 0, end: 0 }
  let first = Math.max(0, Math.floor(v.start / chunkSize) - prefetch)
  let last = Math.floor(v.end / chunkSize) + prefetch
  if (rowCount >= 0) last = Math.min(last, Math.max(0, Math.ceil(rowCount / chunkSize) - 1))
  if (rowCount === 0) last = -1
  first = Math.min(first, last + 1)
  return { first, last }
}

/** `head` plus the blocks right next to it that are also queued (taken out of the queue), so one request fetches them all */
export function takeRun(queue: number[], head: number, max: number): number[] {
  const chunks = [head]
  for (let grow = true; grow && chunks.length < max; ) {
    grow = false
    const lo = Math.min(...chunks) - 1
    const hi = Math.max(...chunks) + 1
    for (const next of [hi, lo]) {
      const at = queue.indexOf(next)
      if (at >= 0 && chunks.length < max) {
        queue.splice(at, 1)
        chunks.push(next)
        grow = true
      }
    }
  }
  return chunks
}
