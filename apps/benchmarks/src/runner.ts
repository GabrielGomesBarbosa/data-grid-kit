import type { Controls } from './types'

const frame = () => new Promise<number>((resolve) => requestAnimationFrame((t) => resolve(t)))
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** run `change`, then wait until the rows on screen are different; the time includes the frame that paints them */
async function timeChange(c: Controls, change: () => void): Promise<number> {
  const before = c.signature()
  const t0 = performance.now()
  change()
  for (let i = 0; i < 600; i++) {
    await frame()
    if (c.signature() !== before) break
  }
  await frame()
  return performance.now() - t0
}

/** scroll the rows by `step` px each frame and keep the time every frame took */
async function scrollFrames(c: Controls, frames: number, step: number) {
  const el = c.scroller()!
  el.scrollTop = 0
  await sleep(100)
  const times: number[] = []
  let last = await frame()
  for (let i = 0; i < frames; i++) {
    el.scrollTop += step
    const now = await frame()
    times.push(now - last)
    last = now
  }
  const sorted = [...times].sort((a, b) => a - b)
  const sum = times.reduce((a, b) => a + b, 0)
  return {
    meanFrameMs: sum / times.length,
    p95FrameMs: sorted[Math.floor(sorted.length * 0.95)]!,
    maxFrameMs: sorted[sorted.length - 1]!,
    slowFrames: times.filter((t) => t > 33.4).length, // below 30 fps
    frames: times.length,
  }
}

export async function runBenchmark(c: Controls) {
  await sleep(300)
  const out: Record<string, unknown> = {}
  out.domNodes = document.querySelectorAll('*').length
  out.rowElements = c.rowElements()

  out.scroll = await scrollFrames(c, 150, 36 * 20)
  c.scroller()!.scrollTop = 0
  await sleep(200)

  out.sortAscMs = await timeChange(c, () => c.sort('name', 'asc'))
  await sleep(200)
  out.sortDescMs = await timeChange(c, () => c.sort('name', 'desc'))
  await sleep(200)
  out.sortNumberMs = await timeChange(c, () => c.sort('salary', 'asc'))
  await sleep(200)
  out.filterMs = await timeChange(c, () => c.quickFilter('lisbon'))
  await sleep(200)
  out.clearFilterMs = await timeChange(c, () => c.quickFilter(''))
  return out
}
