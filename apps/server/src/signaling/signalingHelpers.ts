/**
 * Pure signaling helpers shared by `messageHandlers.ts`. None of these
 * functions perform I/O, broadcasts, or touch `Peer`/`Room`/`Producer`
 * state — they sanitize inbound primitive payload fields or classify
 * room ids by namespace. Extracted so `messageHandlers.ts` is easier to
 * navigate without introducing any behavior change.
 */

export const MAFIA_ROOM_PREFIX = 'mafia:'

/**
 * Mafia-only behavior (host auto-assign, host/queue/timer state snapshots,
 * and every `mafia:*` message handler) must only run for rooms whose id is
 * under this namespace. The client wraps Mafia calls via
 * `apps/client/src/composables/useMafiaMediaRoom.ts#mafiaSignalingRoomId`.
 */
export function isMafiaRoomId(roomId: string): boolean {
  return roomId.startsWith(MAFIA_ROOM_PREFIX)
}

export const EAT_FIRST_ROOM_PREFIX = 'eat:'

export function isEatFirstRoomId(roomId: string): boolean {
  return roomId.startsWith(EAT_FIRST_ROOM_PREFIX)
}

/**
 * Generic game-room namespace (Phase 3A). Mirrors only the generic subset of
 * Mafia behaviour — host claim, host reload recovery, players-update / order,
 * speaking queue, timer, force-mute-all, force-camera-off, kick/revive,
 * life-state, nickname, audio-mix, snapshot replay. Excludes Mafia role
 * assignment, mode, and background galleries.
 *
 * The client wraps generic calls via
 * `apps/client/src/composables/useGameRoomMediaRoom.ts` (added in Phase 3B).
 */
export const GAME_ROOM_PREFIX = 'gameroom:'

export function isGameRoomId(roomId: string): boolean {
  return roomId.startsWith(GAME_ROOM_PREFIX)
}

export const MAFIA_MAX_SEAT = 12

/**
 * Default upper bound for generic game-room seat numbering. Inherited from
 * Mafia (12) as a conservative cap; per-call sanitisation should still pass
 * the live peer count via `liveSeatCap` so a queue cannot reference a seat
 * that no longer has a player.
 */
export const GAME_ROOM_MAX_SEAT = MAFIA_MAX_SEAT

/** Max 1-based display seat index on Eat First call tiles (`playerOrder` length ≤ 11). */
export const EAT_FIRST_MAX_SPEAKING_QUEUE_SEAT = 11

export function sanitizeUserId(raw: string | undefined): string {
  const t = raw?.trim() ?? ''
  return t.length > 0 ? t.slice(0, 128) : ''
}

export function sanitizeSessionId(raw: string | undefined): string {
  const t = raw?.trim() ?? ''
  return t.length > 0 ? t.slice(0, 128) : ''
}

export function sanitizeDisplayName(raw: string | undefined, peerId: string): string {
  const t = raw?.trim() ?? ''
  if (t.length > 0) {
    return t.slice(0, 64)
  }
  return `Guest ${peerId.length > 6 ? peerId.slice(-6) : peerId}`
}

/**
 * Client-announced profile URL — https only, bounded length.
 *
 * Previously accepted `http:` as well; the avatar is rendered by every other
 * peer in the room, so accepting plaintext URLs risked mixed-content breakage
 * and trivially trackable pixels. Every legitimate provider (Twitch, Google,
 * Apple, Gravatar) serves avatars over https, so rejecting http has no
 * legitimate-UX cost. `data:` / `blob:` / `javascript:` remain rejected by
 * the protocol check; empty → `''` (no avatar) as before.
 */
export function sanitizeAvatarUrl(raw: string | undefined): string {
  const t = raw?.trim() ?? ''
  if (t.length === 0) {
    return ''
  }
  if (t.length > 2048) {
    return ''
  }
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:') {
      return ''
    }
    return t
  } catch {
    return ''
  }
}

export function sanitizeMafiaSpeakingQueueList(raw: unknown, maxSeat: number): number[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: number[] = []
  const cap = Math.max(1, Math.min(MAFIA_MAX_SEAT, maxSeat))
  const maxLen = cap * 2
  for (const x of raw) {
    if (typeof x !== 'number' || !Number.isInteger(x)) {
      continue
    }
    if (x < 1 || x > cap) {
      continue
    }
    out.push(x)
    if (out.length >= maxLen) {
      break
    }
  }
  if (out.length % 2 === 1) {
    out.pop()
  }
  return out
}

/**
 * Eat First nomination flat list: preserves pair order and duplicate seats
 * (same nominator may appear twice); only drops non-integers and out-of-range values.
 *
 * `liveSeatCap` (audit P1) tightens the upper bound to the actual live seat
 * count when supplied, so a host that emits a queue right after a player
 * leaves cannot broadcast a seat number beyond the table. Falls back to the
 * static `EAT_FIRST_MAX_SPEAKING_QUEUE_SEAT` (11) when no live count is given
 * or when the value is invalid.
 */
/**
 * Generic game-room speaking-queue sanitiser. Shares the Mafia sanitisation
 * shape (pair-encoded 1-based seat indices, drop non-integers, drop
 * out-of-range, drop odd trailing entries) but lets the caller pass the live
 * peer count via `liveSeatCap` so a queue can never reference a seat that no
 * longer has a player.
 */
export function sanitizeGameRoomSpeakingQueueList(raw: unknown, liveSeatCap?: number): number[] {
  if (!Array.isArray(raw)) {
    return []
  }
  let cap: number = GAME_ROOM_MAX_SEAT
  if (typeof liveSeatCap === 'number' && Number.isInteger(liveSeatCap) && liveSeatCap >= 1) {
    cap = Math.min(GAME_ROOM_MAX_SEAT, liveSeatCap)
  }
  const out: number[] = []
  const maxLen = cap * 2
  for (const x of raw) {
    if (typeof x !== 'number' || !Number.isInteger(x)) {
      continue
    }
    if (x < 1 || x > cap) {
      continue
    }
    out.push(x)
    if (out.length >= maxLen) {
      break
    }
  }
  if (out.length % 2 === 1) {
    out.pop()
  }
  return out
}

export function sanitizeEatFirstSpeakingQueueList(raw: unknown, liveSeatCap?: number): number[] {
  if (!Array.isArray(raw)) {
    return []
  }
  let cap: number = EAT_FIRST_MAX_SPEAKING_QUEUE_SEAT
  if (typeof liveSeatCap === 'number' && Number.isInteger(liveSeatCap) && liveSeatCap >= 1) {
    cap = Math.min(EAT_FIRST_MAX_SPEAKING_QUEUE_SEAT, liveSeatCap)
  }
  const out: number[] = []
  for (const x of raw) {
    if (typeof x !== 'number' || !Number.isInteger(x)) {
      continue
    }
    if (x < 1 || x > cap) {
      continue
    }
    out.push(x)
    if (out.length >= 16) {
      break
    }
  }
  return out
}
