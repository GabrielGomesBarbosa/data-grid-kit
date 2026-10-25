// Gzip size of what each library adds to the page (the chunk of its adapter and its CSS), from `vite build`. React is in the shared chunk.
import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const dir = new URL('./dist/assets/', import.meta.url)
const out = {}
for (const file of readdirSync(dir)) {
  const m = /^(gridkit|mui|aggrid)-.*\.(js|css)$/.exec(file)
  if (!m) continue
  const buf = readFileSync(new URL(file, dir))
  out[m[1]] ??= { rawKb: 0, gzipKb: 0 }
  out[m[1]].rawKb += buf.length / 1024
  out[m[1]].gzipKb += gzipSync(buf).length / 1024
}
console.log(JSON.stringify(out, null, 2))
