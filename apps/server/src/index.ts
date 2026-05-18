import './loadDotEnv'

import cookieParser from 'cookie-parser'
import express, { type NextFunction, type Request, type Response } from 'express'
import http from 'http'
import { WebSocketServer } from 'ws'
import { MediasoupWorkerPool } from './mediasoup/workerPool'
import { RoomManager } from './rooms/RoomManager'
import { attachSocketServer } from './signaling/socketServer'
import { corsAllowedOrigins } from './auth/clientOrigin'
import { mountGlobalAuth } from './auth/oauthRouter'
import { mountAdminRoutes } from './adminRouter'
import { mountClientEventRoutes } from './clientEventsRouter'
import { mountDiagnosticsAdminRoutes } from './diagnosticsAdminRouter'
import { initRoomDiagnosticsPersistence } from './signaling/roomDiagnosticsPersistence'
import { finalizeAllPendingRoomDiagnostics } from './signaling/roomDiagnosticsBus'
import { mountLeaderboardRoutes } from './leaderboardRouter'
import { mountStreamerApiRoutes } from './nadle/streamerApiRouter'
import { mountTwitchNadleAuth } from './nadle/twitchAuthRouter'
import { startTwitchChatIngest, stopTwitchChatIngest } from './nadle/tmiChat'
import { attachNadleSocketServer } from './nadle/nadleSocket'
import { attachEatFirstSocketServer } from './eatFirst/broadcast'
import { mountEatFirstRoutes } from './eatFirst/router'
import { attachNadrawShowSocketServer } from './nadraw-show/nadrawSocket'
import { mountNadrawShowRoutes } from './nadraw-show/nadrawRouter'
import { mountCoinHubRoutes } from './coinHub/coinHubRouter'
import { attachCheckersSocketServer } from './checkers/checkersSocket'
import { mountCheckersMatchmakingRoutes } from './checkers/checkersMatchmaking'
import { mountBillingRoutes } from './billing/billingRouter'
import { mountBillingAdminRoutes } from './billing/billingAdminRouter'
import { LOCAL_DEV_API_PORT } from './config/localDevApiPort'

/**
 * Replace `[?&]secret=<value>` with `[?&]secret=[REDACTED]` in a URL for safe
 * logging (audit S2). Narrowly scoped to the `secret` parameter — broader
 * sensitive-field redaction for analytics ingest lives in `clientEventsRouter`.
 *
 * Why this matters: the Monobank Personal API webhook (`/personal/webhook`)
 * authenticates by URL-token, not by a custom callback header — that is the
 * actual mechanism the Personal API tier supports, so operators register the
 * `webHookUrl` with `?secret=<value>` baked in and Monobank POSTs back to
 * that exact URL. Without this redaction the secret would land in our
 * application stdout (and any tail/aggregator reading it). Upstream layers
 * (Cloudflare, reverse proxies) still see the raw URL; scrubbing those is an
 * ops-level mitigation tracked as a follow-up.
 */
function redactUrlSecrets(url: string): string {
  return url.replace(/([?&]secret=)[^&#]*/gi, '$1[REDACTED]')
}

async function bootstrap(): Promise<void> {
  let shuttingDown = false
  const services: { roomManager?: RoomManager } = {}

  const workerPool = await MediasoupWorkerPool.create(() => shuttingDown, (entry, err) => {
    workerPool.markEntryDead(entry, err, () => shuttingDown)
    services.roomManager?.evacuateRoomsForDeadWorker(entry)
  })
  const roomManager = new RoomManager(workerPool)
  services.roomManager = roomManager

  const app = express()

  /**
   * Behind exactly one trusted proxy (Cloudflare). Lets Express derive `req.ip`
   * from `X-Forwarded-For` and `req.protocol` from `X-Forwarded-Proto`, which
   * is needed for accurate logging and any future `req.secure` checks. The
   * manual XFF parse in `utils/rateLimit.ts:getClientIp` keeps working — it
   * checks the header first and falls back to `req.ip`, so both paths agree.
   */
  app.set('trust proxy', 1)

  /**
   * One-line JSON access log per HTTP request. Captures `cf-ray` so any 4xx/5xx
   * in Cloudflare analytics can be correlated to a server log line. Intentionally
   * minimal — no body, no headers — to avoid leaking PII.
   *
   * `?secret=…` query params are redacted before logging (audit S2). The
   * Monobank Personal API webhook authenticates by URL-token (it does not
   * support custom callback headers), so the secret must live in the URL.
   * This redaction keeps it out of our own stdout. Cloudflare and any
   * reverse proxies in front still see the raw URL; mitigating those is an
   * ops-level concern (Cloudflare Logpush filters or scheduled secret
   * rotation) tracked as a follow-up — see `verifyMonoWebhookSecret`.
   */
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.url === '/health') {
      return next()
    }
    const start = Date.now()
    res.on('finish', () => {
      const ray = req.headers['cf-ray']
      console.log(JSON.stringify({
        t: new Date().toISOString(),
        m: req.method,
        p: redactUrlSecrets(req.originalUrl),
        s: res.statusCode,
        ms: Date.now() - start,
        ip: req.ip,
        ray: typeof ray === 'string' ? ray : undefined,
      }))
    })
    next()
  })

  /**
   * Defense-in-depth: ensure nothing under /api/* is ever cached by Cloudflare
   * or an intermediate proxy, even if a future page/cache rule is configured
   * too broadly. Per-route handlers may still override (e.g. webhooks).
   */
  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  app.use((req, res, next) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined
    const allowed = corsAllowedOrigins()

    if (origin && !allowed.includes(origin)) {
      if (req.method === 'OPTIONS') {
        res.status(403).end()
        return
      }
      res.status(403).type('text/plain').send('Forbidden by CORS')
      return
    }

    if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Vary', 'Origin')
    }

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
      // Include X-Requested-With so the CSRF guard below can accept it after preflight.
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, X-Mono-Secret')
      res.status(204).end()
      return
    }
    next()
  })

  /**
   * CSRF defense-in-depth for cookie-authenticated mutations. A request is
   * allowed past this guard if it carries either an allow-listed `Origin`
   * header (the CORS layer above already validated it) or an
   * `X-Requested-With` header (forces a preflight, which the CORS layer
   * 403s for non-allow-listed origins). The Monobank webhook endpoint is
   * exempt because it authenticates by URL-token, not cookie.
   */
  const CSRF_WEBHOOK_ALLOWLIST: ReadonlySet<string> = new Set([
    '/api/billing/mono-personal/webhook',
  ])
  app.use((req, res, next) => {
    const method = req.method.toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next()
    }
    if (!req.path.startsWith('/api/')) {
      return next()
    }
    if (CSRF_WEBHOOK_ALLOWLIST.has(req.path)) {
      return next()
    }
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : ''
    const allowed = corsAllowedOrigins()
    if (origin.length > 0 && allowed.includes(origin)) {
      return next()
    }
    const xrw = req.headers['x-requested-with']
    const xrwValue = typeof xrw === 'string' ? xrw.trim() : Array.isArray(xrw) ? (xrw[0] ?? '').trim() : ''
    if (xrwValue.length > 0) {
      return next()
    }
    res.status(403).json({
      error: 'CSRF_PROTECTION',
      message: 'Origin header or X-Requested-With is required for cookie-authenticated mutations',
    })
  })

  app.use(cookieParser())
  /**
   * Cap JSON bodies at 256 kB. All current API shapes (analytics events, billing
   * webhooks, leaderboard writes, eat-first persistence) fit comfortably in tens
   * of kB; anything larger is almost certainly malformed/abuse and would make
   * the JSON parser the slowest step in the request path.
   */
  app.use(express.json({ limit: '256kb' }))

  const server = http.createServer(app)

  /**
   * Per-endpoint WS frame caps. Anything above the cap closes the socket with
   * code 1009 (Message Too Big). The signaling endpoint allows Mafia background
   * uploads (`mafia:settings-update` / `mafia:page-background-settings`), which
   * `clientMessageSchema.ts` already bounds at 20 MB of total URL bytes across
   * the backgrounds array; 24 MB leaves headroom for JSON / WS framing without
   * permitting unbounded payloads. Game endpoints exchange small JSON messages
   * (state snapshots, chat, actions) and never legitimately approach 256 KB.
   */
  const WS_MAX_PAYLOAD_SIGNALING_BYTES = 24 * 1024 * 1024
  const WS_MAX_PAYLOAD_GAME_BYTES = 256 * 1024

  const wssSignaling = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD_SIGNALING_BYTES })
  const wssNadle = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD_GAME_BYTES })
  const wssEatFirst = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD_GAME_BYTES })
  const wssNadrawShow = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD_GAME_BYTES })
  const wssCheckers = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD_GAME_BYTES })

  attachSocketServer(wssSignaling, roomManager)
  attachNadleSocketServer(wssNadle)
  attachEatFirstSocketServer(wssEatFirst)
  attachNadrawShowSocketServer(wssNadrawShow)
  attachCheckersSocketServer(wssCheckers)

  /**
   * Origin allowlist for known WS endpoints (audit S4). Browsers always send
   * `Origin` on WS handshakes, so a missing or unknown origin on a known
   * endpoint is treated as cross-site WS hijacking and rejected with HTTP
   * 403 before any handler runs. Unknown paths fall through to the existing
   * 404 path; that response does not leak whether the endpoint exists.
   */
  const knownWsPaths: ReadonlySet<string> = new Set([
    '/eat-first-ws',
    '/nadle-ws',
    '/nadraw-show-ws',
    '/checkers-ws',
    '/ws',
    '/',
  ])

  server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host ?? 'localhost'
    const pathname = new URL(request.url ?? '/', `http://${host}`).pathname

    if (knownWsPaths.has(pathname)) {
      const originHeader = request.headers.origin
      const origin = typeof originHeader === 'string' ? originHeader.trim() : ''
      const allowed = corsAllowedOrigins()
      if (origin.length === 0 || !allowed.includes(origin)) {
        try {
          socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
        } catch {
          /* socket already broken — fall through to destroy */
        }
        socket.destroy()
        return
      }
    }

    if (pathname === '/eat-first-ws') {
      wssEatFirst.handleUpgrade(request, socket, head, (ws) => {
        wssEatFirst.emit('connection', ws, request)
      })
      return
    }

    if (pathname === '/nadle-ws') {
      wssNadle.handleUpgrade(request, socket, head, (ws) => {
        wssNadle.emit('connection', ws, request)
      })
      return
    }

    if (pathname === '/nadraw-show-ws') {
      wssNadrawShow.handleUpgrade(request, socket, head, (ws) => {
        wssNadrawShow.emit('connection', ws, request)
      })
      return
    }

    if (pathname === '/checkers-ws') {
      wssCheckers.handleUpgrade(request, socket, head, (ws) => {
        wssCheckers.emit('connection', ws, request)
      })
      return
    }

    if (pathname === '/ws' || pathname === '/') {
      wssSignaling.handleUpgrade(request, socket, head, (ws) => {
        wssSignaling.emit('connection', ws, request)
      })
      return
    }

    /**
     * Unknown WS path. Send a clean HTTP 404 before tearing down so Cloudflare
     * reports a 4xx (not a 520/521 from a bare TCP reset). Old SPA builds,
     * scanners, and stale proxies all hit this path.
     */
    try {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    } catch {
      /* socket already broken — fall through to destroy */
    }
    socket.destroy()
  })

  mountGlobalAuth(app)
  mountClientEventRoutes(app)
  mountStreamerApiRoutes(app)
  mountTwitchNadleAuth(app)
  mountLeaderboardRoutes(app)
  mountAdminRoutes(app)
  mountDiagnosticsAdminRoutes(app)
  initRoomDiagnosticsPersistence()
  mountEatFirstRoutes(app)
  mountNadrawShowRoutes(app)
  mountCoinHubRoutes(app)
  mountCheckersMatchmakingRoutes(app)
  mountBillingRoutes(app)
  mountBillingAdminRoutes(app)

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'mediasoup-server',
      mediasoupWorkers: workerPool.entriesForDebug.map((e) => ({
        index: e.index,
        roomCount: e.roomCount,
        dead: e.dead,
      })),
    })
  })

  /**
   * Catch-all 404 for unmounted /api/* paths. Returns JSON so SPA fetchers and
   * monitoring tools get a consistent error shape instead of the default HTML
   * 404. Scoped to /api so it cannot accidentally serve a Pages SPA route.
   */
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'NOT_FOUND' })
  })

  /**
   * Backstop error handler. Per-route try/catch blocks already set their own
   * status; this only fires when something throws past them. Stack is logged
   * but never sent to the client.
   */
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err)
    }
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[unhandled]', JSON.stringify({
      m: req.method,
      p: req.originalUrl,
      ray: typeof req.headers['cf-ray'] === 'string' ? req.headers['cf-ray'] : undefined,
      msg: message,
      stack,
    }))
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  })

  void startTwitchChatIngest().catch((err: unknown) => {
    console.error('[nadle] startTwitchChatIngest failed', err)
  })

  const shutdown = (): void => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    console.info('Server shutting down…')

    void stopTwitchChatIngest().catch((err: unknown) => {
      console.error('[nadle] stopTwitchChatIngest failed', err)
    })

    // Drain in-flight RoomDiagnostics reports BEFORE we tear down the
    // mediasoup state. The function never throws; the registered
    // persistence finalizer fires a `void prisma.create().catch(...)`
    // per bucket, so this is best-effort under SIGTERM but strictly
    // improves over losing every in-flight report.
    try {
      finalizeAllPendingRoomDiagnostics()
    } catch (err: unknown) {
      console.error('finalizeAllPendingRoomDiagnostics failed', err)
    }

    try {
      roomManager?.disposeAllRooms()
    } catch (err: unknown) {
      console.error('disposeAllRooms failed', err)
    }

    try {
      workerPool.closeAllWorkers()
    } catch (err: unknown) {
      console.error('workerPool.closeAllWorkers failed', err)
    }

    const closeWss = (w: WebSocketServer, name: string, cb: () => void): void => {
      w.close((wssErr) => {
        if (wssErr) {
          console.error(`WebSocketServer ${name} close error`, wssErr)
        }
        cb()
      })
    }

    closeWss(wssEatFirst, 'eat-first', () => {
      closeWss(wssNadrawShow, 'nadraw-show', () => {
        closeWss(wssCheckers, 'checkers', () => {
          closeWss(wssNadle, 'nadle', () => {
            closeWss(wssSignaling, 'signaling', () => {
              server.close((httpErr) => {
                if (httpErr) {
                  console.error('HTTP server close error', httpErr)
                }
                process.exit(0)
              })
            })
          })
        })
      })
    })
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  const host = process.env.HOST || '0.0.0.0'
  const port = Number(process.env.PORT) || LOCAL_DEV_API_PORT

  server.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`)
  })
}

bootstrap().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
