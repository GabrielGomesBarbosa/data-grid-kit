// Fails the build when an entry lost its 'use client' directive (Next.js Server Components would break).
import { readFileSync } from 'node:fs'

for (const file of ['dist/index.js', 'dist/core.js']) {
  const head = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').slice(0, 40)
  if (!/^['"]use client['"]/.test(head)) {
    console.error(`${file} does not start with 'use client'`)
    process.exit(1)
  }
}
