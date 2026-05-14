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

const SNAPSHOT_RUNNING: EatFirstSnapshotTimerFields = {
  startedAt: '2026-05-14T11:55:00.000Z',
  paused: false,
  frozenRemainingSec: null,
}

const SNAPSHOT_EMPTY: EatFirstSnapshotTimerFields = {
  startedAt: '',
  paused: false,
  frozenRemainingSec: null,
}

describe('resolveEatFirstTimerStripModel — table-sync precedence', () => {
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
      snapshotTimerFields: SNAPSHOT_RUNNING,
    })
    expect(out.speakingTotalSec).toBe(5)
  })
})

describe('resolveEatFirstTimerStripModel — fallback to snapshot', () => {
  it('table-sync null falls back to snapshot', () => {
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

  it('table-sync isRunning=false falls back to snapshot', () => {
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

  it('table-sync durationMs < 5000 falls back to snapshot', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: 1_000, durationMs: 4_999, isRunning: true },
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.timerStartedAt).toBe(SNAPSHOT_PAUSED.startedAt)
    expect(out.timerPaused).toBe(true)
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

  it('table-sync non-finite startedAt falls back to snapshot', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: Number.NaN, durationMs: 60_000, isRunning: true },
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.timerStartedAt).toBe(SNAPSHOT_PAUSED.startedAt)
    expect(out.timerPaused).toBe(true)
  })

  it('table-sync infinite startedAt falls back to snapshot', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: Number.POSITIVE_INFINITY, durationMs: 60_000, isRunning: true },
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.timerStartedAt).toBe(SNAPSHOT_PAUSED.startedAt)
  })

  it('table-sync non-finite durationMs falls back to snapshot', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: { startedAt: 1_000, durationMs: Number.NaN, isRunning: true },
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.timerStartedAt).toBe(SNAPSHOT_PAUSED.startedAt)
    expect(out.timerPaused).toBe(true)
  })
})

describe('resolveEatFirstTimerStripModel — snapshot surfacing', () => {
  it('preserves snapshot paused state on fallback', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: null,
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.timerPaused).toBe(true)
  })

  it('preserves snapshot frozenRemainingSec on fallback', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: null,
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_PAUSED,
    })
    expect(out.frozenRemainingSec).toBe(42)
  })

  it('preserves snapshot empty startedAt on fallback', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: null,
      snapshotSpeakingTotalSec: null,
      snapshotTimerFields: SNAPSHOT_EMPTY,
    })
    expect(out.timerStartedAt).toBe('')
    expect(out.speakingTotalSec).toBe(null)
    expect(out.timerPaused).toBe(false)
    expect(out.frozenRemainingSec).toBe(null)
  })

  it('preserves snapshot null frozenRemainingSec on fallback', () => {
    const out = resolveEatFirstTimerStripModel({
      tableSyncTimer: null,
      snapshotSpeakingTotalSec: 30,
      snapshotTimerFields: SNAPSHOT_RUNNING,
    })
    expect(out.frozenRemainingSec).toBe(null)
  })
})
