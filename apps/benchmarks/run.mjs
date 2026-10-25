// Runs the benchmark page in headless Chrome (DevTools Protocol) and writes results.json and results.md.
//   npm run build -w benchmarks && npm run preview -w benchmarks   (port 5600)   then   npm run bench -w benchmarks
import { spawn } from 'node:child_process'
import { cpus, platform, release, totalmem } from 'node:os'
import { writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import WebSocket from 'ws'

const BASE = process.env.BENCH_URL ?? 'http://localhost:5600/'
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const THROTTLE = Number(process.env.THROTTLE ?? 4)
const RUNS = Number(process.env.RUNS ?? 5)
const SIZES = (process.env.SIZES ?? '10000,100000').split(',').map(Number)
const LIBS = [
  { id: 'gridkit', name: 'data-grid-kit' },
  { id: 'mui', name: 'MUI X DataGridPro' },
  { id: 'aggrid', name: 'AG Grid Community' },
]

const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9444', `--user-data-dir=/tmp/gk-bench-${process.pid}`, '--window-size=1400,900', '--disable-gpu-vsync', '--enable-precise-memory-info', 'about:blank'], { stdio: 'ignore' })
process.on('exit', () => chrome.kill())
let targets
for (let i = 0; i < 50 && !targets; i++) {
  try {
    targets = await (await fetch('http://localhost:9444/json')).json()
  } catch {
    await sleep(200)
  }
}
const version = (await (await fetch('http://localhost:9444/json/version')).json()).Browser
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl, { maxPayload: 1 << 28 })
await new Promise((r) => ws.on('open', r))
let id = 0
const pending = new Map()
ws.on('message', (m) => {
  const msg = JSON.parse(m)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const i = ++id
    pending.set(i, { resolve, reject })
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluation failed')
  return r.result.value
}
await send('Page.enable')
await send('Runtime.enable')
await send('HeapProfiler.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false })

async function once(lib, rows) {
  await send('Page.navigate', { url: 'about:blank' })
  await sleep(150)
  await send('Page.navigate', { url: `${BASE}?lib=${lib}&rows=${rows}` })
  for (let i = 0; i < 600; i++) {
    await sleep(100)
    if (await evaluate('!!window.__bench && window.__bench.ready').catch(() => false)) break
  }
  const mountMs = await evaluate('window.__bench.mountMs')
  if (!mountMs) throw new Error(`${lib} ${rows}: never became ready`)
  await sleep(500)
  await send('HeapProfiler.collectGarbage')
  const heapMb = (await send('Runtime.getHeapUsage')).usedSize / 1048576
  // the interactions run on a CPU slowed down 4x, so differences that a fast machine hides (a frame is 16.7 ms at best) show up
  await send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  const result = await evaluate('window.__bench.run()')
  await send('Emulation.setCPUThrottlingRate', { rate: 1 })
  return { mountMs, heapMb, ...result }
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const flat = (r) => ({
  mountMs: r.mountMs,
  heapMb: r.heapMb,
  domNodes: r.domNodes,
  rowElements: r.rowElements,
  scrollMeanMs: r.scroll.meanFrameMs,
  scrollP95Ms: r.scroll.p95FrameMs,
  scrollMaxMs: r.scroll.maxFrameMs,
  slowFrames: r.scroll.slowFrames,
  sortTextAscMs: r.sortAscMs,
  sortTextDescMs: r.sortDescMs,
  sortNumberMs: r.sortNumberMs,
  filterMs: r.filterMs,
  clearFilterMs: r.clearFilterMs,
})

const results = {}
for (const rows of SIZES) {
  for (const lib of LIBS) {
    const runs = []
    for (let i = 0; i < RUNS; i++) {
      try {
        runs.push(flat(await once(lib.id, rows)))
        process.stdout.write(`${lib.id} ${rows} run ${i + 1}/${RUNS}\n`)
      } catch (e) {
        process.stdout.write(`${lib.id} ${rows} run ${i + 1} failed: ${e.message}\n`)
      }
    }
    const keys = Object.keys(runs[0] ?? {})
    results[`${lib.id}:${rows}`] = Object.fromEntries(keys.map((k) => [k, median(runs.map((r) => r[k]))]))
  }
}

const machine = { chrome: version, os: `${platform()} ${release()}`, cpu: cpus()[0]?.model, cores: cpus().length, memoryGb: Math.round(totalmem() / 2 ** 30), runs: RUNS, cpuThrottle: THROTTLE, date: new Date().toISOString().slice(0, 10) }
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify({ machine, results }, null, 2) + '\n')
chrome.kill()
process.exit(0)
