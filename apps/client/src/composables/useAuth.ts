import { computed, ref, type Ref } from 'vue'
import { apiFetch } from '@/utils/apiFetch'
import { apiBase, apiUrl } from '@/utils/apiUrl'
import { createLogger } from '@/utils/logger'
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath'

/** Global auth user (GET /api/auth/me). */
export type AppSystemRole = 'USER' | 'ADMIN' | 'STREAMER'
export type AppFeaturePermission = 'EAT_FIRST_OPERATOR'

export type AppStreamerContext = {
  id: string
  twitchId: string
  username: string
  displayName: string | null
  profileImageUrl: string | null
  broadcasterType: string | null
  followersCount: number | null
  currentOnline: number | null
  avgOnline7d: number | null
  isLive: boolean
  tier: string | null
}

export type AppUser = {
  id: string
  /** Prisma `User.id` when linked; leaderboard `userId` for wins/rating matches this. */
  dbUserId?: string
  displayName: string
  avatar?: string
  provider: 'twitch' | 'google' | 'apple' | 'email' | null
  email?: string
  emailVerified?: boolean
  emailVerifiedAt?: string | null
  role: 'admin' | 'user'
  /** Backend-authoritative system roles from GET /api/auth/me. */
  roles?: AppSystemRole[]
  /** Backend-authoritative feature permissions from GET /api/auth/me. */
  permissions?: AppFeaturePermission[]
  /** Helix user id when provider is Twitch (same as `id`). */
  twitchId?: string
  /** Backend-authoritative streamer context when this user owns a Streamer row. */
  streamer?: AppStreamerContext
  /** Linked Nadle streamer row (owner or same Twitch channel). */
  nadleStreamerId?: string
  nadleStreamerName?: string
}

const authLog = createLogger('auth')

const user: Ref<AppUser | null> = ref(null)
const loaded = ref(false)
let inflight: Promise<void> | null = null

/** Display-only cache (no tokens). Speeds up first paint after reload; always revalidated over the network. */
/** Bump when `AppUser` shape changes (e.g. `dbUserId`) so stale sessionStorage entries re-fetch. */
const DISPLAY_CACHE_KEY = 'streamassist_auth_display_v5'
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

function parseSystemRoles(raw: unknown): AppSystemRole[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined
  }
  const roles = raw.filter(
    (role): role is AppSystemRole =>
      role === 'USER' || role === 'ADMIN' || role === 'STREAMER',
  )
  return roles.length > 0 ? roles : undefined
}

function parseFeaturePermissions(raw: unknown): AppFeaturePermission[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined
  }
  const permissions = raw.filter(
    (permission): permission is AppFeaturePermission => permission === 'EAT_FIRST_OPERATOR',
  )
  return permissions.length > 0 ? permissions : undefined
}

function nullableString(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

function nullableNumber(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

function parseStreamerContext(raw: unknown): AppStreamerContext | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined
  }
  const s = raw as Record<string, unknown>
  const id = typeof s.id === 'string' && s.id.length > 0 ? s.id : null
  const twitchId = typeof s.twitchId === 'string' && s.twitchId.length > 0 ? s.twitchId : null
  const username = typeof s.username === 'string' && s.username.length > 0 ? s.username : null
  if (!id || !twitchId || !username) {
    return undefined
  }
  return {
    id,
    twitchId,
    username,
    displayName: nullableString(s.displayName),
    profileImageUrl: nullableString(s.profileImageUrl),
    broadcasterType: nullableString(s.broadcasterType),
    followersCount: nullableNumber(s.followersCount),
    currentOnline: nullableNumber(s.currentOnline),
    avgOnline7d: nullableNumber(s.avgOnline7d),
    isLive: s.isLive === true,
    tier: nullableString(s.tier),
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
  const role = roleRaw === 'admin' ? 'admin' : 'user'
  const email = typeof u.email === 'string' && u.email.trim().length > 0 ? u.email.trim() : undefined
  const emailVerified = typeof u.emailVerified === 'boolean' ? u.emailVerified : undefined
  const emailVerifiedAt =
    typeof u.emailVerifiedAt === 'string' && u.emailVerifiedAt.length > 0 ? u.emailVerifiedAt : null
  const roles = parseSystemRoles(u.roles)
  const permissions = parseFeaturePermissions(u.permissions)
  const streamer = parseStreamerContext(u.streamer)
  let twitchId: string | undefined
  if (typeof u.twitchId === 'string' && u.twitchId.length > 0) {
    twitchId = u.twitchId
  } else if (provider === 'twitch' && id.length > 0) {
    twitchId = id
  }
  let nadleStreamerId: string | undefined
  if (typeof u.nadleStreamerId === 'string' && u.nadleStreamerId.length > 0) {
    nadleStreamerId = u.nadleStreamerId
  }
  let nadleStreamerName: string | undefined
  if (typeof u.nadleStreamerName === 'string' && u.nadleStreamerName.length > 0) {
    nadleStreamerName = u.nadleStreamerName
  }
  let dbUserId: string | undefined
  if (typeof u.dbUserId === 'string' && u.dbUserId.length > 0) {
    dbUserId = u.dbUserId
  }
  return {
    id,
    ...(dbUserId ? { dbUserId } : {}),
    displayName,
    ...(avatar ? { avatar } : {}),
    provider,
    ...(email ? { email } : {}),
    ...(typeof emailVerified === 'boolean' ? { emailVerified } : {}),
    ...(emailVerifiedAt ? { emailVerifiedAt } : {}),
    role,
    ...(roles ? { roles } : {}),
    ...(permissions ? { permissions } : {}),
    ...(twitchId ? { twitchId } : {}),
    ...(streamer ? { streamer } : {}),
    ...(nadleStreamerId ? { nadleStreamerId } : {}),
    ...(nadleStreamerName ? { nadleStreamerName } : {}),
  }
}

async function readErrorCode(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : ''
  } catch {
    return ''
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
  const isStreamer = computed(() => user.value?.roles?.includes('STREAMER') === true)
  const canEatFirstHost = computed(() => {
    return user.value?.role === 'admin' || user.value?.permissions?.includes('EAT_FIRST_OPERATOR') === true
  })

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
    | { ok: false; error: 'validation' | 'wrong_password' | 'account_link_required' | 'server' }
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
      const errorCode = await readErrorCode(reg)
      if (errorCode === 'ACCOUNT_LINK_REQUIRED') {
        return { ok: false, error: 'account_link_required' }
      }
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
      if (loginRes.status === 409 && (await readErrorCode(loginRes)) === 'ACCOUNT_LINK_REQUIRED') {
        return { ok: false, error: 'account_link_required' }
      }
      return { ok: false, error: 'server' }
    }
    if (reg.status === 400) {
      return { ok: false, error: 'validation' }
    }
    return { ok: false, error: 'server' }
  }

  /** POST /api/auth/login only — for dedicated login tab. */
  async function loginWithEmail(
    email: string,
    password: string,
  ): Promise<
    | { ok: true; user: AppUser }
    | { ok: false; error: 'validation' | 'invalid_credentials' | 'account_link_required' | 'server' }
  > {
    const loginRes = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    })
    if (loginRes.ok) {
      const j = (await loginRes.json()) as { user?: unknown }
      const u = parseUser(j.user)
      if (!u) {
        return { ok: false, error: 'server' }
      }
      return { ok: true, user: u }
    }
    if (loginRes.status === 401) {
      return { ok: false, error: 'invalid_credentials' }
    }
    if (loginRes.status === 400) {
      return { ok: false, error: 'validation' }
    }
    if (loginRes.status === 409 && (await readErrorCode(loginRes)) === 'ACCOUNT_LINK_REQUIRED') {
      return { ok: false, error: 'account_link_required' }
    }
    return { ok: false, error: 'server' }
  }

  /** POST /api/auth/register only — for dedicated signup tab (no auto-login fallback). */
  async function registerWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<
    | { ok: true; user: AppUser }
    | { ok: false; error: 'validation' | 'email_taken' | 'account_link_required' | 'server' }
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
      return { ok: true, user: u }
    }
    if (reg.status === 409) {
      if ((await readErrorCode(reg)) === 'ACCOUNT_LINK_REQUIRED') {
        return { ok: false, error: 'account_link_required' }
      }
      return { ok: false, error: 'email_taken' }
    }
    if (reg.status === 400) {
      return { ok: false, error: 'validation' }
    }
    return { ok: false, error: 'server' }
  }

  async function sendEmailVerification(): Promise<
    | { ok: true }
    | { ok: false; error: 'email_unavailable' | 'unauthenticated' | 'server' }
  > {
    const res = await apiFetch('/api/auth/email-verification/send', { method: 'POST' })
    if (res.ok) {
      return { ok: true }
    }
    if (res.status === 401) {
      return { ok: false, error: 'unauthenticated' }
    }
    if (res.status === 400) {
      return { ok: false, error: 'email_unavailable' }
    }
    return { ok: false, error: 'server' }
  }

  async function sendPasswordReset(email: string): Promise<
    | { ok: true }
    | { ok: false; error: 'validation' | 'server' }
  > {
    const res = await apiFetch('/api/auth/password-reset/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    if (res.ok) {
      return { ok: true }
    }
    if (res.status === 400) {
      return { ok: false, error: 'validation' }
    }
    return { ok: false, error: 'server' }
  }

  async function confirmPasswordReset(token: string, password: string): Promise<
    | { ok: true }
    | { ok: false; error: 'validation' | 'invalid_or_expired' | 'server' }
  > {
    const res = await apiFetch('/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    if (res.ok) {
      return { ok: true }
    }
    if (res.status === 400) {
      const code = await readErrorCode(res)
      return { ok: false, error: code === 'INVALID_OR_EXPIRED' ? 'invalid_or_expired' : 'validation' }
    }
    return { ok: false, error: 'server' }
  }

  return {
    user,
    loaded,
    isAuthenticated,
    isAdmin,
    isStreamer,
    canEatFirstHost,
    refresh,
    ensureAuthLoaded,
    loginWithTwitch,
    loginWithGoogle,
    loginOrRegisterWithEmail,
    loginWithEmail,
    registerWithEmail,
    sendEmailVerification,
    sendPasswordReset,
    confirmPasswordReset,
    logout,
    getCurrentUser,
  }
}
