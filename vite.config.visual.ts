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
      input: {
        review: resolve(__dirname, 'tests/visual/index.html'),
        navigation: resolve(__dirname, 'tests/visual/navigation-memory.html'),
      },
    },
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
})
