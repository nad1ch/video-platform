import { createWorker } from 'mediasoup'
import type { Worker, WorkerLogLevel } from 'mediasoup/types'
import pino from 'pino'

export type CreateMediasoupWorkerOptions = {
  isShuttingDown?: () => boolean
  /**
   * When the mediasoup child process dies. If set, the default `process.exit(1)` is **not** run
   * (e.g. worker pool will evict rooms on that worker only).
   */
  onDied?: (error: Error) => void
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

const DEFAULT_RTC_MIN = 40_000
const DEFAULT_RTC_MAX = 49_999

function resolveRtcPortRange(log: pino.Logger): { rtcMinPort: number; rtcMaxPort: number } {
  const rawMin = process.env.MEDIASOUP_RTC_MIN_PORT?.trim()
  const rawMax = process.env.MEDIASOUP_RTC_MAX_PORT?.trim()
  const parsedMin = rawMin != null && rawMin.length > 0 ? Number.parseInt(rawMin, 10) : NaN
  const parsedMax = rawMax != null && rawMax.length > 0 ? Number.parseInt(rawMax, 10) : NaN
  const rtcMinPort =
    Number.isFinite(parsedMin) && parsedMin >= 1024 && parsedMin <= 64999 ? parsedMin : DEFAULT_RTC_MIN
  let rtcMaxPort =
    Number.isFinite(parsedMax) && parsedMax >= rtcMinPort && parsedMax <= 65_535 ? parsedMax : DEFAULT_RTC_MAX
  if (rtcMaxPort - rtcMinPort < 99) {
    rtcMaxPort = Math.min(65_535, rtcMinPort + 99)
  }
  if (rtcMinPort !== DEFAULT_RTC_MIN || rtcMaxPort !== DEFAULT_RTC_MAX) {
    log.info({ rtcMinPort, rtcMaxPort }, 'mediasoup RTC port range (override via MEDIASOUP_RTC_MIN_PORT / MEDIASOUP_RTC_MAX_PORT)')
  }
  return { rtcMinPort, rtcMaxPort }
}

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
  const { rtcMinPort, rtcMaxPort } = resolveRtcPortRange(log)

  let worker: Worker
  try {
    worker = await createWorker({
      rtcMinPort,
      rtcMaxPort,
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
    if (options?.onDied) {
      options.onDied(error)
      return
    }
    log.error({ err: error }, 'mediasoup worker died')
    process.exit(1)
  })

  return worker
}
