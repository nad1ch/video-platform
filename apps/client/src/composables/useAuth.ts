import { computed, ref, type Ref } from 'vue'
import { apiFetch } from '@/utils/apiFetch'
import { apiBase, apiUrl } from '@/utils/apiUrl'
import { createLogger } from '@/utils/logger'
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath'
import { readStorageJson, writeStorageJson } from '@/utils/storageJson.js'


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
  
  dbUserId?: string
  displayName: string
  avatar?: string
  provider: 'twitch' | 'google' | 'apple' | 'email' | null
  email?: string
  emailVerified?: boolean
  emailVerifiedAt?: string | null
  role: 'admin' | 'user'
  
  roles?: AppSystemRole[]
  
  permissions?: AppFeaturePermission[]
  
  twitchId?: string
  
  streamer?: AppStreamerContext
  
  nadleStreamerId?: string
  nadleStreamerName?: string
}

const authLog = createLogger('auth')

const user: Ref<AppUser | null> = ref(null)
const loaded = ref(false)
let inflight: Promise<void> | null = null


/** Bump when `AppUser` shape changes (e.g. `dbUserId`) so stale sessionStorage entries re-fetch. */
const DISPLAY_CACHE_KEY = 'streamassist_auth_display_v5'
const DISPLAY_CACHE_TTL_MS = 5 * 60 * 1000

const DEV_TWITCH_ID_LOG_KEY = 'streamassist_dev_twitch_id_logged'

/**
 * Audit #45: read / write the auth display cache through the shared
 * `readStorageJson` / `writeStorageJson` helpers instead of touching
 * `sessionStorage` directly. The helpers already swallow parse / quota /
 * private-mode failures and short-circuit on missing storage, so this
 * collapses the previous custom try/catch ladders and matches the
 * pattern used by `CallPage.vue`, `useNadleState.ts`, and other
 * client features.
 */
const storageOrNull: Storage | null = typeof sessionStorage !== 'undefined' ? sessionStorage : null

function readDisplayCache(): AppUser | null {
  if (!storageOrNull) return null
  const o = readStorageJson(storageOrNull, DISPLAY_CACHE_KEY, null) as
    | { t?: number; user?: unknown }
    | null
  if (!o || typeof o.t !== 'number' || Date.now() - o.t > DISPLAY_CACHE_TTL_MS) {
    if (o) {
      try {
        storageOrNull.removeItem(DISPLAY_CACHE_KEY)
      } catch {
        /* ignore */
      }
    }
    return null
  }
  return parseUser(o.user)
}

function writeDisplayCache(u: AppUser | null): void {
  if (!storageOrNull) return
  if (!u) {
    try {
      storageOrNull.removeItem(DISPLAY_CACHE_KEY)
    } catch {
      /* ignore */
    }
    return
  }
  writeStorageJson(storageOrNull, DISPLAY_CACHE_KEY, { t: Date.now(), user: u })
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
  
  force?: boolean
}

/**
 * Shared inflight promise for `refresh()`. Multiple callers (App mount,
 * route guards, post-login UI, background pollers) previously each fired
 * their own `/api/auth/me` request; now they converge on a single network
 * hop per overlapping call batch.
 *
 * A `force: true` call still dedupes within the same inflight window —
 * the first caller's cache-clear already happened, so subsequent forces
 * waiting on the same promise see the same fresh result.
 */
let refreshInflight: Promise<void> | null = null

async function refreshOnce(options?: RefreshAuthOptions): Promise<void> {
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
    
    
    
    // backend error must not falsely flip the UI to "logged out".
    if (r.status === 401 || r.status === 403) {
      user.value = null
      writeDisplayCache(null)
      return
    }
    if (!r.ok) {
      
      // gates like `ensureAuthLoaded()` do not hang.
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
    // Network failure / CORS / aborted fetch. Do NOT clear the user —
    // the previous session may still be valid; a later refresh will
    // reconcile. Only mark loaded so the initial-load guard releases.
  } finally {
    loaded.value = true
  }
}

async function refresh(options?: RefreshAuthOptions): Promise<void> {
  if (refreshInflight) {
    return refreshInflight
  }
  refreshInflight = refreshOnce(options).finally(() => {
    refreshInflight = null
  })
  return refreshInflight
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

/**
 * Reset every store and module-singleton that holds per-user state.
 *
 * Triggered from `logout()` so the next user logging in on the same browser
 * does not inherit the previous user's coin balance, mafia roles, Pro flag,
 * or already-seen billing event ids.
 *
 * Each reset is independently try/catched: if one store's reset throws (e.g.
 * Pinia is not active in a test harness), we still clear the others. Dynamic
 * imports avoid pulling these heavy modules at auth module load time and
 * sidestep import cycles.
 */
async function resetUserScopedState(): Promise<void> {
  try {
    const [{ useCoinHubStore }, pinia] = await Promise.all([
      import('@/stores/coinHub'),
      import('pinia'),
    ])
    if (pinia.getActivePinia()) {
      useCoinHubStore().reset()
    }
  } catch (e) {
    authLog.warn('reset coinHub store failed', e)
  }
  try {
    const [{ useMafiaGameStore }, pinia] = await Promise.all([
      import('@/stores/mafiaGame'),
      import('pinia'),
    ])
    if (pinia.getActivePinia()) {
      useMafiaGameStore().fullReset()
    }
  } catch (e) {
    authLog.warn('reset mafiaGame store failed', e)
  }
  try {
    const [{ useMafiaPlayersStore }, pinia] = await Promise.all([
      import('@/stores/mafiaPlayers'),
      import('pinia'),
    ])
    if (pinia.getActivePinia()) {
      useMafiaPlayersStore().reset()
    }
  } catch (e) {
    authLog.warn('reset mafiaPlayers store failed', e)
  }
  try {
    const { resetProSubscriptionState } = await import('@/composables/useProSubscription')
    resetProSubscriptionState()
  } catch (e) {
    authLog.warn('reset pro subscription state failed', e)
  }
  try {
    const { resetBillingNotifierState } = await import('@/composables/useBillingNotifications')
    resetBillingNotifierState()
  } catch (e) {
    authLog.warn('reset billing notifier state failed', e)
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







    await resetUserScopedState()
    if (options?.navigateHome !== false) {
      const { router } = await import('@/router')
      await router.push({ path: '/' })
    }
  }

  
  function getCurrentUser(): AppUser | null {
    return user.value
  }

  



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

  async function sendEmailVerification(locale?: string): Promise<
    | { ok: true }
    | { ok: false; error: 'email_unavailable' | 'unauthenticated' | 'server' }
  > {
    const normalizedLocale = locale?.trim()
    const res = await apiFetch('/api/auth/email-verification/send', {
      method: 'POST',
      ...(normalizedLocale
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale: normalizedLocale }),
          }
        : {}),
    })
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

  async function sendPasswordReset(email: string, locale?: string): Promise<
    | { ok: true }
    | { ok: false; error: 'validation' | 'server' }
  > {
    const normalizedLocale = locale?.trim()
    const res = await apiFetch('/api/auth/password-reset/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        ...(normalizedLocale ? { locale: normalizedLocale } : {}),
      }),
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
