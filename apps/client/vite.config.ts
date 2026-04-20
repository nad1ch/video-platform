import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Dev proxy target for API + WebSocket upgrade. Use `127.0.0.1` (not `localhost`) so Windows does not
 * resolve `localhost` → `::1` while Node listens on IPv4 only — otherwise Vite returns HTTP 502 for `/api/*`.
 */
const devApiProxyTarget = (process.env.VITE_DEV_API_PROXY ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const devWsProxyTarget = devApiProxyTarget.startsWith('https://')
  ? devApiProxyTarget.replace(/^https:\/\//, 'wss://')
  : devApiProxyTarget.replace(/^http:\/\//, 'ws://')

/** Map `/slug` and `/slug/` → `/slug/index.html` so `public/` marketing pages load instead of SPA `index.html`. */
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
// If you ever host the SPA under a subpath, set `base` to that path and match Pages/nginx routing.
export default defineConfig({
  base: '/',
  plugins: [vue(), seoPublicMarketingIndexPlugin()],
  server: {
    proxy: {
      '/api': {
        target: devApiProxyTarget,
        changeOrigin: true,
      },
      // SPA under /app (e.g. reverse proxy): browser calls /app/api/* → same backend /api/*
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
    },
  },
  build: {
    // Avoid Lightning CSS native `.node` bindings on Linux CI (e.g. Cloudflare Pages).
    // Requires `esbuild` in devDependencies (Vite 8 does not ship it for this path).
    cssMinify: 'esbuild',
    /** Map prod stack traces to sources (disable later if you want smaller uploads). */
    sourcemap: true,
  },
  resolve: {
    // One physical copy of Vue/Pinia for the app + aliased call-core sources (avoids getActivePinia() === undefined / reading '_s').
    dedupe: ['vue', 'pinia'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Hoisted to repo root node_modules; Vite dev resolves from apps/client and misses it without an alias.
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
