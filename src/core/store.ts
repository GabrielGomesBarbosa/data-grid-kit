import { useRef, useSyncExternalStore } from 'react'

export type Listener = () => void

export interface Store<S> {
  getState(): S
  setState(update: Partial<S> | ((prev: S) => Partial<S>)): void
  subscribe(listener: Listener): () => void
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial
  const listeners = new Set<Listener>()
  return {
    getState: () => state,
    setState(update) {
      const patch = typeof update === 'function' ? update(state) : update
      let changed = false
      for (const key of Object.keys(patch) as (keyof S)[]) {
        if (!Object.is(state[key], patch[key])) {
          changed = true
          break
        }
      }
      if (!changed) return
      state = { ...state, ...patch }
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Subscribe a component to a slice of the store; re-renders only when the slice changes. */
export function useStore<S, T>(
  store: Store<S>,
  selector: (state: S) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const last = useRef<{ value: T } | undefined>(undefined)
  const getSnapshot = () => {
    const next = selector(store.getState())
    if (last.current && isEqual(last.current.value, next)) return last.current.value
    last.current = { value: next }
    return next
  }
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}
