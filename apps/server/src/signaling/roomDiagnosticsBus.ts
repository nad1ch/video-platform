/**
 * In-memory per-room diagnostics ring buffer (Block D1 — foundation).
 *
 * Pure data plane: no DB, no Prisma. The shape of an event mirrors the
 * client-side `DiagnosticEvent` type defined in
 * `packages/call-core/src/diagnostics/schema.ts`. The server does NOT
 * depend on `call-core` — this file keeps a local copy of the wire
 * shape (same per-side pattern used by `mafiaWsProtocol` /
 * `gameRoomWsProtocol`). The two definitions describe the same JSON
 * format and stay in sync by code review.
 *
 * Hard limits:
 *   - Per-room capacity: 2000 events.
 *   - Total tracked rooms: bounded by `MAX_TRACKED_ROOMS` (drop oldest
 *     room on overflow). Cold rooms are reaped after
 *     `ROOM_IDLE_REAP_MS`.
 *   - Per-event size after sanitization is enforced by the caller; the
 *     bus does a final defensive truncation pass on `message` /
 *     `context` JSON size so a runaway producer can't grow memory.
 *
 * `recordDiagnosticEvent` is best-effort and MUST NOT throw.
 */

export type RoomDiagnosticLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'

export type RoomDiagnosticArea =
  | 'room'
  | 'ws'
  | 'webrtc'
  | 'media'
  | 'playback'
  | 'game'
  | 'auth'
  | 'twitch'
  | 'ui'
  | 'performance'
  | 'backend'

export type RoomDiagnosticGameType =
  | 'mafia'
  | 'game-room'
  | 'eat-first'
  | 'nadle'
  | 'nadraw-show'
  | 'checkers'
  | null

/**
 * Server-local wire shape. Matches `DiagnosticEvent` in
 * `packages/call-core/src/diagnostics/schema.ts`. Kept loosely typed
 * (`unknown` for nested error/env/context) so server code never has to
 * trust the union literal exhaustiveness — the JSON has already been
 * sanitized by the ingestion endpoint.
 */
export interface RoomDiagnosticEvent {
  id: string
  reportVersion: 1
  timestamp: number
  source: 'client' | 'server'
  level: RoomDiagnosticLevel
  area: RoomDiagnosticArea
  type: string
  roomId: string | null
  gameType: RoomDiagnosticGameType
  peerId: string | null
  userId: string | null
  sessionId: string | null
  correlationId: string | null
  message: string
  context: Record<string, unknown>
  error?: { name: string; stack?: string; code?: string }
  env?: Record<string, unknown>
}

export interface RoomDiagnosticsSnapshot {
  events: RoomDiagnosticEvent[]
  truncated: boolean
  totalAppended: number
  eventsDroppedOlderThan: number | null
  firstAt: number | null
  lastAt: number | null
}

const PER_ROOM_CAPACITY = 2000
const MAX_TRACKED_ROOMS = 256
const ROOM_IDLE_REAP_MS = 30 * 60 * 1000
const ROOM_REAP_INTERVAL_MS = 5 * 60 * 1000
const MAX_MESSAGE_LENGTH = 500
const MAX_CONTEXT_BYTES = 4 * 1024
const MAX_STACK_LENGTH = 2000

/**
 * Diagnostics-level empty-room grace. When `room_closed` arrives, the
 * bucket is NOT finalized immediately — finalization is deferred for this
 * many ms so a host reload / brief reconnect storm keeps the report
 * continuous instead of splitting into two truncated reports.
 *
 * Cancelled by any `room_created` or `room_joined` arriving for the same
 * bucket during the window. Expiry triggers persistence (best-effort).
 */
export const ROOM_DIAGNOSTICS_EMPTY_GRACE_MS = 60_000

/** Cap on remembered "finalized" bucket keys (LRU-style). */
const FINALIZED_BUCKETS_MAX = 256

/** Public so callers can clamp consistently and so admin route can validate. */
export const ROOM_ID_MAX_LENGTH = 200

/**
 * Bucket prefix for events that arrive without a `roomId` but with a
 * `sessionId`. Each browser tab has a stable `sessionStorage` analytics
 * session id, so global errors (auth flow, home page, route guards) still
 * land in one coherent bucket per tab instead of being dropped.
 *
 * The stored event keeps `roomId: null` so report consumers can tell
 * apart "happened in room X" from "happened in tab Y outside any room".
 */
export const BUCKET_PREFIX_SESSION = 'session:'

const EVENT_ID_RANDOM_LENGTH = 10

/**
 * Sensitive-key + Bearer/cookie/url-token redaction. Identical bytes to
 * the redaction in `clientEventsRouter.ts` and `clientAnalytics.ts` — kept
 * inline here so server-internal emits (which bypass the ingestion route)
 * are still defense-in-depth safe before landing in the bus.
 */
const SENSITIVE_KEY_RE =
  /(token|cookie|password|passwd|secret|authorization|authheader|auth_header|credential|private|message)/i

function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[a-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b(cookie|authorization)\s*[:=]\s*[^,\s;]+/gi, '$1=[redacted]')
    .replace(
      /([?&](?:token|code|state|password|secret|auth|access_token|refresh_token)=)[^&\s]+/gi,
      '$1[redacted]',
    )
}

function redactString(value: string, maxLength: number): string {
  const s = redactSensitiveText(value)
  return s.length > maxLength ? s.slice(0, maxLength) : s
}

/**
 * Shared diagnostic event id generator. Used at every server emit site
 * (messageHandlers, RoomManager, socketServer, clientEventsRouter
 * fallback) so id format stays consistent.
 *
 * Format: `srv-<ms-base36>-<random-base36>`. ~52 bits of entropy +
 * millisecond clock — collision-free in practice at our scale.
 */
export function newDiagnosticEventId(): string {
  return `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 2 + EVENT_ID_RANDOM_LENGTH)}`
}

interface RoomBuffer {
  events: RoomDiagnosticEvent[]
  truncated: boolean
  totalAppended: number
  eventsDroppedOlderThan: number | null
  lastTouchedAt: number
}

const rooms = new Map<string, RoomBuffer>()

function approxJsonBytes(value: unknown): number {
  try {
    return JSON.stringify(value).length
  } catch {
    return 0
  }
}

/**
 * Recursively redact string leaves and drop sensitive keys. Bounded
 * depth (2) and key-count (24) to match the existing client/server
 * sanitizer shape. Server-internal emits go through this path too, so
 * a stray `error.stack` mentioning a token is redacted before storage.
 */
const CONTEXT_MAX_DEPTH = 2
const CONTEXT_MAX_KEYS = 24
const CONTEXT_MAX_STRING_LENGTH = 240

function redactContextValue(value: unknown, depth: number): unknown {
  if (value == null) return null
  if (typeof value === 'string') return redactString(value, CONTEXT_MAX_STRING_LENGTH)
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    if (depth >= CONTEXT_MAX_DEPTH) return null
    return value.slice(0, 12).map((v) => redactContextValue(v, depth + 1))
  }
  if (typeof value === 'object') {
    if (depth >= CONTEXT_MAX_DEPTH) return null
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value).slice(0, CONTEXT_MAX_KEYS)) {
      if (SENSITIVE_KEY_RE.test(k)) continue
      out[k.slice(0, 80)] = redactContextValue(v, depth + 1)
    }
    return out
  }
  return null
}

function clampContext(context: unknown): Record<string, unknown> {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return {}
  }
  const redacted = redactContextValue(context, 0)
  if (!redacted || typeof redacted !== 'object' || Array.isArray(redacted)) {
    return {}
  }
  if (approxJsonBytes(redacted) <= MAX_CONTEXT_BYTES) {
    return redacted as Record<string, unknown>
  }
  return { __truncated: true }
}

function clampMessage(input: unknown): string {
  if (typeof input !== 'string') return ''
  return redactString(input, MAX_MESSAGE_LENGTH)
}

function clampError(input: RoomDiagnosticEvent['error']): RoomDiagnosticEvent['error'] | undefined {
  if (!input || typeof input !== 'object') return undefined
  const name = typeof input.name === 'string' ? redactString(input.name, 120) : 'Error'
  const out: NonNullable<RoomDiagnosticEvent['error']> = { name }
  if (typeof input.stack === 'string' && input.stack.length > 0) {
    out.stack = redactString(input.stack, MAX_STACK_LENGTH)
  }
  if (typeof input.code === 'string' && input.code.length > 0) {
    out.code = redactString(input.code, 80)
  }
  return out
}

/**
 * True LRU: on a hit, re-insert the bucket so it becomes the most-recently
 * inserted key in the Map. `rooms.keys().next()` then always returns the
 * least-recently touched key when MAX_TRACKED_ROOMS is exceeded.
 *
 * Without the re-insert, a long-lived monitor room created first would
 * be evicted by a flood of short-lived rooms even while it kept
 * receiving events. (Map iteration order is insertion order, not
 * last-access order.)
 */
function touchAndPromote(key: string, buffer: RoomBuffer): RoomBuffer {
  buffer.lastTouchedAt = Date.now()
  rooms.delete(key)
  rooms.set(key, buffer)
  return buffer
}

function getRoomBuffer(bucketKey: string): RoomBuffer {
  const existing = rooms.get(bucketKey)
  if (existing) {
    return touchAndPromote(bucketKey, existing)
  }
  if (rooms.size >= MAX_TRACKED_ROOMS) {
    const oldestKey = rooms.keys().next()
    if (!oldestKey.done) {
      /**
       * Audit R18: finalize the evicted bucket before dropping it. The
       * previous `rooms.delete(oldestKey.value)` discarded every event
       * collected for that room — so under sustained pressure (≥
       * MAX_TRACKED_ROOMS rooms churning) the LRU silently lost
       * reports that would otherwise have been persisted by the
       * empty-grace timer.
       *
       * `finalizeRoomBucket` runs the registered persistence finalizer
       * inline (a `void prisma.create().catch(...)`), so the eviction
       * loop is bounded: a write-storm under heavy churn is still
       * limited to one persistence call per evicted bucket. Pending
       * empty-grace timers for the same key are cleared first so they
       * cannot re-fire after we evict.
       */
      cancelRoomFinalization(oldestKey.value, 'lru_eviction')
      finalizeRoomBucket(oldestKey.value, 'lru_eviction')
    }
  }
  const buffer: RoomBuffer = {
    events: [],
    truncated: false,
    totalAppended: 0,
    eventsDroppedOlderThan: null,
    lastTouchedAt: Date.now(),
  }
  rooms.set(bucketKey, buffer)
  return buffer
}

/**
 * Append a diagnostic event to its bucket. Best-effort; never throws.
 *
 * Bucket selection:
 *   1. `roomId` if present → `roomId` (e.g. `mafia:foo`, `gameroom:bar`).
 *   2. else, if `sessionId` is present → `session:<sessionId>`.
 *   3. else, the event is dropped (no correlation key at all).
 *
 * The stored event preserves the original `roomId` (including `null`)
 * so report consumers can distinguish room-correlated from session-only
 * events when they appear in the same bucket lookup.
 */
export function recordDiagnosticEvent(event: RoomDiagnosticEvent): void {
  try {
    const roomId = typeof event.roomId === 'string' && event.roomId.length > 0
      ? event.roomId.slice(0, ROOM_ID_MAX_LENGTH)
      : null
    const sessionId = typeof event.sessionId === 'string' && event.sessionId.length > 0
      ? event.sessionId.slice(0, ROOM_ID_MAX_LENGTH)
      : null

    const bucketKey = roomId ?? (sessionId ? `${BUCKET_PREFIX_SESSION}${sessionId}` : null)
    if (!bucketKey) return

    const safeEvent: RoomDiagnosticEvent = {
      ...event,
      roomId,
      message: clampMessage(event.message),
      context: clampContext(event.context),
      ...(event.error ? { error: clampError(event.error) } : {}),
    }

    // Grace cancel trigger — must run BEFORE arm trigger so a
    // `room_closed` that races a `room_joined` does not re-arm
    // immediately after the join cancels.
    if (
      !suppressGraceTriggers &&
      pendingFinalization.has(bucketKey) &&
      (event.type === 'room_created' || event.type === 'room_joined')
    ) {
      cancelRoomFinalization(bucketKey, `rejoin via ${event.type}`)
    }

    const buffer = getRoomBuffer(bucketKey)
    if (buffer.events.length >= PER_ROOM_CAPACITY) {
      const dropped = buffer.events.shift()
      buffer.truncated = true
      if (dropped) {
        buffer.eventsDroppedOlderThan = dropped.timestamp
      }
    }
    buffer.events.push(safeEvent)
    buffer.totalAppended += 1

    // Grace arm trigger — runs AFTER append so the `room_closed`
    // event itself appears in the timeline before the
    // `room_empty_grace_started` marker emit. Deferred via
    // queueMicrotask so the marker append never re-enters this fn
    // from inside the current call frame.
    if (
      !suppressGraceTriggers &&
      event.type === 'room_closed' &&
      !isSessionBucket(bucketKey)
    ) {
      queueMicrotask(() => {
        try {
          armRoomFinalization(bucketKey)
        } catch {
          // never throw
        }
      })
    }
  } catch {
    // Diagnostics bus must never throw.
  }
}

/**
 * Snapshot accepts either a real roomId (`mafia:foo`) or a session
 * bucket key (`session:<sessionId>`). The admin export route uses the
 * same string key directly.
 */
export function snapshotRoomDiagnostics(bucketKey: string): RoomDiagnosticsSnapshot | null {
  const buffer = rooms.get(bucketKey)
  if (!buffer) return null
  touchAndPromote(bucketKey, buffer)
  const events = buffer.events.slice()
  return {
    events,
    truncated: buffer.truncated,
    totalAppended: buffer.totalAppended,
    eventsDroppedOlderThan: buffer.eventsDroppedOlderThan,
    firstAt: events.length > 0 ? events[0]!.timestamp : null,
    lastAt: events.length > 0 ? events[events.length - 1]!.timestamp : null,
  }
}

export function clearRoomDiagnostics(roomId: string): void {
  try {
    rooms.delete(roomId)
    const t = pendingFinalization.get(roomId)
    if (t) {
      clearTimeout(t)
      pendingFinalization.delete(roomId)
    }
  } catch {
    // ignore
  }
}

// ─── Empty-room grace + finalization ──────────────────────────────────
//
// `room_closed` does NOT immediately produce a persisted report. Instead
// the bus arms a `ROOM_DIAGNOSTICS_EMPTY_GRACE_MS` timer per bucket; if a
// `room_created` or `room_joined` arrives for the same bucket during the
// window, the timer is cancelled (host/player just reloaded). Only when
// the window elapses with no rejoin do we snapshot + invoke registered
// finalizers (persistence layer).
//
// Finalization runs at most once per bucket-version. After the bucket is
// finalized + cleared, a fresh `room_created` for the same roomId starts
// a brand new bucket (and therefore a brand new report).

export type RoomDiagnosticsFinalizationReason =
  | 'empty_grace_elapsed'
  | 'forced'
  /**
   * Audit R18: bucket persisted because the live LRU evicted it before
   * the empty-grace timer fired. Logged on the row so reports persisted
   * via this path are distinguishable from the natural-expiry shape.
   */
  | 'lru_eviction'
  /**
   * Bucket persisted because the periodic idle reaper found no events for
   * {@link ROOM_IDLE_REAP_MS}. Previously the reaper called
   * `rooms.delete(roomId)` directly, silently dropping every accumulated
   * event for a long-quiet room — so a multi-hour call that only emitted
   * `room_joined` at the start and `room_closed` at the end would land in
   * admin diagnostics as a ~1-minute report whose `firstAt`/`lastAt` came
   * from the late `room_closed` marker. Finalizing before drop preserves
   * the timeline; the row's `finalizedReason` distinguishes reaper
   * persistence from the empty-grace natural path.
   */
  | 'idle_reap'

export interface RoomDiagnosticsFinalizationMeta {
  bucketKey: string
  reason: RoomDiagnosticsFinalizationReason
  finalizedAt: number
}

export type RoomDiagnosticsFinalizer = (
  meta: RoomDiagnosticsFinalizationMeta,
  snapshot: RoomDiagnosticsSnapshot,
) => void

const pendingFinalization = new Map<string, ReturnType<typeof setTimeout>>()
const finalizers = new Set<RoomDiagnosticsFinalizer>()
/**
 * Sentinel to suppress recursion: events emitted from inside the grace
 * machinery (`room_empty_grace_started` / `_cancelled` /
 * `room_report_finalized`) must not themselves trigger cancel/arm logic.
 */
let suppressGraceTriggers = false

function isSessionBucket(bucketKey: string): boolean {
  return bucketKey.startsWith(BUCKET_PREFIX_SESSION)
}

function gameTypeForBucket(bucketKey: string): RoomDiagnosticGameType {
  if (bucketKey.startsWith('mafia:')) return 'mafia'
  if (bucketKey.startsWith('gameroom:')) return 'game-room'
  if (bucketKey.startsWith('eat:')) return 'eat-first'
  if (bucketKey.startsWith('nadle:')) return 'nadle'
  if (bucketKey.startsWith('nadraw-show:')) return 'nadraw-show'
  if (bucketKey.startsWith('checkers:')) return 'checkers'
  return null
}

function emitGraceMarker(
  bucketKey: string,
  type: 'room_empty_grace_started' | 'room_empty_grace_cancelled' | 'room_report_finalized',
  context: Record<string, unknown>,
): void {
  // Bypass the cancel/arm check that recordDiagnosticEvent runs.
  // Re-entering the grace machinery from a marker event would loop.
  suppressGraceTriggers = true
  try {
    recordDiagnosticEvent({
      id: newDiagnosticEventId(),
      reportVersion: 1,
      timestamp: Date.now(),
      source: 'server',
      level: 'info',
      area: 'room',
      type,
      roomId: bucketKey,
      gameType: gameTypeForBucket(bucketKey),
      peerId: null,
      userId: null,
      sessionId: null,
      correlationId: null,
      message: type,
      context,
    })
  } finally {
    suppressGraceTriggers = false
  }
}

function armRoomFinalization(bucketKey: string): void {
  if (isSessionBucket(bucketKey)) return // session buckets are not finalized to DB
  if (pendingFinalization.has(bucketKey)) return // already armed
  const t = setTimeout(() => {
    pendingFinalization.delete(bucketKey)
    finalizeRoomBucket(bucketKey, 'empty_grace_elapsed')
  }, ROOM_DIAGNOSTICS_EMPTY_GRACE_MS)
  if (typeof t.unref === 'function') t.unref()
  pendingFinalization.set(bucketKey, t)
  emitGraceMarker(bucketKey, 'room_empty_grace_started', {
    graceMs: ROOM_DIAGNOSTICS_EMPTY_GRACE_MS,
  })
}

function cancelRoomFinalization(bucketKey: string, reason: string): void {
  const t = pendingFinalization.get(bucketKey)
  if (!t) return
  clearTimeout(t)
  pendingFinalization.delete(bucketKey)
  emitGraceMarker(bucketKey, 'room_empty_grace_cancelled', { reason })
}

function finalizeRoomBucket(bucketKey: string, reason: RoomDiagnosticsFinalizationReason): void {
  // Guard against double-finalization: if no bucket exists, a prior
  // finalize (natural-expiry OR drain) already deleted it. Emitting a
  // fresh `room_report_finalized` here would silently recreate a
  // one-event bucket and persist a duplicate DB row.
  if (!rooms.has(bucketKey)) return
  // Emit the finalization marker first so it appears in the snapshot.
  emitGraceMarker(bucketKey, 'room_report_finalized', { reason })
  const buffer = rooms.get(bucketKey)
  if (!buffer) return
  const snapshot: RoomDiagnosticsSnapshot = {
    events: buffer.events.slice(),
    truncated: buffer.truncated,
    totalAppended: buffer.totalAppended,
    eventsDroppedOlderThan: buffer.eventsDroppedOlderThan,
    firstAt: buffer.events.length > 0 ? buffer.events[0]!.timestamp : null,
    lastAt: buffer.events.length > 0 ? buffer.events[buffer.events.length - 1]!.timestamp : null,
  }
  const meta: RoomDiagnosticsFinalizationMeta = {
    bucketKey,
    reason,
    finalizedAt: Date.now(),
  }
  // Invoke registered finalizers. Each is best-effort: a throwing
  // finalizer must not prevent the bucket from being cleared, otherwise
  // a persistent DB outage would leak memory.
  for (const fn of finalizers) {
    try {
      fn(meta, snapshot)
    } catch {
      // never throw
    }
  }
  // Drop the bucket so a future rejoin starts a clean new report.
  rooms.delete(bucketKey)
  // GC the finalized set so memory stays bounded.
  if (recentlyFinalized.size >= FINALIZED_BUCKETS_MAX) {
    const oldest = recentlyFinalized.keys().next()
    if (!oldest.done) recentlyFinalized.delete(oldest.value)
  }
  recentlyFinalized.set(bucketKey, meta.finalizedAt)
}

/**
 * Recently-finalized buckets. Used only for diagnostics/inspection — the
 * bus does not reject events for finalized buckets (a brand new room
 * with the same id starts a brand new bucket / brand new report).
 */
const recentlyFinalized = new Map<string, number>()

/**
 * Register a finalizer callback. Returns an unregister function.
 *
 * The callback runs synchronously inside the bus; the persistence layer
 * does its own `void promise.catch(...)` to keep DB I/O off the timer
 * callstack. Throwing here is swallowed by the bus and never escapes.
 */
export function registerRoomDiagnosticsFinalizer(
  fn: RoomDiagnosticsFinalizer,
): () => void {
  finalizers.add(fn)
  return () => {
    finalizers.delete(fn)
  }
}

/**
 * Force-finalize ALL live room buckets — used on graceful server
 * shutdown so any in-progress report (whether already in empty-room
 * grace OR still actively receiving events) gets a chance to persist.
 *
 * Session buckets (`session:<sid>`) are skipped: they have no clean
 * "session ended" signal and are not persisted in D1.3 by design.
 *
 * Best-effort: the persistence finalizer's actual DB write is async
 * (`void writeRoomDiagnosticReport().catch(...)`). On SIGTERM the
 * process may exit before some writes flush. Calling this still
 * improves over not calling it — it strictly increases the set of
 * reports that get persisted.
 */
export function finalizeAllPendingRoomDiagnostics(): void {
  try {
    // Cancel every pending grace timer first so the loop below cannot
    // race with a natural-expiry firing mid-shutdown.
    for (const t of pendingFinalization.values()) clearTimeout(t)
    pendingFinalization.clear()
    // Iterate every live room bucket. Snapshot the keys before the
    // loop so `finalizeRoomBucket`'s `rooms.delete(...)` inside the
    // body does not invalidate iteration.
    const keys: string[] = []
    for (const key of rooms.keys()) {
      if (!key.startsWith(BUCKET_PREFIX_SESSION)) keys.push(key)
    }
    for (const key of keys) {
      finalizeRoomBucket(key, 'forced')
    }
  } catch {
    // never throw
  }
}

/** Test/inspection helper — count of in-flight grace timers. */
export function _pendingFinalizationCountForTests(): number {
  return pendingFinalization.size
}

const reaper = setInterval(() => {
  try {
    const now = Date.now()
    /**
     * Snapshot idle keys before mutating `rooms`. `finalizeRoomBucket` calls
     * `emitGraceMarker` → `recordDiagnosticEvent` → `touchAndPromote` which
     * delete-and-reinserts the bucket, then `finalizeRoomBucket` itself
     * deletes it. Iterating the live Map while finalizing is observably
     * correct on V8 but the snapshot keeps this loop trivially safe — same
     * pattern as `finalizeAllPendingRoomDiagnostics`.
     */
    const idleKeys: string[] = []
    for (const [roomId, buffer] of rooms) {
      if (now - buffer.lastTouchedAt > ROOM_IDLE_REAP_MS) {
        idleKeys.push(roomId)
      }
    }
    /**
     * Mirror the LRU-eviction path (audit R18): finalize before drop so a
     * long-quiet room's accumulated events are persisted instead of
     * silently lost. `cancelRoomFinalization` is a no-op when no grace
     * timer is armed (the common case for a bucket reaped after 30 min of
     * silence without `room_closed`).
     */
    for (const roomId of idleKeys) {
      cancelRoomFinalization(roomId, 'idle_reap')
      finalizeRoomBucket(roomId, 'idle_reap')
    }
  } catch {
    // ignore
  }
}, ROOM_REAP_INTERVAL_MS)
if (typeof reaper.unref === 'function') reaper.unref()
