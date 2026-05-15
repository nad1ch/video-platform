import { describe, expect, it } from 'vitest'
import {
  resolveEatFirstTimerStripModel,
  type EatFirstSnapshotTimerFields,
  type EatFirstTableSyncTimer,
} from '@/eat-first/utils/eatFirstTimerStripModel'

const SNAPSHOT_PAUSED: EatFirstSnapshotTimerFields = {
  startedAt: '2026-05-14T12:00:00.000Z',
  paused: true,
  frozenRemainingSec: 42,
}

const SNAPSHOT_STALE_RUNNING: EatFirstSnapshotTimerFields = {
  startedAt: '2026-05-14T11:55:00.000Z',
  paused: false,
  frozenRemainingSec: null,
}

const SNAPSHOT_EMPTY: EatFirstSnapshotTimerFields = {
  startedAt: '',
  paused: false,
  frozenRemainingSec: null,
}

const STOPPED_MODEL = {
  speakingTotalSec: null,
  timerStartedAt: '',
  timerPaused: false,
  frozenRemainingSec: null,
} as const

describe('resolveEatFirstTimerStripModel — WS table-sync running wins', () => {
  it('table-sync running + valid startedAt + valid duration wins over snapshot', () => {
    const startedAt = Date.UTC(2026, 4, 14, 12, 30, 0)
    const tableSyncTimer: EatFirstTableSyncTimer = {
      startedAt,
      durationMs: 90_000,
      isRunning: true,
    }
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer,
      snapshotSpeakingTotalSec: 5,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out).toEqual({
      speakingTotalSec: 90,
      timerStartedAt: new Date(startedAt).toISOString(),
      timerPaused: false,
      frozenRemainingSec: null,
    })
  })

  it('table-sync winner forces timerPaused: false even if snapshot says paused', () => {
    const startedAt = Date.UTC(2026, 4, 14, 12, 30, 0)
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt, durationMs: 60_000, isRunning: true },
      snapshotSpeakingTotalSec: 60,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.timerPaused).toBe(false)
  })

  it('table-sync winner clears frozenRemainingSec even if snapshot has one', () => {
    const startedAt = Date.UTC(2026, 4, 14, 12, 30, 0)
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt, durationMs: 60_000, isRunning: true },
      snapshotSpeakingTotalSec: 60,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.frozenRemainingSec).toBe(null)
  })

  it('speakingTotalSec is Math.floor(durationMs / 1000) when table-sync wins', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: 1_000, durationMs: 5_999, isRunning: true },
      snapshotSpeakingTotalSec: 999,
      snapshotTimerFields: SNAPSHOT_STALE_RUNNING,
    })
    expect(out.speakingTotalSec).toBe(5)
  })

  it('table-sync exactly 5000ms is the inclusive boundary (wins)', () => {
    const startedAt = Date.UTC(2026, 4, 14, 12, 30, 0)
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt, durationMs: 5_000, isRunning: true },
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.speakingTotalSec).toBe(5)
    expect(out.timerPaused).toBe(false)
  })
})

describe('resolveEatFirstTimerStripModel — paused state via snapshot', () => {
  it('table-sync null + snapshot paused → snapshot paused state surfaces', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: null,
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out).toEqual({
      speakingTotalSec: 30,
      timerStartedAt: SNAPSHOT_PAUSED.startedAt,
      timerPaused: true,
      frozenRemainingSec: 42,
    })
  })

  it('table-sync isRunning=false + snapshot paused → snapshot paused state surfaces', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: 1_000, durationMs: 60_000, isRunning: false },
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.timerStartedAt).toBe(SNAPSHOT_PAUSED.startedAt)
    expect(out.timerPaused).toBe(true)
    expect(out.frozenRemainingSec).toBe(42)
    expect(out.speakingTotalSec).toBe(30)
  })

  it('table-sync durationMs < 5000 + snapshot paused → snapshot paused state surfaces', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: 1_000, durationMs: 4_999, isRunning: true },
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.timerStartedAt).toBe(SNAPSHOT_PAUSED.startedAt)
    expect(out.timerPaused).toBe(true)
  })

  it('table-sync non-finite startedAt + snapshot paused → snapshot paused state surfaces', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: Number.NaN, durationMs: 60_000, isRunning: true },
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.timerStartedAt).toBe(SNAPSHOT_PAUSED.startedAt)
    expect(out.timerPaused).toBe(true)
  })

  it('table-sync infinite startedAt + snapshot paused → snapshot paused state surfaces', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: Number.POSITIVE_INFINITY, durationMs: 60_000, isRunning: true },
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.timerStartedAt).toBe(SNAPSHOT_PAUSED.startedAt)
  })

  it('table-sync non-finite durationMs + snapshot paused → snapshot paused state surfaces', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: 1_000, durationMs: Number.NaN, isRunning: true },
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.timerStartedAt).toBe(SNAPSHOT_PAUSED.startedAt)
    expect(out.timerPaused).toBe(true)
  })
})

describe('resolveEatFirstTimerStripModel — stopped state cannot be resurrected by stale snapshot', () => {
  it('table-sync null + snapshot still showing the previous run → stopped (no ghost timer)', () => {
    // This is the root-cause regression test: after the host clicks Stop,
    // the WS table-sync arrives with `timer: null` immediately, while the
    // HTTP snapshot may still hold the previous run's `timerStartedAt` for
    // up to one poll interval. The resolver must NOT use that stale data.
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: null,
      snapshotSpeakingTotalSec: 60,
      snapshotTimerFields: SNAPSHOT_STALE_RUNNING,
    })
    expect(out).toEqual(STOPPED_MODEL)
  })

  it('table-sync isRunning=false + stale running snapshot → stopped', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: 1_000, durationMs: 60_000, isRunning: false },
      snapshotSpeakingTotalSec: 60,
      snapshotTimerFields: SNAPSHOT_STALE_RUNNING,
    })
    expect(out).toEqual(STOPPED_MODEL)
  })

  it('table-sync non-finite startedAt + stale running snapshot → stopped (no ghost)', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: Number.NaN, durationMs: 60_000, isRunning: true },
      snapshotSpeakingTotalSec: 60,
      snapshotTimerFields: SNAPSHOT_STALE_RUNNING,
    })
    expect(out).toEqual(STOPPED_MODEL)
  })

  it('table-sync non-finite durationMs + stale running snapshot → stopped (no ghost)', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: 1_000, durationMs: Number.NaN, isRunning: true },
      snapshotSpeakingTotalSec: 60,
      snapshotTimerFields: SNAPSHOT_STALE_RUNNING,
    })
    expect(out).toEqual(STOPPED_MODEL)
  })

  it('table-sync durationMs < 5000 + stale running snapshot → stopped (no ghost)', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: 1_000, durationMs: 4_999, isRunning: true },
      snapshotSpeakingTotalSec: 60,
      snapshotTimerFields: SNAPSHOT_STALE_RUNNING,
    })
    expect(out).toEqual(STOPPED_MODEL)
  })

  it('table-sync null + empty snapshot → stopped', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: null,
      snapshotSpeakingTotalSec: null,
      snapshotTimerFields: SNAPSHOT_EMPTY,
    })
    expect(out).toEqual(STOPPED_MODEL)
  })

  it('table-sync null + non-paused snapshot with zero speakingTotalSec → stopped', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: null,
      snapshotSpeakingTotalSec: 0,
      snapshotTimerFields: SNAPSHOT_STALE_RUNNING,
    })
    expect(out).toEqual(STOPPED_MODEL)
  })

  it('stopped fallthrough returns the canonical stopped shape (empty timerStartedAt, null fields)', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: null,
      snapshotSpeakingTotalSec: 999,
      snapshotTimerFields: SNAPSHOT_STALE_RUNNING,
    })
    expect(out.timerStartedAt).toBe('')
    expect(out.speakingTotalSec).toBe(null)
    expect(out.timerPaused).toBe(false)
    expect(out.frozenRemainingSec).toBe(null)
  })
})
