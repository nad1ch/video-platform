import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { LOCAL_DEV_API_PORT } from '../server/src/config/localDevApiPort'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Dev proxy target for API + WebSocket upgrade. Use `127.0.0.1` (not `localhost`) so Windows does not
 * resolve `localhost` → `::1` while Node listens on IPv4 only — otherwise Vite returns HTTP 502 for `/api/*`.
 */
const devApiProxyTarget = (
  process.env.VITE_DEV_API_PROXY ?? `http://127.0.0.1:${LOCAL_DEV_API_PORT}`
).replace(/\/$/, '')
const devWsProxyTarget = devApiProxyTarget.startsWith('https://')
  ? devApiProxyTarget.replace(/^https:\/\//, 'wss://')
  : devApiProxyTarget.replace(/^http:\/\//, 'ws://')

function manualAppChunks(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/')
  if (
    normalizedId.endsWith('/apps/client/src/nadle/words-uk-dictionary.generated.ts') ||
    normalizedId.endsWith('/packages/nadle-core/dictionary.mjs')
  ) {
    return 'nadle-dictionary'
  }
  if (normalizedId.endsWith('/apps/client/src/routeNavLoading.ts')) {
    return 'route-nav-loading'
  }
  return undefined
}


function seoPublicMarketingIndexPlugin(): Plugin {
  const slugs = ['video-calls-for-streamers', 'twitch-nadle-game', 'stream-overlay-tools'] as const
  return {
    name: 'seo-public-marketing-index',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next()
          return
        }
        const raw = req.url ?? ''
        const pathname = raw.split('?')[0] ?? '/'
        for (const slug of slugs) {
          if (pathname === `/${slug}` || pathname === `/${slug}/`) {
            const q = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
            req.url = `/${slug}/index.html${q}`
            break
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
// App is deployed at the site root (e.g. https://app.streamassist.net/), so assets must be `/assets/*`, not `/app/assets/*`.

export default defineConfig({
  base: '/',
  plugins: [vue(), seoPublicMarketingIndexPlugin()],
  server: {
    proxy: {
      '/api': {
        target: devApiProxyTarget,
        changeOrigin: true,
      },
      
      '/app/api': {
        target: devApiProxyTarget,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/app/, ''),
      },
      '/nadle-ws': {
        target: devWsProxyTarget,
        ws: true,
      },
      '/eat-first-ws': {
        target: devWsProxyTarget,
        ws: true,
      },
      '/nadraw-show-ws': {
        target: devWsProxyTarget,
        ws: true,
        changeOrigin: true,
      },
      '/checkers-ws': {
        target: devWsProxyTarget,
        ws: true,
      },
      '/app/nadle-ws': {
        target: devWsProxyTarget,
        ws: true,
        rewrite: (p) => p.replace(/^\/app/, ''),
      },
      '/app/eat-first-ws': {
        target: devWsProxyTarget,
        ws: true,
        rewrite: (p) => p.replace(/^\/app/, ''),
      },
      '/app/nadraw-show-ws': {
        target: devWsProxyTarget,
        ws: true,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/app/, ''),
      },
      '/app/checkers-ws': {
        target: devWsProxyTarget,
        ws: true,
        rewrite: (p) => p.replace(/^\/app/, ''),
      },
    },
  },
  build: {
    
    
    cssMinify: 'esbuild',
    /**
     * `'hidden'` keeps source maps as separate files (uploadable for crash
     * symbolication) but strips the `//# sourceMappingURL=...` comment from the
     * shipped `.js`, so browsers do not download the map for every chunk on
     * mobile networks and devtools cannot reconstruct full source from a public
     * site visit.
     */
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: manualAppChunks,
      },
    },
  },
  resolve: {
    
    dedupe: ['vue', 'pinia'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      
      'nadle-core/dictionary': path.resolve(__dirname, '../../packages/nadle-core/dictionary.mjs'),
      'nadle-core': path.resolve(__dirname, '../../packages/nadle-core/index.mjs'),
      'ui-theme': path.resolve(__dirname, '../../packages/ui-theme/src/index.css'),
      'call-core/audio': path.resolve(__dirname, '../../packages/call-core/src/audio/index.ts'),
      'call-core/media': path.resolve(__dirname, '../../packages/call-core/src/media/index.ts'),
      'call-core/signaling': path.resolve(__dirname, '../../packages/call-core/src/signaling/index.ts'),
      'call-core/transport': path.resolve(__dirname, '../../packages/call-core/src/transport/index.ts'),
      'call-core/utils': path.resolve(__dirname, '../../packages/call-core/src/utils/index.ts'),
      /** Avoid pulling the full `call-core` barrel (mediasoup, transports) for tab audio unlock on boot. */
      'call-core/audio-unlock': path.resolve(__dirname, '../../packages/call-core/src/audio/audioPlaybackUnlock.ts'),
      'call-core': path.resolve(__dirname, '../../packages/call-core/src/index.ts'),
    },
  },
})
