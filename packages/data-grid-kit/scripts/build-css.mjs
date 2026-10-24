// Builds the stylesheets in dist/ from src/ui/styles/index.css (its @imports, in order):
//   styles.css     everything: structure + the default theme
//   structure.css  only what makes the grid work (positioning, sticky pinning, overflow, flex layout, sizes): no colors, fonts, borders or spacing
//   theme.css      the default look: variables, colors, borders, spacing, fonts, animations
// The split is by CSS property (STRUCTURE below), so there is one source and the rules cannot drift apart.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { splitCss } from './css-split.mjs'

const root = resolve(import.meta.dirname, '..')
const entry = resolve(root, 'src/ui/styles/index.css')

const inline = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => {
      const m = /^@import\s+'([^']+)';\s*$/.exec(line)
      return m ? inline(resolve(dirname(file), m[1])) : line
    })
    .join('\n')

const all = inline(entry)
const { structure, theme } = splitCss(all)

mkdirSync(resolve(root, 'dist'), { recursive: true })
writeFileSync(resolve(root, 'dist/styles.css'), all)
writeFileSync(resolve(root, 'dist/structure.css'), `/* data-grid-kit: the structure the grid needs. Add your own look. */\n${structure}`)
writeFileSync(resolve(root, 'dist/theme.css'), `/* data-grid-kit: the default look. Use with structure.css (or import styles.css, which has both). */\n${theme}`)
