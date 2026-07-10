import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-visual',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'tests/visual/index.html'),
    },
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
})
