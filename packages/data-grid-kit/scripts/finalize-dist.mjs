// esbuild puts the banner after the CommonJS preamble ("use strict", __esModule), where it is no longer a directive.
// Put 'use client' first in each entry (Next.js reads it to treat the module as a Client Module), then verify it.
import { readFileSync, writeFileSync } from 'node:fs'

const DIRECTIVE = "'use client';"
for (const file of ['dist/index.js', 'dist/core.js', 'dist/locales.js', 'dist/index.cjs', 'dist/core.cjs', 'dist/locales.cjs']) {
  const path = new URL(`../${file}`, import.meta.url)
  const code = readFileSync(path, 'utf8')
  if (!code.startsWith(DIRECTIVE)) writeFileSync(path, DIRECTIVE + code.split(DIRECTIVE).join(''))
  if (!readFileSync(path, 'utf8').startsWith(DIRECTIVE)) {
    console.error(`${file} does not start with 'use client'`)
    process.exit(1)
  }
}
