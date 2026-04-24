import './loadDotEnv'

import cookieParser from 'cookie-parser'
import express from 'express'
import http from 'http'
import { WebSocketServer } from 'ws'
import { MediasoupWorkerPool } from './mediasoup/workerPool'
import { RoomManager } from './rooms/RoomManager'
import { attachSocketServer } from './signaling/socketServer'
import { corsAllowedOrigins } from './auth/clientOrigin'
import { mountGlobalAuth } from './auth/oauthRouter'
import { mountAdminRoutes } from './adminRouter'
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
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.status(204).end()
      return
    }
    next()
  })

  app.use(cookieParser())
  app.use(express.json())

  const server = http.createServer(app)

  const wssSignaling = new WebSocketServer({ noServer: true })
  const wssNadle = new WebSocketServer({ noServer: true })
  const wssEatFirst = new WebSocketServer({ noServer: true })
  const wssNadrawShow = new WebSocketServer({ noServer: true })

  attachSocketServer(wssSignaling, roomManager)
  attachNadleSocketServer(wssNadle)
  attachEatFirstSocketServer(wssEatFirst)
  attachNadrawShowSocketServer(wssNadrawShow)

  server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host ?? 'localhost'
    const pathname = new URL(request.url ?? '/', `http://${host}`).pathname

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

    if (pathname === '/ws' || pathname === '/') {
      wssSignaling.handleUpgrade(request, socket, head, (ws) => {
        wssSignaling.emit('connection', ws, request)
      })
      return
    }

    socket.destroy()
  })

  mountGlobalAuth(app)
  mountStreamerApiRoutes(app)
  mountTwitchNadleAuth(app)
  mountLeaderboardRoutes(app)
  mountAdminRoutes(app)
  mountEatFirstRoutes(app)
  mountNadrawShowRoutes(app)
  mountCoinHubRoutes(app)

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
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  const host = process.env.HOST || '0.0.0.0'
  const port = Number(process.env.PORT) || 3000

  server.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`)
  })
}

bootstrap().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
