import os from 'node:os'
import pino from 'pino'
import { createMediasoupWorker } from './createWorker'
import type { PooledWorker } from './mediasoupWorkerTypes'

const poolLog = pino({ name: 'mediasoup-worker-pool' })

/**
 * How many child mediasoup workers to run. Override with `MEDIASOUP_WORKER_POOL_SIZE` (min 1, capped 64).
 * Default: `Math.max(1, Math.min(os.cpus().length, 8))`
 */
export function resolveMediasoupWorkerPoolSize(): number {
  const raw = process.env.MEDIASOUP_WORKER_POOL_SIZE?.trim()
  if (raw) {
    const n = Number.parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 1) {
      return Math.min(n, 64)
    }
  }
  return Math.max(1, Math.min(os.cpus().length, 8))
}

/**
 * Mediasoup worker pool: new rooms are assigned to the least-loaded live worker; each room stays
 * on that worker for its lifetime.
 */
export class MediasoupWorkerPool {
  private readonly entries: PooledWorker[] = []
  private isShuttingDown = false

  private constructor() {}

  static async create(
    isShuttingDown: () => boolean,
    onWorkerProcessDied: (entry: PooledWorker, err: Error) => void,
  ): Promise<MediasoupWorkerPool> {
    const pool = new MediasoupWorkerPool()
    const n = resolveMediasoupWorkerPoolSize()
    poolLog.info({ workerCount: n }, 'mediasoup worker pool: started')
    for (let i = 0; i < n; i += 1) {
      const index = i
      const w = await createMediasoupWorker({
        isShuttingDown,
        onDied: (error) => {
          const ent = pool.entries[index]
          if (ent) {
            onWorkerProcessDied(ent, error)
          } else {
            poolLog.fatal(
              { err: error, index },
              'mediasoup worker died before pool slot was registered; pool may be inconsistent',
            )
          }
        },
      })
      const entry: PooledWorker = { index, worker: w, roomCount: 0, dead: false }
      pool.entries.push(entry)
    }
    return pool
  }

  getLeastLoadedWorker(): PooledWorker {
    const alive = this.entries.filter((e) => !e.dead)
    if (alive.length === 0) {
      throw new Error('no active mediasoup workers')
    }
    let best = alive[0]!
    for (const e of alive) {
      if (e.roomCount < best.roomCount) {
        best = e
      } else if (e.roomCount === best.roomCount && e.index < best.index) {
        best = e
      }
    }
    return best
  }

  registerRoom(entry: PooledWorker): void {
    if (entry.dead) {
      throw new Error(`mediasoup worker ${entry.index} is dead`)
    }
    entry.roomCount += 1
  }

  unregisterRoom(entry: PooledWorker): void {
    entry.roomCount = Math.max(0, entry.roomCount - 1)
  }

  markEntryDead(entry: PooledWorker, err: Error, isShuttingDown: () => boolean): void {
    if (isShuttingDown() || this.isShuttingDown) {
      poolLog.info({ err, index: entry.index }, 'mediasoup worker process exited during shutdown')
      return
    }
    entry.dead = true
    poolLog.fatal(
      { err, workerIndex: entry.index, roomsOnWorker: entry.roomCount },
      'mediasoup worker process died; evacuating rooms on this worker',
    )
  }

  get entriesForDebug(): ReadonlyArray<PooledWorker> {
    return this.entries
  }

  /**
   * Normal shutdown: close every worker after rooms are gone.
   */
  closeAllWorkers(): void {
    this.isShuttingDown = true
    for (const e of this.entries) {
      if (!e.worker.closed) {
        try {
          e.worker.close()
        } catch (err) {
          poolLog.error({ err, index: e.index }, 'worker close failed during pool shutdown')
        }
      }
    }
  }
}

export type { PooledWorker } from './mediasoupWorkerTypes'
