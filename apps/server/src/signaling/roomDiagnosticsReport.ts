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
/** Cap on per-summary "top N" type lists. */
const TOP_TYPES_LIMIT = 5
/** Cap on `criticalMoments` entries so the report stays paste-able. */
const CRITICAL_MOMENTS_LIMIT = 10
/** Cap on `clientSamples` entries. */
const CLIENT_SAMPLES_LIMIT = 24
/** Threshold for `client_events_missing` hint (5 min). */
const CLIENT_EVENTS_MISSING_MIN_DURATION_MS = 5 * 60 * 1000
/** Mirrors `ROOM_DIAGNOSTICS_EMPTY_GRACE_MS` in the bus — duplicated here to
 *  avoid importing a runtime constant from the bus into the report builder
 *  for this single derivation. Keep numerically in sync.
 */
const ROOM_DIAGNOSTICS_EMPTY_GRACE_MS_LOCAL = 60_000

/** Subset of finalize reasons recognised by the report builder. */
type FinalizedReason = 'empty_grace_elapsed' | 'forced' | 'lru_eviction'

export interface RoomDiagnosticReportParticipant {
  peerId: string
  userId: string | null
  displayName: string
  joinedAt: string
  leftAt: string | null
  joinCount: number
  leaveCount: number
  reconnectCount: number
  wasHost: boolean
  hostClaimedAt: string | null
  warningCount: number
  errorCount: number
  eventCount: number
  finalPresence: 'present' | 'left' | 'unknown'
  isAnonymous: boolean
  isMultiSessionUser: boolean
}

export interface MultiSessionUserEntry {
  userId: string
  displayName: string | null
  peerIds: string[]
  eventCount: number
}

export interface ReportHint {
  code: string
  severity: 'info' | 'warn' | 'error'
  summary: string
  suggestedFiles?: string[]
}

export type LifecycleStatus =
  | 'clean'
  | 'errored'
  | 'truncated'
  | 'forced'
  | 'in_progress'

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
  finalizedReason?: 'empty_grace_elapsed' | 'forced' | 'lru_eviction'
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

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

interface HostDerivedInfo {
  hostUserId: string | null
  hostDisplayName: string | null
  hostPeerId: string | null
  hostClaimedAt: string | null
  hostConflictCount: number
  hostConflictReasons: Record<string, number>
}

/**
 * Best-effort host attribution. Two sources are accepted:
 *   - explicit `host_claimed` events (emitted from `handleMafiaClaimHost`
 *     and `handleGameRoomClaimHost`).
 *   - `room_joined` events whose `context.hostAssignedOnJoin === true`,
 *     which covers the owner-lock auto-assign path that does not emit
 *     an explicit `host_claimed` today.
 *
 * Latest match wins for `hostUserId`/`hostDisplayName`/`hostPeerId`/
 * `hostClaimedAt`.
 */
function detectHostInfo(events: RoomDiagnosticEvent[]): HostDerivedInfo {
  let hostUserId: string | null = null
  let hostDisplayName: string | null = null
  let hostPeerId: string | null = null
  let hostClaimedAt: string | null = null
  let hostConflictCount = 0
  const hostConflictReasons: Record<string, number> = {}

  for (const e of events) {
    if (e.source !== 'server') continue
    const isExplicitClaim = e.type === 'host_claimed'
    const isAutoAssignedJoin =
      e.type === 'room_joined' && e.context?.hostAssignedOnJoin === true
    if (isExplicitClaim || isAutoAssignedJoin) {
      const uid = asNonEmptyString(e.userId)
      if (uid) hostUserId = uid
      const dn = asNonEmptyString(e.context?.displayName)
      if (dn) hostDisplayName = dn
      const pid = asNonEmptyString(e.peerId)
      if (pid) hostPeerId = pid
      hostClaimedAt = new Date(e.timestamp).toISOString()
      continue
    }
    if (e.type === 'host_conflict') {
      hostConflictCount += 1
      const reason = asNonEmptyString(e.context?.reason) ?? 'unknown'
      hostConflictReasons[reason] = (hostConflictReasons[reason] ?? 0) + 1
    }
  }

  return {
    hostUserId,
    hostDisplayName,
    hostPeerId,
    hostClaimedAt,
    hostConflictCount,
    hostConflictReasons,
  }
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
  const hostInfo = detectHostInfo(events)
  const hostUserId = hostInfo.hostUserId
  const hostDisplayName = hostInfo.hostDisplayName
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

/**
 * Walk the timeline once and produce a participant entry per peerId.
 *
 * The bus already emits `room_joined` / `room_left` for every peer
 * transition; this builder treats those as the source of truth.
 * Client events (e.g. `audio_play_failed`) carry `peerId` as well; they
 * contribute to `eventCount` / `warningCount` / `errorCount` but cannot
 * create a participant without at least one `room_joined` from the
 * server. A peer that only appears in client events gets a skeletal
 * entry with `finalPresence: 'unknown'` — surfacing an out-of-band
 * client emit is more useful than dropping it silently.
 */
function buildParticipants(events: RoomDiagnosticEvent[]): RoomDiagnosticReportParticipant[] {
  const map = new Map<string, RoomDiagnosticReportParticipant>()

  for (const e of events) {
    const pid = asNonEmptyString(e.peerId)
    if (!pid) continue
    const isServer = e.source === 'server'
    let entry = map.get(pid)

    if (isServer && e.type === 'room_joined') {
      const ctxDisplayName = asNonEmptyString(e.context?.displayName)
      const hostAssignedOnJoin = e.context?.hostAssignedOnJoin === true
      const joinedIso = new Date(e.timestamp).toISOString()
      const hostClaimedIso = hostAssignedOnJoin ? joinedIso : null
      if (!entry) {
        entry = {
          peerId: pid,
          userId: asNonEmptyString(e.userId),
          displayName: ctxDisplayName ?? `peer-${pid.slice(0, 8)}`,
          joinedAt: joinedIso,
          leftAt: null,
          joinCount: 1,
          leaveCount: 0,
          reconnectCount: 0,
          wasHost: hostAssignedOnJoin,
          hostClaimedAt: hostClaimedIso,
          warningCount: 0,
          errorCount: 0,
          eventCount: 1,
          finalPresence: 'present',
          isAnonymous: e.userId == null,
          isMultiSessionUser: false,
        }
        map.set(pid, entry)
      } else {
        entry.joinCount += 1
        entry.reconnectCount = Math.max(0, entry.joinCount - 1)
        entry.leftAt = null
        entry.finalPresence = 'present'
        if (ctxDisplayName) entry.displayName = ctxDisplayName
        const uid = asNonEmptyString(e.userId)
        if (uid) {
          entry.userId = uid
          entry.isAnonymous = false
        }
        if (hostAssignedOnJoin) {
          entry.wasHost = true
          if (!entry.hostClaimedAt) entry.hostClaimedAt = hostClaimedIso
        }
        entry.eventCount += 1
      }
      continue
    }

    if (!entry) {
      // Peer appeared in a non-join event first (e.g., client playback
      // failure before the server `room_joined` was synced). Create a
      // skeletal entry; presence is unknown.
      entry = {
        peerId: pid,
        userId: asNonEmptyString(e.userId),
        displayName: `peer-${pid.slice(0, 8)}`,
        joinedAt: new Date(e.timestamp).toISOString(),
        leftAt: null,
        joinCount: 0,
        leaveCount: 0,
        reconnectCount: 0,
        wasHost: false,
        hostClaimedAt: null,
        warningCount: 0,
        errorCount: 0,
        eventCount: 0,
        finalPresence: 'unknown',
        isAnonymous: e.userId == null,
        isMultiSessionUser: false,
      }
      map.set(pid, entry)
    }

    entry.eventCount += 1
    if (e.level === 'warn') entry.warningCount += 1
    if (e.level === 'error' || e.level === 'critical') entry.errorCount += 1

    if (isServer && e.type === 'room_left') {
      entry.leaveCount += 1
      entry.leftAt = new Date(e.timestamp).toISOString()
      entry.finalPresence = 'left'
    } else if (isServer && e.type === 'host_claimed') {
      entry.wasHost = true
      if (!entry.hostClaimedAt) entry.hostClaimedAt = new Date(e.timestamp).toISOString()
      const dn = asNonEmptyString(e.context?.displayName)
      if (dn) entry.displayName = dn
    }
  }

  // Multi-session detection: any non-empty userId mapping to >1 peerId.
  const userToPeers = new Map<string, Set<string>>()
  for (const p of map.values()) {
    if (!p.userId) continue
    let set = userToPeers.get(p.userId)
    if (!set) {
      set = new Set()
      userToPeers.set(p.userId, set)
    }
    set.add(p.peerId)
  }
  for (const p of map.values()) {
    if (!p.userId) continue
    const set = userToPeers.get(p.userId)
    if (set && set.size > 1) p.isMultiSessionUser = true
  }

  return Array.from(map.values()).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
}

function buildMultiSessionUsers(
  participants: RoomDiagnosticReportParticipant[],
  events: RoomDiagnosticEvent[],
): MultiSessionUserEntry[] {
  const out = new Map<string, MultiSessionUserEntry>()
  for (const p of participants) {
    if (!p.isMultiSessionUser || !p.userId) continue
    let entry = out.get(p.userId)
    if (!entry) {
      entry = {
        userId: p.userId,
        displayName: p.displayName.length > 0 ? p.displayName : null,
        peerIds: [],
        eventCount: 0,
      }
      out.set(p.userId, entry)
    }
    entry.peerIds.push(p.peerId)
  }
  if (out.size === 0) return []
  for (const e of events) {
    const uid = asNonEmptyString(e.userId)
    if (!uid) continue
    const entry = out.get(uid)
    if (entry) entry.eventCount += 1
  }
  return Array.from(out.values()).sort((a, b) => a.userId.localeCompare(b.userId))
}

function topTypesByLevel(
  events: RoomDiagnosticEvent[],
  level: 'warn' | 'error' | 'critical',
  limit: number,
): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>()
  for (const e of events) {
    if (e.level !== level) continue
    counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([type, count]) => ({ type, count }))
}

function firstAtForLevels(
  events: RoomDiagnosticEvent[],
  levels: ReadonlyArray<'warn' | 'error' | 'critical'>,
): string | null {
  for (const e of events) {
    if (levels.includes(e.level as 'warn' | 'error' | 'critical')) {
      return new Date(e.timestamp).toISOString()
    }
  }
  return null
}

function buildAffectedSets(events: RoomDiagnosticEvent[]): {
  peers: string[]
  users: string[]
} {
  const peers = new Set<string>()
  const users = new Set<string>()
  for (const e of events) {
    if (e.level !== 'warn' && e.level !== 'error' && e.level !== 'critical') continue
    const pid = asNonEmptyString(e.peerId)
    if (pid) peers.add(pid)
    const uid = asNonEmptyString(e.userId)
    if (uid) users.add(uid)
  }
  return { peers: Array.from(peers), users: Array.from(users) }
}

function buildGroupedByLevel(
  events: RoomDiagnosticEvent[],
  levels: ReadonlyArray<'warn' | 'error' | 'critical'>,
): Array<{
  signature: string
  count: number
  firstAt: string
  lastAt: string
  affectedPeerIds: string[]
  sampleMessage: string
}> {
  const grouped = new Map<
    string,
    { count: number; firstAt: number; lastAt: number; peers: Set<string>; sample: RoomDiagnosticEvent }
  >()
  for (const ev of events) {
    if (!levels.includes(ev.level as 'warn' | 'error' | 'critical')) continue
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
  return Array.from(grouped.entries()).map(([signature, bucket]) => ({
    signature,
    count: bucket.count,
    firstAt: new Date(bucket.firstAt).toISOString(),
    lastAt: new Date(bucket.lastAt).toISOString(),
    affectedPeerIds: Array.from(bucket.peers),
    sampleMessage: bucket.sample.message,
  }))
}

function buildCriticalMoments(events: RoomDiagnosticEvent[]): Array<{
  at: string
  label: string
  event: RoomDiagnosticEvent
}> {
  const out: Array<{ at: string; label: string; event: RoomDiagnosticEvent }> = []
  for (const e of events) {
    // Include true criticals plus host_conflict warnings — rare and
    // always actionable. Other warn/error events surface via
    // groupedErrors / groupedWarnings instead.
    if (e.level !== 'critical' && e.type !== 'host_conflict') continue
    const reason = asNonEmptyString(e.context?.reason)
    out.push({
      at: new Date(e.timestamp).toISOString(),
      label: `${e.area}/${e.type}${reason ? ` (${reason})` : ''}`,
      event: e,
    })
    if (out.length >= CRITICAL_MOMENTS_LIMIT) break
  }
  return out
}

function buildClientSamples(
  events: RoomDiagnosticEvent[],
): Array<{
  peerId: string
  ua: string
  platform: 'desktop' | 'mobile'
  isView: boolean
  deviceMemory?: number
  hardwareConcurrency?: number
}> {
  const seen = new Map<string, {
    peerId: string
    ua: string
    platform: 'desktop' | 'mobile'
    isView: boolean
    deviceMemory?: number
    hardwareConcurrency?: number
  }>()
  for (const e of events) {
    if (e.source !== 'client') continue
    if (!e.env) continue
    const env = e.env as Record<string, unknown>
    const ua = typeof env.ua === 'string' ? env.ua : ''
    const platform = env.platform === 'mobile' ? 'mobile' : 'desktop'
    const peerId = asNonEmptyString(e.peerId) ?? '<no-peer>'
    const key = `${peerId}|${ua}|${platform}`
    if (seen.has(key)) continue
    seen.set(key, {
      peerId,
      ua,
      platform,
      isView: Boolean(env.isView),
      ...(typeof env.deviceMemory === 'number' ? { deviceMemory: env.deviceMemory } : {}),
      ...(typeof env.hardwareConcurrency === 'number'
        ? { hardwareConcurrency: env.hardwareConcurrency }
        : {}),
    })
    if (seen.size >= CLIENT_SAMPLES_LIMIT) break
  }
  return Array.from(seen.values())
}

function resolveFinalizedReason(
  events: RoomDiagnosticEvent[],
  opts: BuildGameSessionReportOptions,
): FinalizedReason | null {
  if (opts.finalizedReason) return opts.finalizedReason
  for (const e of events) {
    if (e.type !== 'room_report_finalized' || e.source !== 'server') continue
    const reason = asNonEmptyString(e.context?.reason)
    if (reason === 'empty_grace_elapsed' || reason === 'forced' || reason === 'lru_eviction') {
      return reason
    }
  }
  return null
}

function computeLifecycleDurationWithoutGraceMs(
  events: RoomDiagnosticEvent[],
  durationMs: number | null,
): number | null {
  if (durationMs == null) return null
  const firstAt = events[0]?.timestamp
  if (firstAt == null) return durationMs
  const graceStarted = events.find(
    (e) => e.type === 'room_empty_grace_started' && e.source === 'server',
  )
  if (!graceStarted) return durationMs
  return Math.max(0, graceStarted.timestamp - firstAt)
}

function computeLifecycleStatus(
  meta: RoomDiagnosticReportMetadata,
  finalizedReason: FinalizedReason | null,
): LifecycleStatus {
  if (meta.truncated) return 'truncated'
  if (meta.errorCount + meta.criticalCount > 0) return 'errored'
  if (finalizedReason === 'forced') return 'forced'
  if (finalizedReason === 'empty_grace_elapsed') return 'clean'
  return 'in_progress'
}

function buildHints(args: {
  events: RoomDiagnosticEvent[]
  meta: RoomDiagnosticReportMetadata
  participants: RoomDiagnosticReportParticipant[]
  hostInfo: HostDerivedInfo
  multiSessionUsers: MultiSessionUserEntry[]
  finalizedReason: FinalizedReason | null
  topWarningTypes: Array<{ type: string; count: number }>
}): ReportHint[] {
  const hints: ReportHint[] = []
  const { events, meta, participants, hostInfo, multiSessionUsers, finalizedReason, topWarningTypes } = args

  if (
    meta.gameType === 'mafia' &&
    hostInfo.hostPeerId === null &&
    participants.length > 0
  ) {
    hints.push({
      code: 'no_host_claimed_in_mafia_room',
      severity: 'info',
      summary:
        'Mafia room with participants but no host was claimed. Likely the auto-assign-on-join path fired without emitting host_claimed, or no participant invoked claim-host.',
      suggestedFiles: [
        'apps/server/src/signaling/messageHandlers.ts',
        'apps/server/src/signaling/mafiaRoomOwnerStore.ts',
      ],
    })
  }

  const anonymousPeerCount = participants.filter((p) => p.isAnonymous).length
  if (
    anonymousPeerCount > 0 &&
    anonymousPeerCount === participants.length &&
    hostInfo.hostPeerId === null
  ) {
    hints.push({
      code: 'anonymous_room_without_host',
      severity: 'info',
      summary:
        'All peers in this room were anonymous (server-resolved userId was null) and no host was claimed. Check upgrade-cookie session resolution and client auth state.',
      suggestedFiles: [
        'apps/server/src/auth/session/sessionJwt.ts',
        'apps/server/src/signaling/socketServer.ts',
      ],
    })
  }

  if (multiSessionUsers.length > 0) {
    hints.push({
      code: 'same_user_multiple_peers',
      severity: 'info',
      summary: `${multiSessionUsers.length} user(s) had multiple peers in the same room. Most often this is multi-tab usage by the same person, not a bug.`,
    })
  }

  if (
    (hostInfo.hostConflictReasons['same_user_other_session'] ?? 0) > 0 &&
    multiSessionUsers.length > 0
  ) {
    hints.push({
      code: 'multi_session_host_conflict',
      severity: 'info',
      summary:
        'host_conflict with reason `same_user_other_session` paired with multi-tab usage. Expected outcome: the same user opened a second tab while the first was already host; the server kept the original host.',
    })
  }

  if (
    finalizedReason === 'empty_grace_elapsed' &&
    meta.errorCount + meta.criticalCount === 0
  ) {
    hints.push({
      code: 'room_finalized_cleanly',
      severity: 'info',
      summary: 'Report finalized via empty-room grace with zero errors or criticals.',
    })
  }

  if (finalizedReason === 'empty_grace_elapsed') {
    hints.push({
      code: 'empty_grace_finalization_ok',
      severity: 'info',
      summary: 'Empty-room grace path completed normally and produced this report.',
    })
  }

  const clientEventCount = events.filter((e) => e.source === 'client').length
  if (
    meta.durationMs != null &&
    meta.durationMs > CLIENT_EVENTS_MISSING_MIN_DURATION_MS &&
    clientEventCount === 0
  ) {
    hints.push({
      code: 'client_events_missing',
      severity: 'info',
      summary:
        'Long-running room with no client-side diagnostic events. Check that the client emitter initialized and that route-level diagnostics context was wired for this room.',
      suggestedFiles: [
        'apps/client/src/utils/clientAnalytics.ts',
        'apps/client/src/diagnostics/useDiagnostics.ts',
      ],
    })
  }

  if (events.length > 0 && events.every((e) => e.area === 'room')) {
    hints.push({
      code: 'only_server_lifecycle_events',
      severity: 'info',
      summary:
        'Only server-side room-lifecycle events were collected. No game, ws, or playback events present — investigate whether per-game emitters fired.',
    })
  }

  const playbackInTop = topWarningTypes.some(
    (t) => t.type === 'audio_play_failed' || t.type === 'video_play_failed',
  )
  if (playbackInTop) {
    hints.push({
      code: 'playback_warning_detected',
      severity: 'warn',
      summary:
        'Playback failures (`audio_play_failed`/`video_play_failed`) detected. Likely autoplay block, stalled inbound track, or device permission issue.',
      suggestedFiles: [
        'apps/client/src/components/StreamAudio.vue',
        'apps/client/src/components/StreamVideo.vue',
        'packages/call-core/src/audio/audioPlaybackUnlock.ts',
      ],
    })
  }

  return hints
}

export function buildGameSessionReport(
  roomId: string,
  snapshot: RoomDiagnosticsSnapshot | null,
  opts: BuildGameSessionReportOptions = {},
): GameSessionReportJson {
  const events = snapshot?.events ?? []
  const meta = buildRoomDiagnosticReportMetadata(roomId, snapshot, opts)

  // ─── Derived structures (single pass each) ──────────────────────────
  const hostInfo = detectHostInfo(events)
  const participants = buildParticipants(events)
  const multiSessionUsers = buildMultiSessionUsers(participants, events)
  const groupedErrors = buildGroupedByLevel(events, ['error', 'critical'])
  const groupedWarnings = buildGroupedByLevel(events, ['warn'])
  const topWarningTypes = topTypesByLevel(events, 'warn', TOP_TYPES_LIMIT)
  const topErrorTypes = topTypesByLevel(events, 'error', TOP_TYPES_LIMIT)
  const criticalMoments = buildCriticalMoments(events)
  const affected = buildAffectedSets(events)
  const clientSamples = buildClientSamples(events)
  const finalizedReason = resolveFinalizedReason(events, opts)
  const lifecycleDurationWithoutGraceMs = computeLifecycleDurationWithoutGraceMs(
    events,
    meta.durationMs,
  )
  const lifecycleStatus = computeLifecycleStatus(meta, finalizedReason)

  // Derived peer/user counters. `participantCount` keeps its original
  // semantics (peer-count) for backward compatibility; `peerCount` is
  // the documented name and `uniqueUserCount` is the real "unique
  // people" number that AI prompts should prefer.
  const peerCount = participants.length
  const anonymousPeerCount = participants.filter((p) => p.isAnonymous).length
  const authenticatedUserSet = new Set<string>()
  for (const p of participants) {
    if (p.userId) authenticatedUserSet.add(p.userId)
  }
  const uniqueUserCount = authenticatedUserSet.size
  const authenticatedUserCount = uniqueUserCount
  const multiSessionUserCount = multiSessionUsers.length

  const hints = buildHints({
    events,
    meta,
    participants,
    hostInfo,
    multiSessionUsers,
    finalizedReason,
    topWarningTypes,
  })

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

  const firstWarningAt = firstAtForLevels(events, ['warn'])
  const firstErrorAt = firstAtForLevels(events, ['error', 'critical'])

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
    participants,
    summary: {
      totalEvents: events.length,
      errors: meta.errorCount,
      criticals: meta.criticalCount,
      warns: meta.warningCount,
      truncated: meta.truncated,
      eventsDroppedOlderThan: isoOrNull(snapshot?.eventsDroppedOlderThan ?? null),
      reconnectStorms: 0,
      workerEvacuated: false,
      // Backward-compatible: `participantCount` = peer count. New
      // explicit names are added alongside so AI prompts can use the
      // semantics they actually want.
      participantCount: meta.participantCount,
      peerCount,
      uniqueUserCount,
      anonymousPeerCount,
      authenticatedUserCount,
      multiSessionUserCount,
      multiSessionUsers,
      hostUserId: meta.hostUserId,
      hostDisplayName: meta.hostDisplayName,
      hostPeerId: hostInfo.hostPeerId,
      hostClaimedAt: hostInfo.hostClaimedAt,
      hostConflictCount: hostInfo.hostConflictCount,
      hostConflictReasons: hostInfo.hostConflictReasons,
      firstWarningAt,
      firstErrorAt,
      affectedPeers: affected.peers,
      affectedUsers: affected.users,
      topWarningTypes,
      topErrorTypes,
      lifecycleStatus,
      lifecycleDurationWithoutGraceMs,
      graceDurationMs: ROOM_DIAGNOSTICS_EMPTY_GRACE_MS_LOCAL,
      ...(opts.finalizedAt ? { finalizedAt: opts.finalizedAt.toISOString() } : {}),
      ...(finalizedReason ? { finalizedReason } : {}),
    },
    timeline: events,
    groupedErrors,
    groupedWarnings,
    mediaTimeline,
    wsTimeline,
    reconnectTimeline,
    gameTimeline,
    criticalMoments,
    hints,
    environment: {
      server: {
        nodeVersion: process.version,
        // mediasoupWorkerCount + worker stay 0/null in D1.4 — wiring
        // workerPool through the report builder is a D2 follow-up.
        mediasoupWorkerCount: 0,
        worker: null,
      },
      clientSamples,
    },
    caps: {
      maxEvents: ROOM_DIAGNOSTIC_REPORT_MAX_EVENTS,
      maxTimelineBytes: ROOM_DIAGNOSTIC_REPORT_MAX_BYTES,
    },
  }
}
