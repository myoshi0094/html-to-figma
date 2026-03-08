import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve } from 'path'

// Two-pass build:
//   vite build            → dist/ui.html  (React UI, fully inlined)
//   vite build --mode plugin → dist/code.js (Figma sandbox code)

export default defineConfig(({ mode }) => {
  if (mode === 'plugin') {
    return {
      build: {
        lib: {
          entry: resolve(__dirname, 'src/plugin/code.ts'),
          formats: ['iife'],
          name: 'code',
          fileName: (_format: string) => 'code.js',
        },
        outDir: 'dist',
        emptyOutDir: false,
        target: 'es2017',
      },
    }
  }

  return {
    plugins: [react(), viteSingleFile()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
    resolve: {
      alias: { '@': resolve(__dirname, 'src') },
    },
  }
})
