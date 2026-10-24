// Concatenate src/ui/styles/index.css (and the files it @imports, in order) into dist/styles.css.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

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

mkdirSync(resolve(root, 'dist'), { recursive: true })
writeFileSync(resolve(root, 'dist/styles.css'), inline(entry))
