import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'call-core/audio': path.resolve(__dirname, '../../packages/call-core/src/audio/index.ts'),
      'call-core/media': path.resolve(__dirname, '../../packages/call-core/src/media/index.ts'),
      'call-core/signaling': path.resolve(__dirname, '../../packages/call-core/src/signaling/index.ts'),
      'call-core/transport': path.resolve(__dirname, '../../packages/call-core/src/transport/index.ts'),
      'call-core/utils': path.resolve(__dirname, '../../packages/call-core/src/utils/index.ts'),
      'call-core': path.resolve(__dirname, '../../packages/call-core/src/index.ts'),
    },
  },
})
