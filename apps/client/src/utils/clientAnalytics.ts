import type { Router } from 'vue-router'
import { apiUrl } from '@/utils/apiUrl'

const EVENT_ENDPOINT = '/api/events/client'
const ERROR_ENDPOINT = '/api/events/error'
const SESSION_KEY = 'streamassist.analyticsSessionId'
const MAX_METADATA_KEYS = 24
const MAX_STRING_LENGTH = 240
const SEND_DEBOUNCE_MS = 750
const SENSITIVE_KEY_RE = /(token|cookie|password|passwd|secret|authorization|authheader|auth_header|credential|private|message)/i

const GAME_ROUTE_NAMES = new Map<string, string>([
  ['nadle-streamer', 'nadle'],
  ['app-streamer', 'nadle'],
  ['nadraw-show', 'nadraw-show'],
  ['checkers', 'checkers'],
  ['eat', 'eat-first'],
  ['mafia', 'mafia'],
])

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, sessionId: sessionId() }),
  }).catch(() => {
    // Analytics must never affect the app flow.
  })
}

export function trackClientEvent(event: string, metadata?: Record<string, unknown>, path = currentPath()): void {
  const now = Date.now()
  const key = `${event}:${path}`
  if (now - (lastSentAt.get(key) ?? 0) < SEND_DEBOUNCE_MS) {
    return
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
  })
  window.addEventListener('unhandledrejection', (event) => {
    trackClientError(event.reason, {}, 'unhandledrejection')
  })

  router.afterEach((to, from) => {
    trackClientEvent('route_change', { routeName: routeName(to.name), from: from.path }, to.path)
    const game = GAME_ROUTE_NAMES.get(routeName(to.name))
    if (game) {
      trackClientEvent('game_opened', { game, routeName: routeName(to.name) }, to.path)
    }
  })
}
