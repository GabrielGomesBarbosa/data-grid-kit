import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts', core: 'src/core/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom'],
  // the entries use hooks: mark them as Client Component modules so a Server Component can import them directly
  banner: { js: "'use client';" },
})
