import { apiFetch, readJsonIfOk } from '@/utils/apiFetch'
import { apiUrl } from '@/utils/apiUrl'

export type WordlePublicConfigPayload = {
  ingestChannel: string | null
  chatGuessCooldownMs: number
}

export type WordlePublicConfigResult =
  | { kind: 'set'; value: WordlePublicConfigPayload }
  | { kind: 'clear' }
  | { kind: 'noop' }

/**
 * Same branching as the former inline `fetchWordlePublicConfig` in WordleStreamPage:
 * - HTTP !ok → noop (keep previous config)
 * - invalid JSON → clear
 * - invalid cooldown field → noop
 * - network throw → clear
 */
export async function requestWordlePublicConfig(streamerId: string): Promise<WordlePublicConfigResult> {
  try {
    const res = await fetch(apiUrl(`/api/wordle/public-config?streamerId=${encodeURIComponent(streamerId)}`))
    if (!res.ok) {
      return { kind: 'noop' }
    }
    const j = await readJsonIfOk<{ ingestChannel?: unknown; chatGuessCooldownMs?: unknown }>(res)
    if (!j) {
      return { kind: 'clear' }
    }
    if (typeof j.chatGuessCooldownMs !== 'number' || !Number.isFinite(j.chatGuessCooldownMs)) {
      return { kind: 'noop' }
    }
    return {
      kind: 'set',
      value: {
        ingestChannel: typeof j.ingestChannel === 'string' ? j.ingestChannel : null,
        chatGuessCooldownMs: j.chatGuessCooldownMs,
      },
    }
  } catch {
    return { kind: 'clear' }
  }
}

export async function postWordleWin(payload: {
  streamerId: string
  result: 'win' | 'lose'
  attempts: number
}): Promise<boolean> {
  const res = await apiFetch('/api/wins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.ok
}

export type WordleGlobalWinsRow = {
  rank: number
  userId: string
  displayName: string
  avatarUrl: string | null
  wins: number
}

export type WordleGlobalStreakRow = {
  rank: number
  userId: string
  displayName: string
  avatarUrl: string | null
  streak: number
}

export type WordleGlobalRatingRow = {
  rank: number
  userId: string
  displayName: string
  avatarUrl: string | null
  rating: number
  wins: number
  losses: number
}

/** Query suffix e.g. `?streamerId=…` — same shape as before (always `res.json()`). */
export async function fetchLeaderboardWins(querySuffix: string): Promise<WordleGlobalWinsRow[]> {
  const res = await apiFetch(`/api/leaderboard/wins${querySuffix}`)
  const j = (await res.json()) as { entries?: unknown }
  const list = Array.isArray(j.entries) ? j.entries : []
  return list
    .map((raw, i) => {
      const o = raw as Record<string, unknown>
      const rank = typeof o.rank === 'number' ? o.rank : i + 1
      const userId = typeof o.userId === 'string' ? o.userId : ''
      const displayName = typeof o.displayName === 'string' ? o.displayName : userId || '—'
      const avatarUrl = typeof o.avatarUrl === 'string' ? o.avatarUrl : null
      const wins = typeof o.wins === 'number' && Number.isFinite(o.wins) ? o.wins : 0
      return { rank, userId, displayName, avatarUrl, wins }
    })
    .filter((r) => r.userId.length > 0)
}

export async function fetchLeaderboardStreak(querySuffix: string): Promise<WordleGlobalStreakRow[]> {
  const res = await apiFetch(`/api/leaderboard/streak${querySuffix}`)
  const j = (await res.json()) as { entries?: unknown }
  const list = Array.isArray(j.entries) ? j.entries : []
  return list
    .map((raw, i) => {
      const o = raw as Record<string, unknown>
      const rank = typeof o.rank === 'number' ? o.rank : i + 1
      const userId = typeof o.userId === 'string' ? o.userId : ''
      const displayName = typeof o.displayName === 'string' ? o.displayName : userId || '—'
      const avatarUrl = typeof o.avatarUrl === 'string' ? o.avatarUrl : null
      const streak = typeof o.streak === 'number' && Number.isFinite(o.streak) ? o.streak : 0
      return { rank, userId, displayName, avatarUrl, streak }
    })
    .filter((r) => r.userId.length > 0)
}

export async function fetchLeaderboardRating(querySuffix: string): Promise<WordleGlobalRatingRow[]> {
  const res = await apiFetch(`/api/leaderboard/rating${querySuffix}`)
  const j = (await res.json()) as { entries?: unknown }
  const list = Array.isArray(j.entries) ? j.entries : []
  return list
    .map((raw, i) => {
      const o = raw as Record<string, unknown>
      const rank = typeof o.rank === 'number' ? o.rank : i + 1
      const userId = typeof o.userId === 'string' ? o.userId : ''
      const displayName = typeof o.displayName === 'string' ? o.displayName : userId || '—'
      const avatarUrl = typeof o.avatarUrl === 'string' ? o.avatarUrl : null
      const rating = typeof o.rating === 'number' && Number.isFinite(o.rating) ? o.rating : 0
      const wins = typeof o.wins === 'number' && Number.isFinite(o.wins) ? o.wins : 0
      const losses = typeof o.losses === 'number' && Number.isFinite(o.losses) ? o.losses : 0
      return { rank, userId, displayName, avatarUrl, rating, wins, losses }
    })
    .filter((r) => r.userId.length > 0)
}
