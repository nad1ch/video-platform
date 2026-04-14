import { computed, ref, type Ref } from 'vue'

/** Same-origin `/api` in dev; set `VITE_API_URL` when the SPA is on a different host than the API. */
function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim().replace(/\/$/, '')
  }
  return ''
}

function apiUrl(path: string): string {
  const base = apiBase()
  return base ? `${base}${path}` : path
}

export type AppUser = {
  id: string
  display_name: string
  profile_image_url: string
  provider: 'twitch' | 'google' | 'apple' | null
}

const user: Ref<AppUser | null> = ref(null)
const loaded = ref(false)
let inflight: Promise<void> | null = null

function parseUser(raw: unknown): AppUser | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const u = raw as Record<string, unknown>
  if (typeof u.id !== 'string' || typeof u.display_name !== 'string' || typeof u.profile_image_url !== 'string') {
    return null
  }
  const p = u.provider
  const provider =
    p === 'twitch' || p === 'google' || p === 'apple' ? p : null
  return {
    id: u.id,
    display_name: u.display_name,
    profile_image_url: u.profile_image_url,
    provider,
  }
}

async function refresh(): Promise<void> {
  try {
    const r = await fetch('/api/me', { credentials: 'include' })
    if (r.status === 401) {
      user.value = null
      return
    }
    const j = (await r.json()) as { authenticated?: boolean; user?: unknown }
    if (j.authenticated && j.user) {
      user.value = parseUser(j.user)
    } else {
      user.value = null
    }
  } catch {
    user.value = null
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
    window.location.assign(apiUrl(`/api/auth/twitch?redirect=${q}`))
  }

  function loginWithGoogle(redirectPath?: string): void {
    const path =
      typeof redirectPath === 'string' && redirectPath.startsWith('/') && !redirectPath.startsWith('//')
        ? redirectPath
        : '/'
    const q = encodeURIComponent(path)
    window.location.assign(apiUrl(`/api/auth/google?redirect=${q}`))
  }

  async function logout(): Promise<void> {
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
    } catch {
      /* ignore */
    }
    user.value = null
  }

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
