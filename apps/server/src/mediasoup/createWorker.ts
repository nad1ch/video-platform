import { createWorker } from 'mediasoup'
import type { Worker, WorkerLogLevel } from 'mediasoup/types'
import pino from 'pino'

export type CreateMediasoupWorkerOptions = {
  isShuttingDown?: () => boolean
}

const WORKER_LOG_LEVELS: readonly WorkerLogLevel[] = ['debug', 'warn', 'error', 'none']

function resolveMediasoupWorkerLogLevel(): WorkerLogLevel | undefined {
  const raw = process.env.MEDIASOUP_WORKER_LOG_LEVEL?.trim().toLowerCase()
  if (!raw) {
    return undefined
  }
  return WORKER_LOG_LEVELS.includes(raw as WorkerLogLevel) ? (raw as WorkerLogLevel) : undefined
}

const PINO_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const

function resolvePinoLevel(): (typeof PINO_LEVELS)[number] | undefined {
  const raw = process.env.SERVER_PINO_LEVEL?.trim().toLowerCase()
  if (!raw) {
    return undefined
  }
  return (PINO_LEVELS as readonly string[]).includes(raw) ? (raw as (typeof PINO_LEVELS)[number]) : undefined
}

export async function createMediasoupWorker(options?: CreateMediasoupWorkerOptions): Promise<Worker> {
  const pinoLevel = resolvePinoLevel()
  const log = pino({
    name: 'mediasoup-worker',
    ...(pinoLevel ? { level: pinoLevel } : {}),
  })

  const workerLogLevel = resolveMediasoupWorkerLogLevel()

  let worker: Worker
  try {
    worker = await createWorker({
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
      ...(workerLogLevel !== undefined ? { logLevel: workerLogLevel } : {}),
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
