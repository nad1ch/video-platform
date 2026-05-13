import type { Router, RouteLocationNormalized } from 'vue-router'
import { apiUrl } from '@/utils/apiUrl'
import { emitDiagnosticEvent, setDiagnosticsContext } from '@/diagnostics/useDiagnostics'
import { useAuth } from '@/composables/useAuth'
import { MAFIA_SIGNALING_ROOM_PREFIX } from '@/composables/useMafiaMediaRoom'
import { GAME_ROOM_SIGNALING_ROOM_PREFIX } from '@/composables/useGameRoomMediaRoom'

const EVENT_ENDPOINT = '/api/events/client'
const ERROR_ENDPOINT = '/api/events/error'
const SESSION_KEY = 'streamassist.analyticsSessionId'
const MAX_METADATA_KEYS = 24
const MAX_STRING_LENGTH = 240
const SEND_DEBOUNCE_MS = 750
/**
 * Hard ceiling for the per-event-key debounce map. The dominant key is
 * `event:path`, which is small and bounded in practice — but a long-running
 * SPA session that visits many dynamic streamer routes could otherwise grow
 * this map unboundedly. Map iteration preserves insertion order, so dropping
 * the first entry behaves as a simple FIFO/LRU when entries are revisited
 * (each `set` re-inserts at the end).
 */
const MAX_DEBOUNCE_KEYS = 256
const SENSITIVE_KEY_RE = /(token|cookie|password|passwd|secret|authorization|authheader|auth_header|credential|private|message)/i

const GAME_ROUTE_NAMES = new Map<string, string>([
  ['nadle-streamer', 'nadle'],
  ['app-streamer', 'nadle'],
  ['nadraw-show', 'nadraw-show'],
  ['checkers', 'checkers'],
  ['eat', 'eat-first'],
  ['mafia', 'mafia'],
])

/**
 * Mapping from `route.name` to the `DiagnosticGameType` literal the
 * diagnostics schema accepts. A `null` value (or absence) means the
 * route is not a game route and we clear the diagnostics gameType.
 */
type DiagnosticGameTypeLiteral =
  | 'mafia'
  | 'game-room'
  | 'eat-first'
  | 'nadle'
  | 'nadraw-show'
  | 'checkers'

const ROUTE_TO_DIAGNOSTIC_GAME_TYPE = new Map<string, DiagnosticGameTypeLiteral>([
  ['mafia', 'mafia'],
  ['game-template', 'game-room'],
  ['eat', 'eat-first'],
  ['nadle-streamer', 'nadle'],
  ['app-streamer', 'nadle'],
  ['nadraw-show', 'nadraw-show'],
  ['checkers', 'checkers'],
])

/**
 * Client-only bucket prefixes for routes whose data path is NOT the
 * mediasoup signaling WS. Server emits never appear here (those games
 * have their own WS servers); keeping a per-route bucket key still lets
 * the admin export show client-side errors from those routes.
 */
const CHECKERS_CLIENT_BUCKET_PREFIX = 'checkers:'
const STREAMER_CLIENT_BUCKET_PREFIX = 'streamer:'

/** Strip anything that is not URL-path-safe; `normalizeDisplayName` lives
 * in `call-core` and we cannot import it here without crossing the
 * package boundary. Bounded length so a hostile query cannot push the
 * bus past `ROOM_ID_MAX_LENGTH` on the server side. */
function sanitizeRoomSegment(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase().slice(0, 80)
  if (!trimmed) return null
  const sanitized = trimmed.replace(/[^a-z0-9_-]/g, '')
  return sanitized.length > 0 ? sanitized : null
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return null
}

/**
 * Derive the diagnostics `roomId` correlation key from a route.
 *
 * For Mafia and Game Template the key matches the server's signaling
 * room id byte-for-byte, so client + server events land in the same
 * report bucket. For other game routes the key is a client-only
 * convention (`checkers:<id>`, `streamer:<slug>`) — server-side those
 * games run on separate WS servers that don't emit into the bus today.
 *
 * Returns `null` when the route is not a game route or the room slug
 * is missing — callers should fall back to the session bucket.
 */
function deriveDiagnosticsRoomId(route: RouteLocationNormalized): string | null {
  const name = routeName(route.name)
  switch (name) {
    case 'mafia': {
      const base = sanitizeRoomSegment(firstString(route.query.room))
      return base ? `${MAFIA_SIGNALING_ROOM_PREFIX}${base}` : null
    }
    case 'game-template': {
      const base = sanitizeRoomSegment(firstString(route.query.room))
      return base ? `${GAME_ROOM_SIGNALING_ROOM_PREFIX}${base}` : null
    }
    case 'eat': {
      const base = sanitizeRoomSegment(firstString(route.query.game))
      return base ? `eat:${base}` : null
    }
    case 'checkers': {
      const base = sanitizeRoomSegment(firstString(route.params.roomId))
      return base ? `${CHECKERS_CLIENT_BUCKET_PREFIX}${base}` : null
    }
    case 'nadle-streamer':
    case 'app-streamer':
    case 'nadraw-show': {
      const base = sanitizeRoomSegment(firstString(route.params.streamer))
      return base ? `${STREAMER_CLIENT_BUCKET_PREFIX}${base}` : null
    }
    default:
      return null
  }
}

function applyDiagnosticsContextForRoute(route: RouteLocationNormalized): void {
  try {
    const roomId = deriveDiagnosticsRoomId(route)
    const gameType = ROUTE_TO_DIAGNOSTIC_GAME_TYPE.get(routeName(route.name)) ?? null
    let userId: string | null = null
    try {
      // `useAuth` is a module-scoped composable backed by a plain ref —
      // safe to call outside Vue setup. Reading `.value` here gives the
      // most recent auth state at navigation time.
      userId = useAuth().user.value?.id ?? null
    } catch {
      // ignore — auth not ready or composable not yet initialized
    }
    setDiagnosticsContext({
      roomId,
      gameType,
      userId,
      // peerId remains owned by per-emit overrides (StreamVideo /
      // StreamAudio). Wiring a stable peerId here requires call-core
      // access, deferred to D2.
      peerId: null,
      // correlationId is event-scoped, never set globally.
      correlationId: null,
    })
  } catch {
    // never throw from diagnostics wiring
  }
}

let initialized = false
const lastSentAt = new Map<string, number>()

function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[a-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b(cookie|authorization)\s*[:=]\s*[^,\s;]+/gi, '$1=[redacted]')
    .replace(/([?&](?:token|code|state|password|secret|auth|access_token|refresh_token)=)[^&\s]+/gi, '$1[redacted]')
}

function currentPath(): string {
  if (typeof window === 'undefined') {
    return '/'
  }
  return window.location.pathname || '/'
}

function sessionId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing) {
      return existing
    }
    const next =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    window.sessionStorage.setItem(SESSION_KEY, next)
    return next
  } catch {
    return null
  }
}

function sanitizeMetadataValue(value: unknown, depth: number): unknown {
  if (value == null) {
    return null
  }
  if (typeof value === 'string') {
    const s = redactSensitiveText(value.trim())
    return s.length > MAX_STRING_LENGTH ? s.slice(0, MAX_STRING_LENGTH) : s
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    if (depth >= 2) {
      return null
    }
    return value.slice(0, 12).map((item) => sanitizeMetadataValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    if (depth >= 2) {
      return null
    }
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value).slice(0, MAX_METADATA_KEYS)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        continue
      }
      out[key.slice(0, 80)] = sanitizeMetadataValue(item, depth + 1)
    }
    return out
  }
  return null
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  const safe = sanitizeMetadataValue(metadata ?? {}, 0)
  return safe && typeof safe === 'object' && !Array.isArray(safe) ? (safe as Record<string, unknown>) : {}
}

function send(endpoint: string, payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') {
    return
  }
  void fetch(apiUrl(endpoint), {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      // Matches apps/server/src/index.ts CSRF guard expectation.
      'X-Requested-With': 'streamassist-fetch',
    },
    body: JSON.stringify({ ...payload, sessionId: sessionId() }),
  }).catch(() => {
    // Analytics must never affect the app flow.
  })
}

/**
 * Small named-export wrappers around private helpers so the diagnostics
 * module (`@/diagnostics`) can reuse the same `sessionId`, redaction,
 * and metadata-sanitization logic without duplicating implementations.
 * The wrappers exist purely as a stable export surface — they don't
 * alter behaviour and they don't change anything for existing
 * `trackClientEvent` / `trackClientError` callers.
 */
export function getAnalyticsSessionId(): string | null {
  return sessionId()
}

export function redactSensitiveDiagnosticsText(value: string): string {
  return redactSensitiveText(value)
}

export function sanitizeDiagnosticsMetadata(
  input: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return sanitizeMetadata(input)
}

export function trackClientEvent(event: string, metadata?: Record<string, unknown>, path = currentPath()): void {
  const now = Date.now()
  const key = `${event}:${path}`
  if (now - (lastSentAt.get(key) ?? 0) < SEND_DEBOUNCE_MS) {
    return
  }
  
  
  
  if (lastSentAt.has(key)) {
    lastSentAt.delete(key)
  } else if (lastSentAt.size >= MAX_DEBOUNCE_KEYS) {
    const oldest = lastSentAt.keys().next()
    if (!oldest.done) {
      lastSentAt.delete(oldest.value)
    }
  }
  lastSentAt.set(key, now)
  send(EVENT_ENDPOINT, {
    event,
    path,
    metadata: sanitizeMetadata(metadata),
  })
}

function errorDetails(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: redactSensitiveText(error.message || error.name || 'Client error'),
      stack: error.stack ? redactSensitiveText(error.stack) : undefined,
    }
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = typeof error.message === 'string' ? redactSensitiveText(error.message) : 'Client error'
    const stack = 'stack' in error && typeof error.stack === 'string' ? redactSensitiveText(error.stack) : undefined
    return { message, stack }
  }
  return { message: redactSensitiveText(String(error ?? 'Client error')) }
}

export function trackClientError(
  error: unknown,
  metadata?: Record<string, unknown>,
  source = 'client',
  path = currentPath(),
): void {
  const detail = errorDetails(error)
  send(ERROR_ENDPOINT, {
    message: detail.message,
    stack: detail.stack,
    path,
    source,
    metadata: sanitizeMetadata(metadata),
  })
}

function routeName(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

export function initClientAnalytics(router: Router): void {
  if (initialized || typeof window === 'undefined') {
    return
  }
  initialized = true

  window.addEventListener('error', (event) => {
    trackClientError(event.error ?? event.message, { filename: event.filename, lineno: event.lineno }, 'window.error')
    // Best-effort fanout to diagnostics; never throws.
    try {
      emitDiagnosticEvent({
        level: 'error',
        area: 'ui',
        type: 'uncaught_client_error',
        message: typeof event.message === 'string' && event.message.length > 0
          ? event.message
          : 'window.error',
        context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
        error: event.error ?? event.message,
      })
    } catch {
      // diagnostics fanout must not affect analytics path
    }
  })
  window.addEventListener('unhandledrejection', (event) => {
    trackClientError(event.reason, {}, 'unhandledrejection')
    try {
      emitDiagnosticEvent({
        level: 'error',
        area: 'ui',
        type: 'unhandled_promise_rejection',
        message: event.reason instanceof Error
          ? `${event.reason.name}: ${event.reason.message || ''}`.trim()
          : 'unhandledrejection',
        error: event.reason,
      })
    } catch {
      // ignore
    }
  })

  router.afterEach((to, from) => {
    // Update diagnostics context BEFORE the route_change event so that
    // any synchronous error during the transition is correlated to the
    // destination room/session, not the previous one.
    applyDiagnosticsContextForRoute(to)
    trackClientEvent('route_change', { routeName: routeName(to.name), from: from.path }, to.path)
    const game = GAME_ROUTE_NAMES.get(routeName(to.name))
    if (game) {
      trackClientEvent('game_opened', { game, routeName: routeName(to.name) }, to.path)
    }
  })

  // The initial route is already resolved when initClientAnalytics is
  // called from main.ts (router is in `'ready'` state at app mount),
  // so afterEach will not fire for the landing URL. Apply context
  // explicitly so global errors that fire BEFORE the first navigation
  // are still attributed to the landing route.
  try {
    applyDiagnosticsContextForRoute(router.currentRoute.value)
  } catch {
    // ignore
  }
}
