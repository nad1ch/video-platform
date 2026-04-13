import { createWorker } from 'mediasoup'
import type { Worker } from 'mediasoup/node/lib/types'
import pino from 'pino'

export type CreateMediasoupWorkerOptions = {
  isShuttingDown?: () => boolean
}

export async function createMediasoupWorker(options?: CreateMediasoupWorkerOptions): Promise<Worker> {
  const log = pino({ name: 'mediasoup-worker' })

  let worker: Worker
  try {
    worker = await createWorker({
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    })
  } catch (err) {
    log.error({ err }, 'failed to create mediasoup worker')
    throw err
  }

  worker.on('died', (error: Error) => {
    if (options?.isShuttingDown?.()) {
      log.info({ err: error }, 'mediasoup worker subprocess exited during shutdown')
      return
    }
    log.error({ err: error }, 'mediasoup worker died')
    process.exit(1)
  })

  return worker
}
