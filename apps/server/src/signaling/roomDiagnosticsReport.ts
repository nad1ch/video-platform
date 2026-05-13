/**
 * Shared GameSessionReport builder.
 *
 * Used by:
 *   - the live admin endpoint (`GET /api/admin/rooms/:roomId/diagnostics`)
 *   - the persistence layer (writes `reportJson` to `RoomDiagnosticReport`)
 *
 * One source of truth for report shape + summary computation so the live
 * view and the finalized DB row are byte-equivalent.
 *
 * The bus has already sanitized `message`, `context`, and `error.stack`
 * before storage, so this module performs no additional redaction.
 */

import {
  BUCKET_PREFIX_SESSION,
  type RoomDiagnosticEvent,
  type RoomDiagnosticGameType,
  type RoomDiagnosticsSnapshot,
} from './roomDiagnosticsBus'

/**
 * Soft cap on serialised JSON size, mirroring the in-memory ring cap.
 * The bus already enforces a 2000-event per-room limit; this constant
 * is published so admin payload size stays predictable.
 */
export const ROOM_DIAGNOSTIC_REPORT_MAX_EVENTS = 2000
export const ROOM_DIAGNOSTIC_REPORT_MAX_BYTES = 1_000_000
export const REPORT_VERSION = 1 as const

const ERROR_SIGNATURE_MESSAGE_SLICE = 80

export interface RoomDiagnosticReportMetadata {
  roomId: string
  baseRoomId: string
  gameType: RoomDiagnosticGameType
  isSessionBucket: boolean
  startedAt: Date
  endedAt: Date | null
  durationMs: number | null
  eventCount: number
  warningCount: number
  errorCount: number
  criticalCount: number
  hasErrors: boolean
  hasWarnings: boolean
  truncated: boolean
  participantCount: number
  hostUserId: string | null
  hostDisplayName: string | null
}

/** Render-ready report object suitable for JSON.stringify. */
export type GameSessionReportJson = Record<string, unknown>

export interface BuildGameSessionReportOptions {
  isSessionBucket?: boolean
  /** Set to `'admin'` for live admin pulls, `'self-export'` for client-initiated downloads (future). */
  exportedBy?: 'admin' | 'self-export'
  /** Optional finalization context — only set when called from persistence. */
  finalizedAt?: Date
  finalizedReason?: 'empty_grace_elapsed' | 'forced'
}

function isoOrNull(ms: number | null | undefined): string | undefined {
  return typeof ms === 'number' ? new Date(ms).toISOString() : undefined
}

function errorSignature(ev: RoomDiagnosticEvent): string {
  const name = ev.error?.name ?? 'Error'
  return `${name}:${ev.message.slice(0, ERROR_SIGNATURE_MESSAGE_SLICE)}`
}

function deriveBaseRoomId(roomId: string, isSessionBucket: boolean): string {
  if (isSessionBucket) return roomId
  if (!roomId.includes(':')) return roomId
  const tail = roomId.split(':').slice(1).join(':')
  return tail.length > 0 ? tail : roomId
}

function detectGameType(events: RoomDiagnosticEvent[]): RoomDiagnosticGameType {
  for (const e of events) {
    if (e.gameType != null) return e.gameType
  }
  return null
}

/**
 * Best-effort host attribution. We don't have a dedicated "host_assigned"
 * event today; instead we walk `host_claimed` events from the server side
 * (already emitted by `handleMafiaClaimHost` / `handleGameRoomClaimHost`).
 * The latest claim wins.
 */
function detectHost(events: RoomDiagnosticEvent[]): { hostUserId: string | null; hostDisplayName: string | null } {
  let userId: string | null = null
  let displayName: string | null = null
  for (const e of events) {
    if (e.type !== 'host_claimed' || e.source !== 'server') continue
    if (typeof e.userId === 'string' && e.userId.length > 0) userId = e.userId
    const dn = e.context?.displayName
    if (typeof dn === 'string' && dn.length > 0) displayName = dn
  }
  return { hostUserId: userId, hostDisplayName: displayName }
}

function countParticipants(events: RoomDiagnosticEvent[]): number {
  const peers = new Set<string>()
  for (const e of events) {
    if (e.source !== 'server') continue
    if (e.type !== 'room_joined') continue
    if (typeof e.peerId === 'string' && e.peerId.length > 0) peers.add(e.peerId)
  }
  return peers.size
}

export function buildRoomDiagnosticReportMetadata(
  roomId: string,
  snapshot: RoomDiagnosticsSnapshot | null,
  opts: BuildGameSessionReportOptions = {},
): RoomDiagnosticReportMetadata {
  const events = snapshot?.events ?? []
  const isSessionBucket = !!opts.isSessionBucket || roomId.startsWith(BUCKET_PREFIX_SESSION)
  const errorCount = events.filter((e) => e.level === 'error').length
  const criticalCount = events.filter((e) => e.level === 'critical').length
  const warningCount = events.filter((e) => e.level === 'warn').length
  const firstAt = snapshot?.firstAt ?? null
  const lastAt = snapshot?.lastAt ?? null
  const startedAt = firstAt != null ? new Date(firstAt) : new Date()
  const endedAt = lastAt != null ? new Date(lastAt) : null
  const durationMs = firstAt != null && lastAt != null ? Math.max(0, lastAt - firstAt) : null
  const { hostUserId, hostDisplayName } = detectHost(events)
  return {
    roomId,
    baseRoomId: deriveBaseRoomId(roomId, isSessionBucket),
    gameType: detectGameType(events),
    isSessionBucket,
    startedAt,
    endedAt,
    durationMs,
    eventCount: events.length,
    warningCount,
    errorCount,
    criticalCount,
    hasErrors: errorCount > 0 || criticalCount > 0,
    hasWarnings: warningCount > 0,
    truncated: snapshot?.truncated ?? false,
    participantCount: countParticipants(events),
    hostUserId,
    hostDisplayName,
  }
}

export function buildGameSessionReport(
  roomId: string,
  snapshot: RoomDiagnosticsSnapshot | null,
  opts: BuildGameSessionReportOptions = {},
): GameSessionReportJson {
  const events = snapshot?.events ?? []
  const meta = buildRoomDiagnosticReportMetadata(roomId, snapshot, opts)

  const grouped = new Map<
    string,
    { count: number; firstAt: number; lastAt: number; peers: Set<string>; sample: RoomDiagnosticEvent }
  >()
  for (const ev of events) {
    if (ev.level !== 'error' && ev.level !== 'critical') continue
    const sig = errorSignature(ev)
    const bucket = grouped.get(sig)
    if (bucket) {
      bucket.count += 1
      bucket.firstAt = Math.min(bucket.firstAt, ev.timestamp)
      bucket.lastAt = Math.max(bucket.lastAt, ev.timestamp)
      if (ev.peerId) bucket.peers.add(ev.peerId)
    } else {
      grouped.set(sig, {
        count: 1,
        firstAt: ev.timestamp,
        lastAt: ev.timestamp,
        peers: new Set(ev.peerId ? [ev.peerId] : []),
        sample: ev,
      })
    }
  }

  const groupedErrors = Array.from(grouped.entries()).map(([signature, bucket]) => ({
    signature,
    count: bucket.count,
    firstAt: new Date(bucket.firstAt).toISOString(),
    lastAt: new Date(bucket.lastAt).toISOString(),
    affectedPeerIds: Array.from(bucket.peers),
    sampleMessage: bucket.sample.message,
  }))

  const mediaTimeline = events.filter(
    (e) => e.area === 'media' || e.area === 'webrtc' || e.area === 'playback',
  )
  const wsTimeline = events.filter((e) => e.area === 'ws')
  const reconnectTimeline = events.filter(
    (e) =>
      e.type === 'ws_reconnecting' ||
      e.type === 'ws_reconnected' ||
      e.type === 'ws_disconnected',
  )
  const gameTimeline = events.filter((e) => e.area === 'game' || e.area === 'room')

  return {
    reportVersion: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    exportedBy: opts.exportedBy ?? 'admin',
    room: {
      roomId,
      baseRoomId: meta.baseRoomId,
      gameType: meta.gameType,
      createdAt: meta.startedAt.toISOString(),
      ...(meta.endedAt ? { endedAt: meta.endedAt.toISOString() } : {}),
      ...(meta.durationMs != null ? { durationMs: meta.durationMs } : {}),
    },
    participants: [],
    summary: {
      totalEvents: events.length,
      errors: meta.errorCount,
      criticals: meta.criticalCount,
      warns: meta.warningCount,
      truncated: meta.truncated,
      eventsDroppedOlderThan: isoOrNull(snapshot?.eventsDroppedOlderThan ?? null),
      reconnectStorms: 0,
      workerEvacuated: false,
      participantCount: meta.participantCount,
      hostUserId: meta.hostUserId,
      hostDisplayName: meta.hostDisplayName,
      ...(opts.finalizedAt ? { finalizedAt: opts.finalizedAt.toISOString() } : {}),
      ...(opts.finalizedReason ? { finalizedReason: opts.finalizedReason } : {}),
    },
    timeline: events,
    groupedErrors,
    mediaTimeline,
    wsTimeline,
    reconnectTimeline,
    gameTimeline,
    criticalMoments: [],
    hints: [],
    environment: {
      server: {
        nodeVersion: process.version,
        mediasoupWorkerCount: 0,
        worker: null,
      },
      clientSamples: [],
    },
    caps: {
      maxEvents: ROOM_DIAGNOSTIC_REPORT_MAX_EVENTS,
      maxTimelineBytes: ROOM_DIAGNOSTIC_REPORT_MAX_BYTES,
    },
  }
}
