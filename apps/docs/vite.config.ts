import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const lib = (p: string) => fileURLToPath(new URL(`../../packages/data-grid-kit/${p}`, import.meta.url))

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: './',
  server: { port: 5300 },
  build: { outDir: 'dist', emptyOutDir: true },
  // while developing, the library is read from its source so edits show up at once; a build uses the built package,
  // exactly like an app that installed it
  resolve:
    command === 'serve'
      ? {
          alias: [
            { find: /^data-grid-kit\/core$/, replacement: lib('src/core/index.ts') },
            { find: /^data-grid-kit\/locales$/, replacement: lib('src/locales/index.ts') },
            { find: /^data-grid-kit\/xlsx-worker(\?.*)?$/, replacement: lib('src/xlsx-worker.ts') + '$1' },
            { find: /^data-grid-kit\/styles\.css$/, replacement: lib('src/ui/styles/index.css') },
            { find: /^data-grid-kit$/, replacement: lib('src/index.ts') },
          ],
        }
      : {},
}))
