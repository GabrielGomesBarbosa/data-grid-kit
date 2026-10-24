import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const lib = (p: string) => fileURLToPath(new URL(`../../packages/data-grid-kit/${p}`, import.meta.url))

// `vite build` uses the built package, exactly like an app that installed it.
// `vite` (dev) reads the library source instead, so edits to the library show up without rebuilding.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: { port: 5400 },
  resolve:
    command === 'serve'
      ? {
          alias: [
            { find: /^data-grid-kit\/core$/, replacement: lib('src/core/index.ts') },
            { find: /^data-grid-kit\/styles\.css$/, replacement: lib('src/ui/styles.css') },
            { find: /^data-grid-kit$/, replacement: lib('src/index.ts') },
          ],
        }
      : {},
}))
