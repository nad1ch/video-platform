import cookieParser from 'cookie-parser'
import express from 'express'
import http from 'http'
import { WebSocketServer } from 'ws'
import { createMediasoupWorker } from './mediasoup/createWorker'
import { RoomManager } from './rooms/RoomManager'
import { attachSocketServer } from './signaling/socketServer'
import { mountAppOAuth } from './auth/oauthRouter'
import { mountTwitchWordleAuth } from './wordle/twitchAuthRouter'
import { startTwitchChatIngest, stopTwitchChatIngest } from './wordle/tmiChat'
import { attachWordleSocketServer } from './wordle/wordleSocket'

async function bootstrap(): Promise<void> {
  let shuttingDown = false

  const worker = await createMediasoupWorker({
    isShuttingDown: () => shuttingDown,
  })
  const roomManager = new RoomManager(worker)

  const app = express()
  const allowedOrigin = process.env.WORDLE_CLIENT_ORIGIN ?? 'http://localhost:5173'

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
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
  const wssWordle = new WebSocketServer({ noServer: true })

  attachSocketServer(wssSignaling, roomManager)
  attachWordleSocketServer(wssWordle)

  server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host ?? 'localhost'
    const pathname = new URL(request.url ?? '/', `http://${host}`).pathname

    if (pathname === '/wordle-ws') {
      wssWordle.handleUpgrade(request, socket, head, (ws) => {
        wssWordle.emit('connection', ws, request)
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

  mountAppOAuth(app)
  mountTwitchWordleAuth(app)

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'mediasoup-server',
    })
  })

  startTwitchChatIngest()

  const shutdown = (): void => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    console.info('Server shutting down…')

    stopTwitchChatIngest()

    try {
      roomManager.disposeAllRooms()
    } catch (err) {
      console.error('disposeAllRooms failed', err)
    }

    const closeWss = (w: WebSocketServer, name: string, cb: () => void): void => {
      w.close((wssErr) => {
        if (wssErr) {
          console.error(`WebSocketServer ${name} close error`, wssErr)
        }
        cb()
      })
    }

    closeWss(wssWordle, 'wordle', () => {
      closeWss(wssSignaling, 'signaling', () => {
        server.close((httpErr) => {
          if (httpErr) {
            console.error('HTTP server close error', httpErr)
          }
          try {
            worker.close()
          } catch (err) {
            console.error('worker.close failed', err)
          }
          process.exit(0)
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

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
