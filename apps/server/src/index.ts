import express from 'express'
import http from 'http'
import { WebSocketServer } from 'ws'
import { createMediasoupWorker } from './mediasoup/createWorker'
import { RoomManager } from './rooms/RoomManager'
import { attachSocketServer } from './signaling/socketServer'

const PORT = 3000

async function bootstrap(): Promise<void> {
  let shuttingDown = false

  const worker = await createMediasoupWorker({
    isShuttingDown: () => shuttingDown,
  })
  const roomManager = new RoomManager(worker)

  const app = express()
  const server = http.createServer(app)
  const wss = new WebSocketServer({ server })

  attachSocketServer(wss, roomManager)

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'mediasoup-server',
    })
  })

  const shutdown = (): void => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    console.info('Server shutting down…')

    try {
      roomManager.disposeAllRooms()
    } catch (err) {
      console.error('disposeAllRooms failed', err)
    }

    wss.close((wssErr) => {
      if (wssErr) {
        console.error('WebSocketServer close error', wssErr)
      }
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
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
