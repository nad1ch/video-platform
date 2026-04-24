import type { Worker } from 'mediasoup/types'

/**
 * One mediasoup worker in the process pool, with in-process load stats (roomCount).
 * Same object is held by {@link Room} for the worker lifetime; rooms never migrate workers.
 */
export type PooledWorker = {
  readonly index: number
  readonly worker: Worker
  roomCount: number
  dead: boolean
}
