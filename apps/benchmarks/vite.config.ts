import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Production build of the page, served by `vite preview`: what is measured is what users get (no dev-mode React).
export default defineConfig({
  plugins: [react()],
  server: { port: 5600 },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
})
