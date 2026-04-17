import { computed, ref, type Ref } from 'vue'
import { apiFetch } from '@/utils/apiFetch'
import { apiBase, apiUrl } from '@/utils/apiUrl'
import { createLogger } from '@/utils/logger'
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath'

/** Global auth user (GET /api/auth/me). */
export type AppUser = {
  id: string
  displayName: string
  avatar?: string
  provider: 'twitch' | 'google' | 'apple' | 'email' | null
  role: 'admin' | 'user'
  /** Helix user id when provider is Twitch (same as `id`). */
  twitchId?: string
  /** Linked Wordle streamer row (owner or same Twitch channel). */
  wordleStreamerId?: string
  wordleStreamerName?: string
}

const authLog = createLogger('auth')

const user: Ref<AppUser | null> = ref(null)
const loaded = ref(false)
let inflight: Promise<void> | null = null

/** Display-only cache (no tokens). Speeds up first paint after reload; always revalidated over the network. */
const DISPLAY_CACHE_KEY = 'streamassist_auth_display_v1'
const DISPLAY_CACHE_TTL_MS = 5 * 60 * 1000
/** Dev-only: log Twitch numeric id once per tab session (cleared on logout). */
const DEV_TWITCH_ID_LOG_KEY = 'streamassist_dev_twitch_id_logged'

function readDisplayCache(): AppUser | null {
  if (typeof sessionStorage === 'undefined') {
    return null
  }
  try {
    const raw = sessionStorage.getItem(DISPLAY_CACHE_KEY)
    if (!raw) {
      return null
    }
    const o = JSON.parse(raw) as { t?: number; user?: unknown }
    if (typeof o.t !== 'number' || Date.now() - o.t > DISPLAY_CACHE_TTL_MS) {
      sessionStorage.removeItem(DISPLAY_CACHE_KEY)
      return null
    }
    return parseUser(o.user)
  } catch {
    try {
      sessionStorage.removeItem(DISPLAY_CACHE_KEY)
    } catch {
      /* ignore */
    }
    return null
  }
}

function writeDisplayCache(u: AppUser | null): void {
  if (typeof sessionStorage === 'undefined') {
    return
  }
  try {
    if (!u) {
      sessionStorage.removeItem(DISPLAY_CACHE_KEY)
      return
    }
    sessionStorage.setItem(DISPLAY_CACHE_KEY, JSON.stringify({ t: Date.now(), user: u }))
  } catch {
    /* ignore quota / private mode */
  }
}

function parseUser(raw: unknown): AppUser | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const u = raw as Record<string, unknown>
  const id = typeof u.id === 'string' ? u.id : null
  const displayName =
    typeof u.displayName === 'string'
      ? u.displayName
      : typeof u.display_name === 'string'
        ? u.display_name
        : null
  if (!id || !displayName) {
    return null
  }
  let avatar: string | undefined
  if (typeof u.avatar === 'string' && u.avatar.trim().length > 0) {
    avatar = u.avatar.trim()
  } else if (typeof u.profile_image_url === 'string' && u.profile_image_url.trim().length > 0) {
    avatar = u.profile_image_url.trim()
  }
  const p = u.provider
  const provider =
    p === 'twitch' || p === 'google' || p === 'apple' || p === 'email' ? p : null
  const roleRaw = u.role
  const role = roleRaw === 'admin' || roleRaw === 'user' ? roleRaw : 'user'
  let twitchId: string | undefined
  if (typeof u.twitchId === 'string' && u.twitchId.length > 0) {
    twitchId = u.twitchId
  } else if (provider === 'twitch' && id.length > 0) {
    twitchId = id
  }
  let wordleStreamerId: string | undefined
  if (typeof u.wordleStreamerId === 'string' && u.wordleStreamerId.length > 0) {
    wordleStreamerId = u.wordleStreamerId
  }
  let wordleStreamerName: string | undefined
  if (typeof u.wordleStreamerName === 'string' && u.wordleStreamerName.length > 0) {
    wordleStreamerName = u.wordleStreamerName
  }
  return {
    id,
    displayName,
    ...(avatar ? { avatar } : {}),
    provider,
    role,
    ...(twitchId ? { twitchId } : {}),
    ...(wordleStreamerId ? { wordleStreamerId } : {}),
    ...(wordleStreamerName ? { wordleStreamerName } : {}),
  }
}

export type RefreshAuthOptions = {
  /** Skip reading display cache before fetch (e.g. after explicit logout elsewhere). */
  force?: boolean
}

async function refresh(options?: RefreshAuthOptions): Promise<void> {
  if (!options?.force) {
    const cached = readDisplayCache()
    if (cached) {
      user.value = cached
    }
  } else {
    writeDisplayCache(null)
  }

  try {
    const r = await apiFetch('/api/auth/me')
    if (r.status === 401) {
      user.value = null
      writeDisplayCache(null)
      return
    }
    const j = (await r.json()) as { authenticated?: boolean; user?: unknown }
    if (j.authenticated && j.user) {
      const next = parseUser(j.user)
      user.value = next
      writeDisplayCache(next)
      if (import.meta.env.DEV && next?.provider === 'twitch') {
        try {
          const prev = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(DEV_TWITCH_ID_LOG_KEY) : null
          if (prev !== next.id) {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem(DEV_TWITCH_ID_LOG_KEY, next.id)
            }
            authLog.info(
              '[StreamAssist dev] Twitch user id (додай у ADMIN_TWITCH_IDS у apps/server/.env):',
              next.id,
            )
          }
        } catch {
          /* private mode */
        }
      }
    } else {
      user.value = null
      writeDisplayCache(null)
    }
  } catch {
    user.value = null
    writeDisplayCache(null)
  } finally {
    loaded.value = true
  }
}

export function ensureAuthLoaded(): Promise<void> {
  if (loaded.value) {
    return Promise.resolve()
  }
  if (!inflight) {
    inflight = refresh().finally(() => {
      inflight = null
    })
  }
  return inflight
}

function logOAuthTargetWhenDevApiAmbiguous(target: string): void {
  if (import.meta.env.DEV && !apiBase()) {
    authLog.info('OAuth →', target, '(set VITE_API_URL in prod when API is not same-origin)')
  }
}

export function useAuth() {
  const isAuthenticated = computed(() => Boolean(user.value))
  const isAdmin = computed(() => user.value?.role === 'admin')

  function loginWithTwitch(redirectPath?: string): void {
    const q = encodeURIComponent(safeOAuthRedirectPath(redirectPath))
    const target = apiUrl(`/api/auth/twitch?redirect=${q}`)
    logOAuthTargetWhenDevApiAmbiguous(target)
    window.location.assign(target)
  }

  /** Full browser navigation; session is httpOnly cookie only (no localStorage tokens). */
  function loginWithGoogle(redirectPath?: string): void {
    const q = encodeURIComponent(safeOAuthRedirectPath(redirectPath))
    const target = apiUrl(`/api/auth/google?redirect=${q}`)
    logOAuthTargetWhenDevApiAmbiguous(target)
    window.location.assign(target)
  }

  async function logout(options?: { navigateHome?: boolean }): Promise<void> {
    try {
      const r = await apiFetch('/api/auth/logout', { method: 'POST' })
      authLog.debug('logout', r.status)
    } catch (e) {
      authLog.warn('logout request failed', e)
    }
    user.value = null
    loaded.value = false
    writeDisplayCache(null)
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(DEV_TWITCH_ID_LOG_KEY)
      }
    } catch {
      /* ignore */
    }
    if (options?.navigateHome !== false) {
      const { router } = await import('@/router')
      await router.push({ path: '/' })
    }
  }

  /** Cached user from the last GET /api/auth/me (via `refresh` / `ensureAuthLoaded`). */
  function getCurrentUser(): AppUser | null {
    return user.value
  }

  /**
   * Email + password: try register, then login if email already exists (single UX flow).
   * Sets httpOnly session cookie on success; call refresh() after to update client state.
   */
  async function loginOrRegisterWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<
    | { ok: true; outcome: 'registered' | 'logged_in'; user: AppUser }
    | { ok: false; error: 'validation' | 'wrong_password' | 'server' }
  > {
    const body = {
      email: email.trim(),
      password,
      ...(displayName != null && displayName.trim().length > 0 ? { displayName: displayName.trim() } : {}),
    }
    const reg = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (reg.ok) {
      const j = (await reg.json()) as { user?: unknown }
      const u = parseUser(j.user)
      if (!u) {
        return { ok: false, error: 'server' }
      }
      return { ok: true, outcome: 'registered', user: u }
    }
    if (reg.status === 409) {
      const loginRes = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: body.email, password: body.password }),
      })
      if (loginRes.ok) {
        const j = (await loginRes.json()) as { user?: unknown }
        const u = parseUser(j.user)
        if (!u) {
          return { ok: false, error: 'server' }
        }
        return { ok: true, outcome: 'logged_in', user: u }
      }
      if (loginRes.status === 401) {
        return { ok: false, error: 'wrong_password' }
      }
      return { ok: false, error: 'server' }
    }
    if (reg.status === 400) {
      return { ok: false, error: 'validation' }
    }
    return { ok: false, error: 'server' }
  }

  return {
    user,
    loaded,
    isAuthenticated,
    isAdmin,
    refresh,
    ensureAuthLoaded,
    loginWithTwitch,
    loginWithGoogle,
    loginOrRegisterWithEmail,
    logout,
    getCurrentUser,
  }
}
