// Records the React example as PNG frames (Chrome DevTools Protocol, no extra dependency but `ws`), then
// `assemble.py` turns them into docs/media/demo.gif. Run with the example's dev server up:
//   npm run dev -w react-example   (port 5400)   then   node tools/media/capture.mjs
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import WebSocket from 'ws'

const URL_ = process.env.EXAMPLE_URL ?? 'http://localhost:5400/'
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = new URL('./frames/', import.meta.url).pathname
const W = 1280
const H = 900
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=/tmp/gk-capture-${process.pid}`, `--window-size=${W},${H}`, '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' })
const stop = () => chrome.kill()
process.on('exit', stop)

let targets
for (let i = 0; i < 50 && !targets; i++) {
  try {
    targets = await (await fetch('http://localhost:9333/json')).json()
  } catch {
    await sleep(200)
  }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
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
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const i = ++id
  pending.set(i, { resolve, reject })
  ws.send(JSON.stringify({ id: i, method, params }))
})
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })

const frames = []
let n = 0
async function frame(ms, name) {
  await sleep(250)
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  const file = `${String(n++).padStart(2, '0')}${name ? `-${name}` : ''}.png`
  writeFileSync(OUT + file, Buffer.from(data, 'base64'))
  frames.push({ file, ms })
}
/** the centre of the first element matching `selector` whose text includes `text` */
const centre = (selector, text = '') => evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.includes(${JSON.stringify(text)}) || e.getAttribute('aria-label')?.includes(${JSON.stringify(text)})); if (!el) return null; el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
async function move(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
}
async function click(selector, text = '') {
  const p = await centre(selector, text)
  if (!p) throw new Error(`nothing to click: ${selector} ${text}`)
  await move(p.x, p.y)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 })
}
const type = (text) => send('Input.insertText', { text })

await send('Page.navigate', { url: URL_ })
await sleep(1800)

// 1. the page
await frame(2200, 'start')
// 2. sort by salary, both ways
await click('.gk-header-title', 'Salary')
await frame(1400, 'sort-asc')
await click('.gk-header-title', 'Salary')
await frame(1400, 'sort-desc')
await click('.gk-header-title', 'Salary')
// 3. the column menu
const team = await centre('.gk-header-cell[data-field="team"]')
await move(team.x, team.y)
await click('.gk-header-cell[data-field="team"] .gk-menu-btn')
await frame(2200, 'menu')
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' })
// 4. quick search
await click('.gk-quick-filter button', 'Search')
await sleep(200)
await type('pay')
await frame(1500, 'search')
await click('.gk-quick-filter button', 'Clear search')
await sleep(200)
// 5. filter panel
await click('.gk-toolbar-button', 'Filters')
await frame(2200, 'filters')
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' })
// 6. grouping
await click('.bar button', 'Group by')
await sleep(300)
await frame(1500, 'grouped')
await click('.gk-toggle')
await sleep(250)
await frame(1800, 'grouped-open')
await click('.bar button', 'Group by')
await sleep(300)
// 7. pivot
await click('.bar button', 'Pivot')
await sleep(500)
await frame(2800, 'pivot')
await click('.bar button', 'Pivot')
await sleep(300)
// 8. back to the start
await frame(1500, 'end')

writeFileSync(OUT + 'frames.json', JSON.stringify(frames))
// the light screenshot
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
await sleep(500)
const { data } = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(new URL('../../docs/media/screenshot-light.png', import.meta.url).pathname, Buffer.from(data, 'base64'))
ws.close()
stop()
console.log(`${frames.length} frames in ${OUT}`)
