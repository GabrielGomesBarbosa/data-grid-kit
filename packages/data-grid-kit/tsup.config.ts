import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts', core: 'src/core/index.ts', locales: 'src/locales/index.ts' },
  format: ['esm', 'cjs'],
  // one copy of the shared code in both formats (classes and instanceof checks must agree between the entries)
  splitting: true,
  dts: true,
  clean: true,
  external: ['react', 'react-dom'],
  // the entries use hooks: mark them as Client Component modules so a Server Component can import them directly
  banner: { js: "'use client';" },
})
