import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { adminGetJson } from '@/admin/api/adminApi'
import {
  adminDatabaseConfiguredFromPayload,
  interpretAdminGetJson,
  streamerDeleteOutcome,
  streamerPostOutcome,
} from '@/admin/state/adminStatePure'
import { apiFetch } from '@/utils/apiFetch'

/**
 * Streamers-room GETs: `apiFetch` + `r.json()` on any non-403 (same as previous inline code).
 * On 403, returns `forbidden` so callers can `throw new Error('forbidden')` like before.
 */
async function fetchLooseAdminJson<T>(path: string): Promise<{ tag: 'forbidden' } | { tag: 'ok'; data: T }> {
  const r = await apiFetch(path)
  if (r.status === 403) {
    return { tag: 'forbidden' }
  }
  return { tag: 'ok', data: (await r.json()) as T }
}

/** Users table row — same fields as `/api/admin/users` mapping in AdminUsers. */
export type AdminUserRow = {
  id: string
  displayName: string
  avatar?: string
  provider: string
  role: 'admin' | 'user'
  wins: number
  gamesPlayed: number
}

export function useAdminUsersState(): {
  users: Ref<AdminUserRow[]>
  loading: Ref<boolean>
  errorKey: Ref<'load' | 'forbidden' | null>
  databaseConfigured: Ref<boolean>
  lastUpdated: Ref<Date | null>
  load: () => Promise<void>
} {
  const users = ref<AdminUserRow[]>([])
  const loading = ref(true)
  const errorKey = ref<'load' | 'forbidden' | null>(null)
  const databaseConfigured = ref(true)
  const lastUpdated = ref<Date | null>(null)

  async function load(): Promise<void> {
    loading.value = true
    errorKey.value = null
    try {
      const res = await adminGetJson<{ databaseConfigured?: boolean; users?: AdminUserRow[] }>('/api/admin/users')
      const out = interpretAdminGetJson(res)
      if (out.tag === 'forbidden') {
        errorKey.value = 'forbidden'
        users.value = []
        return
      }
      if (out.tag === 'bad') {
        errorKey.value = 'load'
        users.value = []
        return
      }
      const j = out.data
      databaseConfigured.value = adminDatabaseConfiguredFromPayload(j)
      users.value = Array.isArray(j.users) ? j.users : []
      lastUpdated.value = new Date()
    } catch {
      errorKey.value = 'load'
      users.value = []
    } finally {
      loading.value = false
    }
  }

  return { users, loading, errorKey, databaseConfigured, lastUpdated, load }
}

export type AdminStatsPayload = {
  databaseConfigured?: boolean
  userCount?: number
  wordleRounds?: number
  totalWinsRecorded?: number
  totalGamesPlayed?: number
  topWins?: { userId: string; displayName: string; wins: number }[]
  topRating?: { userId: string; displayName: string; rating: number; wins: number; losses: number }[]
}

export function useAdminStatsState(): {
  data: Ref<AdminStatsPayload | null>
  loading: Ref<boolean>
  errorKey: Ref<'load' | 'forbidden' | null>
  reloading: Ref<boolean>
  databaseConfigured: ComputedRef<boolean>
  load: () => Promise<void>
  reload: () => Promise<void>
} {
  const data = ref<AdminStatsPayload | null>(null)
  const loading = ref(true)
  const errorKey = ref<'load' | 'forbidden' | null>(null)
  const reloading = ref(false)

  const databaseConfigured = computed(() => adminDatabaseConfiguredFromPayload(data.value))

  async function fetchAdminStats(): Promise<void> {
    const res = await adminGetJson<AdminStatsPayload>('/api/admin/stats')
    const out = interpretAdminGetJson(res)
    if (out.tag === 'forbidden') {
      errorKey.value = 'forbidden'
      data.value = null
      return
    }
    if (out.tag === 'bad') {
      errorKey.value = 'load'
      data.value = null
      return
    }
    errorKey.value = null
    data.value = out.data
  }

  async function load(): Promise<void> {
    loading.value = true
    errorKey.value = null
    try {
      await fetchAdminStats()
    } catch {
      errorKey.value = 'load'
      data.value = null
    } finally {
      loading.value = false
    }
  }

  async function reload(): Promise<void> {
    reloading.value = true
    errorKey.value = null
    try {
      await fetchAdminStats()
    } catch {
      errorKey.value = 'load'
      data.value = null
    } finally {
      reloading.value = false
    }
  }

  return { data, loading, errorKey, reloading, databaseConfigured, load, reload }
}

type OwnerOption = {
  id: string
  displayName: string
  twitchId?: string
}

export type AdminStreamerRow = {
  id: string
  name: string
  username: string
  twitchId: string
  isActive: boolean
  ownerId: string | null
  owner: { id: string; displayName: string; email: string | null } | null
}

export function useAdminStreamersState(): {
  streamers: Ref<AdminStreamerRow[]>
  owners: Ref<OwnerOption[]>
  loading: Ref<boolean>
  saving: Ref<boolean>
  errorKey: Ref<'load' | 'forbidden' | 'save' | null>
  databaseConfigured: Ref<boolean>
  slug: Ref<string>
  ownerId: Ref<string>
  ownersWithTwitch: ComputedRef<OwnerOption[]>
  refresh: () => Promise<void>
  createStreamer: () => Promise<void>
  removeStreamer: (id: string) => Promise<void>
} {
  const streamers = ref<AdminStreamerRow[]>([])
  const owners = ref<OwnerOption[]>([])
  const loading = ref(true)
  const saving = ref(false)
  const errorKey = ref<'load' | 'forbidden' | 'save' | null>(null)
  const databaseConfigured = ref(true)

  const slug = ref('')
  const ownerId = ref('')

  const ownersWithTwitch = computed(() => owners.value.filter((o) => Boolean(o.twitchId?.trim())))

  async function loadUsers(): Promise<void> {
    const got = await fetchLooseAdminJson<{
      databaseConfigured?: boolean
      users?: Array<{ id: string; displayName: string; twitchId?: string }>
    }>('/api/admin/users')
    if (got.tag === 'forbidden') {
      throw new Error('forbidden')
    }
    const data = got.data
    if (data.databaseConfigured === false) {
      databaseConfigured.value = false
      owners.value = []
      return
    }
    databaseConfigured.value = true
    owners.value =
      data.users?.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        twitchId: u.twitchId,
      })) ?? []
  }

  async function loadStreamers(): Promise<void> {
    const got = await fetchLooseAdminJson<{ databaseConfigured?: boolean; streamers?: AdminStreamerRow[] }>(
      '/api/admin/streamers',
    )
    if (got.tag === 'forbidden') {
      throw new Error('forbidden')
    }
    const data = got.data
    if (data.databaseConfigured === false) {
      databaseConfigured.value = false
      streamers.value = []
      return
    }
    databaseConfigured.value = true
    streamers.value = data.streamers ?? []
  }

  async function refresh(): Promise<void> {
    loading.value = true
    errorKey.value = null
    try {
      await Promise.all([loadUsers(), loadStreamers()])
    } catch {
      errorKey.value = 'load'
    } finally {
      loading.value = false
    }
  }

  async function createStreamer(): Promise<void> {
    saving.value = true
    errorKey.value = null
    try {
      const r = await apiFetch('/api/admin/streamers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: slug.value.trim(),
          ownerId: ownerId.value,
        }),
      })
      const o = streamerPostOutcome(r)
      if (o === 'forbidden') {
        errorKey.value = 'forbidden'
        return
      }
      if (o === 'save') {
        errorKey.value = 'save'
        return
      }
      slug.value = ''
      ownerId.value = ''
      await loadStreamers()
    } catch {
      errorKey.value = 'save'
    } finally {
      saving.value = false
    }
  }

  async function removeStreamer(id: string): Promise<void> {
    saving.value = true
    errorKey.value = null
    try {
      const r = await apiFetch(`/api/admin/streamers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const o = streamerDeleteOutcome(r)
      if (o === 'forbidden') {
        errorKey.value = 'forbidden'
        return
      }
      if (o === 'save') {
        errorKey.value = 'save'
        return
      }
      await loadStreamers()
    } catch {
      errorKey.value = 'save'
    } finally {
      saving.value = false
    }
  }

  return {
    streamers,
    owners,
    loading,
    saving,
    errorKey,
    databaseConfigured,
    slug,
    ownerId,
    ownersWithTwitch,
    refresh,
    createStreamer,
    removeStreamer,
  }
}
