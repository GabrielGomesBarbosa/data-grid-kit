// Turns results.json (and the build sizes) into the Markdown tables used in the README.
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const { machine, results } = JSON.parse(readFileSync(new URL('./results.json', import.meta.url), 'utf8'))
const sizes = JSON.parse(execSync('node size.mjs', { cwd: new URL('.', import.meta.url).pathname }).toString())
const libs = [
  ['gridkit', 'data-grid-kit'],
  ['mui', 'MUI X DataGridPro'],
  ['aggrid', 'AG Grid Community'],
]
const fmt = (n, d = 0) => n.toFixed(d)
const sizeOf = (key) => [...new Set(Object.keys(results).map((k) => Number(k.split(':')[1])))].sort((a, b) => a - b)
const rowsets = sizeOf()

const table = (rows) => {
  const head = ['', ...libs.map(([, name]) => name)]
  const lines = [`| ${head.join(' | ')} |`, `|${head.map((_, i) => (i ? '---:' : '---')).join('|')}|`]
  for (const [label, get, best = 'min'] of rows) {
    const values = libs.map(([id]) => get(id))
    const top = best === 'min' ? Math.min(...values) : Math.max(...values)
    lines.push(`| ${label} | ${values.map((v, i) => (v === top ? `**${fmt(v, v < 10 ? 1 : 0)}**` : fmt(v, v < 10 ? 1 : 0))).join(' | ')} |`)
  }
  return lines.join('\n')
}

for (const n of rowsets) {
  const r = (id) => results[`${id}:${n}`]
  console.log(`\n#### ${n.toLocaleString('en-US')} rows\n`)
  console.log(
    table([
      ['First rows on screen (ms)', (id) => r(id).mountMs],
      ['Sort by text (ms)', (id) => (r(id).sortTextAscMs + r(id).sortTextDescMs) / 2],
      ['Sort by number (ms)', (id) => r(id).sortNumberMs],
      ['Quick filter (ms)', (id) => r(id).filterMs],
      ['Clear the filter (ms)', (id) => r(id).clearFilterMs],
      ['Scroll, slowest frame (ms)', (id) => r(id).scrollMaxMs],
      ['Scroll, frames under 30 fps (of 150)', (id) => r(id).slowFrames],
      ['JS heap after loading (MB)', (id) => r(id).heapMb],
    ]),
  )
}
console.log('\n#### Size added to a page\n')
console.log(`| | ${libs.map(([, n]) => n).join(' | ')} |\n|---|---:|---:|---:|\n| Gzipped JS + CSS (kB) | ${libs.map(([id]) => fmt(sizes[id].gzipKb)).join(' | ')} |`)
console.log(`\n_${machine.chrome}, ${machine.cpu}, ${machine.cores} cores, ${machine.memoryGb} GB, median of ${machine.runs} runs, CPU throttled ${machine.cpuThrottle}x for the interactions, ${machine.date}._`)
