import { computed, ref, type Ref } from 'vue'
import { apiBase, apiUrl } from '@/utils/apiUrl'

/** Global auth user (GET /api/auth/me). */
export type AppUser = {
  id: string
  displayName: string
  avatar?: string
  provider: 'twitch' | 'google' | 'apple' | null
}

const user: Ref<AppUser | null> = ref(null)
const loaded = ref(false)
let inflight: Promise<void> | null = null

/** Display-only cache (no tokens). Speeds up first paint after reload; always revalidated over the network. */
const DISPLAY_CACHE_KEY = 'streamassist_auth_display_v1'
const DISPLAY_CACHE_TTL_MS = 5 * 60 * 1000

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
    p === 'twitch' || p === 'google' || p === 'apple' ? p : null
  return {
    id,
    displayName,
    ...(avatar ? { avatar } : {}),
    provider,
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
    const r = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
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

export function useAuth() {
  const isAuthenticated = computed(() => Boolean(user.value))

  function loginWithTwitch(redirectPath?: string): void {
    const path =
      typeof redirectPath === 'string' && redirectPath.startsWith('/') && !redirectPath.startsWith('//')
        ? redirectPath
        : '/'
    const q = encodeURIComponent(path)
    const target = apiUrl(`/api/auth/twitch?redirect=${q}`)
    if (import.meta.env.DEV && !apiBase()) {
      console.info('[auth] OAuth →', target, '(set VITE_API_URL in prod when API is not same-origin)')
    }
    window.location.assign(target)
  }

  /** Full browser navigation; session is httpOnly cookie only (no localStorage tokens). */
  function loginWithGoogle(redirectPath?: string): void {
    const path =
      typeof redirectPath === 'string' && redirectPath.startsWith('/') && !redirectPath.startsWith('//')
        ? redirectPath
        : '/'
    const q = encodeURIComponent(path)
    const target = apiUrl(`/api/auth/google?redirect=${q}`)
    if (import.meta.env.DEV && !apiBase()) {
      console.info('[auth] OAuth →', target, '(set VITE_API_URL in prod when API is not same-origin)')
    }
    window.location.href = target
  }

  async function logout(options?: { navigateHome?: boolean }): Promise<void> {
    try {
      const r = await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
      if (import.meta.env.DEV) {
        console.log('[auth] logout', r.status)
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[auth] logout request failed', e)
      }
    }
    user.value = null
    loaded.value = false
    writeDisplayCache(null)
    if (options?.navigateHome !== false) {
      const { router } = await import('@/router')
      await router.push({ path: '/' })
    }
  }

  /** Cached user from the last GET /api/auth/me (via `refresh` / `ensureAuthLoaded`). */
  function getCurrentUser(): AppUser | null {
    return user.value
  }

  return {
    user,
    loaded,
    isAuthenticated,
    refresh,
    ensureAuthLoaded,
    loginWithTwitch,
    loginWithGoogle,
    logout,
    getCurrentUser,
  }
}
