import type { App } from 'vue'
import type {
  DiagnosticArea,
  DiagnosticEvent,
  DiagnosticEventType,
  DiagnosticGameType,
  DiagnosticLevel,
} from './schema'
import { apiUrl } from '@/utils/apiUrl'
import {
  getAnalyticsSessionId,
  redactSensitiveDiagnosticsText,
  sanitizeDiagnosticsMetadata,
  trackClientError,
} from '@/utils/clientAnalytics'

/**
 * Block D1 — diagnostics foundation, client side.
 *
 * Module-level emitter + ring-buffer + batched POST to
 * `/api/events/room`. All public functions are non-throwing and safe
 * to call before initialization.
 *
 * Reuses analytics-side `sessionId()`, redaction, and metadata
 * sanitization through small wrapper exports in `clientAnalytics.ts`.
 * Existing `window.error` + `unhandledrejection` listeners stay owned
 * by `clientAnalytics.initClientAnalytics`; that file fans out into
 * this emitter via `emitDiagnosticEvent`.
 *
 * Default level filter (read once at module load from `location.search`):
 *   - prod default                : warn | error | critical
 *   - `?diagnostics=1`            : adds `info`
 *   - `?diagnostics=debug`        : adds `debug`
 *   - `?mode=view`                : clamps to `error | critical`
 *
 * Queue policy:
 *   - pending capacity            : 64 events
 *   - batch on flush              : <=16 events OR <=8 KB
 *   - flush every                 : 1 second (when non-empty)
 *   - flush on `pagehide`         : best-effort with `keepalive: true`
 */

const ENDPOINT = '/api/events/room'

const QUEUE_CAPACITY = 64
const BATCH_MAX_EVENTS = 16
const BATCH_MAX_BYTES = 8 * 1024
const FLUSH_INTERVAL_MS = 1000

type DiagnosticContext = {
  roomId: string | null
  gameType: DiagnosticGameType
  peerId: string | null
  userId: string | null
  sessionId: string | null
  correlationId: string | null
}

const LEVEL_RANK: Record<DiagnosticLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
}

const PROD_FLOOR: DiagnosticLevel = 'warn'
const VIEW_FLOOR: DiagnosticLevel = 'error'

const queue: DiagnosticEvent[] = []
let initialized = false
let dropped = 0
let flushTimer: ReturnType<typeof setTimeout> | null = null
let levelFloor: DiagnosticLevel = PROD_FLOOR

/**
 * Per `${type}:${peerId}` throttle gate. Bounded LRU semantics
 * (insertion-order Map; oldest evicted on overflow) so a long session does
 * not leak entries. Sized large enough to cover ~16 peers × the throttled
 * event types in the MVP scope.
 */
const THROTTLE_KEYS_MAX = 128
const PLAYBACK_THROTTLE_WINDOW_MS = 10_000
const THROTTLED_EVENT_TYPES: ReadonlySet<DiagnosticEventType> = new Set([
  'video_play_failed',
  'audio_play_failed',
])
const lastEmitByKey = new Map<string, number>()

function shouldThrottle(type: DiagnosticEventType, peerId: string | null): boolean {
  if (!THROTTLED_EVENT_TYPES.has(type) || !peerId) return false
  const key = `${type}:${peerId}`
  const now = Date.now()
  const last = lastEmitByKey.get(key)
  if (last != null && now - last < PLAYBACK_THROTTLE_WINDOW_MS) {
    return true
  }
  if (lastEmitByKey.has(key)) {
    lastEmitByKey.delete(key)
  } else if (lastEmitByKey.size >= THROTTLE_KEYS_MAX) {
    const oldest = lastEmitByKey.keys().next()
    if (!oldest.done) lastEmitByKey.delete(oldest.value)
  }
  lastEmitByKey.set(key, now)
  return false
}

const context: DiagnosticContext = {
  roomId: null,
  gameType: null,
  peerId: null,
  userId: null,
  sessionId: null,
  correlationId: null,
}

function safeWindow(): Window | null {
  try {
    return typeof window !== 'undefined' ? window : null
  } catch {
    return null
  }
}

function readSearchParam(name: string): string | null {
  const w = safeWindow()
  if (!w) return null
  try {
    const params = new URLSearchParams(w.location.search)
    return params.get(name)
  } catch {
    return null
  }
}

function computeLevelFloor(): DiagnosticLevel {
  if (readSearchParam('mode') === 'view') return VIEW_FLOOR
  const diag = readSearchParam('diagnostics')
  if (diag === 'debug') return 'debug'
  if (diag === '1' || diag === 'on' || diag === 'true') return 'info'
  return PROD_FLOOR
}

function isLevelEnabled(level: DiagnosticLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[levelFloor]
}

function genEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function detectPlatform(): 'desktop' | 'mobile' | undefined {
  const w = safeWindow()
  if (!w) return undefined
  try {
    const ua = w.navigator?.userAgent ?? ''
    if (!ua) return undefined
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ? 'mobile' : 'desktop'
  } catch {
    return undefined
  }
}

function envSnapshot(): DiagnosticEvent['env'] {
  const w = safeWindow()
  if (!w) return undefined
  const nav = (w.navigator ?? null) as
    | (Navigator & { deviceMemory?: number })
    | null
  const out: DiagnosticEvent['env'] = {}
  try {
    const ua = nav?.userAgent
    if (typeof ua === 'string' && ua.length > 0) out.ua = ua.slice(0, 240)
  } catch {
    // ignore
  }
  const platform = detectPlatform()
  if (platform) out.platform = platform
  out.isView = readSearchParam('mode') === 'view'
  try {
    out.hidden = typeof w.document?.visibilityState === 'string'
      ? w.document.visibilityState === 'hidden'
      : false
  } catch {
    // ignore
  }
  try {
    if (typeof nav?.hardwareConcurrency === 'number') {
      out.hardwareConcurrency = nav.hardwareConcurrency
    }
  } catch {
    // ignore
  }
  try {
    if (typeof nav?.deviceMemory === 'number') {
      out.deviceMemory = nav.deviceMemory
    }
  } catch {
    // ignore
  }
  return out
}

function ensureInitialized(): void {
  if (initialized) return
  initialized = true
  levelFloor = computeLevelFloor()
  context.sessionId = getAnalyticsSessionId()
  const w = safeWindow()
  if (!w) return
  try {
    w.addEventListener('pagehide', () => {
      flushDiagnostics(true)
    })
  } catch {
    // ignore
  }
}

function scheduleFlush(): void {
  if (flushTimer != null) return
  const w = safeWindow()
  if (!w) return
  try {
    flushTimer = setTimeout(() => {
      flushTimer = null
      flushDiagnostics(false)
    }, FLUSH_INTERVAL_MS)
  } catch {
    flushTimer = null
  }
}

function approxJsonBytes(value: unknown): number {
  try {
    return JSON.stringify(value).length
  } catch {
    return 0
  }
}

function sendBatch(batch: DiagnosticEvent[], keepalive: boolean): void {
  const w = safeWindow()
  if (!w || batch.length === 0) return
  let body: string
  try {
    body = JSON.stringify({ events: batch, sessionId: context.sessionId })
  } catch {
    return
  }
  try {
    void fetch(apiUrl(ENDPOINT), {
      method: 'POST',
      credentials: 'include',
      keepalive,
      headers: {
        'Content-Type': 'application/json',
        // Matches apps/server/src/index.ts CSRF guard expectation.
        'X-Requested-With': 'streamassist-fetch',
      },
      body,
    }).catch(() => {
      // Diagnostics must never affect the app.
    })
  } catch {
    // ignore
  }
}

export interface DiagnosticEventInput {
  level: DiagnosticLevel
  area: DiagnosticArea
  type: DiagnosticEventType
  message: string
  context?: Record<string, unknown>
  error?: unknown
  /** Per-event override for context fields; merged on top of module context. */
  override?: Partial<DiagnosticContext>
}

function normalizeError(error: unknown): DiagnosticEvent['error'] | undefined {
  if (error == null) return undefined
  if (error instanceof Error) {
    const out: NonNullable<DiagnosticEvent['error']> = {
      name: error.name || 'Error',
    }
    try {
      if (typeof error.stack === 'string' && error.stack.length > 0) {
        out.stack = redactSensitiveDiagnosticsText(error.stack).slice(0, 2000)
      }
    } catch {
      // ignore
    }
    const code = (error as Error & { code?: unknown }).code
    if (typeof code === 'string' && code.length > 0) {
      out.code = code.slice(0, 80)
    }
    return out
  }
  if (typeof error === 'string') {
    return { name: 'Error', stack: redactSensitiveDiagnosticsText(error).slice(0, 2000) }
  }
  return undefined
}

export function setDiagnosticsContext(partial: Partial<DiagnosticContext>): void {
  try {
    ensureInitialized()
    if ('roomId' in partial) context.roomId = partial.roomId ?? null
    if ('gameType' in partial) context.gameType = partial.gameType ?? null
    if ('peerId' in partial) context.peerId = partial.peerId ?? null
    if ('userId' in partial) context.userId = partial.userId ?? null
    if ('sessionId' in partial) context.sessionId = partial.sessionId ?? null
    if ('correlationId' in partial) context.correlationId = partial.correlationId ?? null
  } catch {
    // ignore
  }
}

export function emitDiagnosticEvent(input: DiagnosticEventInput): void {
  try {
    ensureInitialized()
    if (!isLevelEnabled(input.level)) return

    const ctx = {
      ...context,
      ...(input.override ?? {}),
    }

    if (shouldThrottle(input.type, ctx.peerId)) return

    const message = redactSensitiveDiagnosticsText(
      typeof input.message === 'string' && input.message.length > 0
        ? input.message
        : input.type,
    ).slice(0, 500)

    const eventContext = sanitizeDiagnosticsMetadata(input.context)

    const event: DiagnosticEvent = {
      id: genEventId(),
      reportVersion: 1,
      timestamp: Date.now(),
      source: 'client',
      level: input.level,
      area: input.area,
      type: input.type,
      roomId: ctx.roomId,
      gameType: ctx.gameType,
      peerId: ctx.peerId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      correlationId: ctx.correlationId,
      message,
      context: eventContext,
    }

    const errPayload = normalizeError(input.error)
    if (errPayload) event.error = errPayload

    const env = envSnapshot()
    if (env && Object.keys(env).length > 0) event.env = env

    if (queue.length >= QUEUE_CAPACITY) {
      queue.shift()
      dropped += 1
    }
    queue.push(event)

    scheduleFlush()
  } catch {
    // Diagnostics must never throw.
  }
}

export function getDiagnosticsDroppedCount(): number {
  return dropped
}

export function flushDiagnostics(keepalive = false): void {
  try {
    if (flushTimer != null) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    while (queue.length > 0) {
      const batch: DiagnosticEvent[] = []
      let bytes = 0
      while (
        queue.length > 0 &&
        batch.length < BATCH_MAX_EVENTS &&
        bytes < BATCH_MAX_BYTES
      ) {
        const next = queue[0]!
        const nextBytes = approxJsonBytes(next)
        if (batch.length > 0 && bytes + nextBytes > BATCH_MAX_BYTES) break
        queue.shift()
        batch.push(next)
        bytes += nextBytes
      }
      if (batch.length === 0) break
      sendBatch(batch, keepalive)
    }
    // Drop count is intentionally NOT round-tripped as its own diagnostic
    // event — there is no semantically correct type for it in the MVP
    // taxonomy and producing a fake one (e.g. `backend_handler_error`)
    // would confuse the report. Tests / dev tools can read the counter
    // via `getDiagnosticsDroppedCount()`.
  } catch {
    // ignore
  }
}

export function installDiagnosticsVueErrorHandler(app: App): void {
  try {
    const previous = app.config.errorHandler
    app.config.errorHandler = (err, instance, info) => {
      try {
        // Preserve existing client error tracking path (writes to
        // /api/events/error via the existing analytics rate limiter).
        trackClientError(err, { info }, 'vue.errorHandler')
      } catch {
        // ignore
      }
      try {
        emitDiagnosticEvent({
          level: 'error',
          area: 'ui',
          type: 'uncaught_client_error',
          message: err instanceof Error
            ? `${err.name}: ${err.message || ''}`.trim()
            : 'Vue errorHandler',
          context: { info },
          error: err,
        })
      } catch {
        // ignore
      }
      // Preserve Vue's default error-logging behaviour. Setting
      // `app.config.errorHandler` suppresses Vue's built-in
      // `console.error` for caught render/setup errors; without this
      // line a production deployment would silently swallow them.
      // Logging here keeps the same posture as dev — errors still
      // surface in the operator's browser console.
      try {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error('[vue.errorHandler]', err, info)
        }
      } catch {
        // ignore
      }
      // If a previous handler existed, chain it.
      if (typeof previous === 'function') {
        try {
          previous(err, instance, info)
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // never break app mounting because of diagnostics
  }
}
