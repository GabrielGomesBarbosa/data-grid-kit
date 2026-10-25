import { lazy, Suspense, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { makeRows } from './data'
import type { AdapterProps, Controls } from './types'
import { runBenchmark } from './runner'

const loaders = {
  gridkit: () => import('./gridkit'),
  mui: () => import('./mui'),
  aggrid: () => import('./aggrid'),
}
type Lib = keyof typeof loaders

const params = new URLSearchParams(location.search)
const lib = (params.get('lib') ?? 'gridkit') as Lib
const count = Number(params.get('rows') ?? 10000)

declare global {
  interface Window {
    __bench: { controls: Controls | null; mountMs: number; ready: boolean; run: () => Promise<unknown>; lib: Lib; rows: number }
  }
}
window.__bench = { controls: null, mountMs: 0, ready: false, run: async () => runBenchmark(window.__bench.controls!), lib, rows: count }

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

async function main() {
  const rows = makeRows(count)
  // the library is downloaded and parsed before the clock starts: the mount time is the time to draw rows, not to fetch code
  const Adapter = lazy(loaders[lib]) as React.LazyExoticComponent<(p: AdapterProps) => JSX.Element>
  await loaders[lib]()
  function App() {
    const onReady = useCallback((c: Controls) => {
      window.__bench.controls = c
    }, [])
    return (
      <Suspense fallback={null}>
        <Adapter rows={rows} onReady={onReady} />
      </Suspense>
    )
  }
  const t0 = performance.now()
  createRoot(document.getElementById('root')!).render(<App />)
  // done when a row with text is on the screen and a frame has been painted after it
  for (;;) {
    await frame()
    const c = window.__bench.controls
    if (c && c.rowElements() > 0 && c.signature().replace(/\|/g, '').trim() !== '') break
  }
  await frame()
  window.__bench.mountMs = performance.now() - t0
  window.__bench.ready = true
}
void main()
