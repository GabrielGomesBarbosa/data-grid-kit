import { defineConfig } from 'tsup'

// The ready-made xlsx worker: one self-contained file (no React, no shared chunks), because a bundler packs it as a worker on its own.
export default defineConfig({
  entry: { 'xlsx-worker': 'src/xlsx-worker.ts' },
  format: ['esm'],
  splitting: false,
  dts: false,
  clean: false,
  minify: true,
})
