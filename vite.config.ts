import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  clearScreen: false,
  server: {
    port: 1422,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts'],
          'ui-vendor': ['reka-ui', 'class-variance-authority', 'clsx', 'tailwind-merge']
        }
      }
    }
  },
  esbuild: {
    drop: ['console', 'debugger']
  }
})
