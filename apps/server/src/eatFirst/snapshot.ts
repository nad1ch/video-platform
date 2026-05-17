import type { PrismaClient } from '@prisma/client'
import {
  getEatFirstHostDisplaySeat,
  isEatFirstPlayerSlotId,
  resolveEatFirstEffectivePlayerOrder,
} from './playerOrder'
import { normalizeEatFirstSlot } from './slot'
import { EAT_FIRST_TRAIT_KEYS, type EatFirstTraitKey } from './randomPools'

function stripKey<T extends Record<string, unknown>>(o: T): T {
  const c = { ...o }
  delete c.key
  return c
}

/**
 * Fields that must never leave the server through a public snapshot. The room
 * snapshot is fanned out to anonymous `/eat-first-ws` subscribers and any caller
 * of `GET /api/eat-first/games/:gameId/snapshot`, so the room owner identity and
 * the call-signaling persistence blob (host-only state) are redacted here.
 */
const PRIVATE_ROOM_FIELDS = ['ownerUserId', 'callSignalingSnapshot'] as const

/**
 * Per-player auth credentials. `joinToken` + `joinDeviceId` together form the
 * seat-claim secret consumed by `eat:slot-claim` / `verifyEatFirstSlotAuth`, so
 * leaking them is full impersonation. `joinClaimedAt` is the timestamp paired
 * with the token and has no reason to be public either.
 */
const PRIVATE_PLAYER_FIELDS = ['joinToken', 'joinDeviceId', 'joinClaimedAt'] as const

/**
 * Mapping from gameplay trait key to the persistence field on `player.data`.
 * Two keys diverge for historical reasons: 'hobby' lives at `data.quirk` and
 * 'baggage' lives at `data.luggage`. Anything not in this set (`gender`, `age`)
 * is a top-level scalar with a name equal to the trait key.
 *
 * Used by the public-viewer redactor (audit R14) to strip trait values that
 * have not been revealed yet through the signaling overlay.
 */
const PLAYER_DATA_FIELD_BY_TRAIT: Record<EatFirstTraitKey, string> = {
  gender: 'gender',
  age: 'age',
  profession: 'profession',
  health: 'health',
  hobby: 'quirk',
  phobia: 'phobia',
  fact: 'fact',
  baggage: 'luggage',
}

function stripFields<T extends Record<string, unknown>>(o: T, fields: ReadonlyArray<string>): T {
  const c = { ...o }
  for (const f of fields) {
    delete c[f as keyof typeof c]
  }
  return c
}

function sanitizeRoom(room: unknown): Record<string, unknown> {
  if (!room || typeof room !== 'object' || Array.isArray(room)) return {}
  const base = stripKey({ ...(room as Record<string, unknown>) }) as Record<string, unknown>
  return stripFields(base, PRIVATE_ROOM_FIELDS)
}

function sanitizePlayerData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  const base = stripKey({ ...(data as Record<string, unknown>) }) as Record<string, unknown>
  return stripFields(base, PRIVATE_PLAYER_FIELDS)
}

/**
 * Audit R14 — strip trait values that have not yet been revealed for `slotId`.
 * `revealedKeys` comes from `room.callSignalingSnapshot.revealedTraitsBySlot`,
 * the same source the host UI uses for reveal state; if it is missing or
 * unparseable we treat *nothing* as revealed and strip every trait field,
 * preserving identity (gender/age) only when explicitly revealed.
 *
 * Always strips the host-only `activeCard` description and effect details
 * regardless of reveal state — the card body is host strategy and only the
 * `lastUsedActionCard` chip (broadcast via signaling, not the snapshot) is
 * intended to be public.
 */
function applyPublicTraitRedaction(
  player: Record<string, unknown>,
  revealedKeys: ReadonlySet<EatFirstTraitKey>,
): Record<string, unknown> {
  const redacted = { ...player }
  for (const trait of EAT_FIRST_TRAIT_KEYS) {
    if (revealedKeys.has(trait)) continue
    const dbField = PLAYER_DATA_FIELD_BY_TRAIT[trait]
    delete redacted[dbField]
  }
  if (redacted.activeCard) {
    delete redacted.activeCard
  }
  return redacted
}

function parseRevealedTraitsFromRoom(
  rawRoom: Record<string, unknown>,
): Map<string, Set<EatFirstTraitKey>> {
  const out = new Map<string, Set<EatFirstTraitKey>>()
  const overlay = rawRoom.callSignalingSnapshot
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) return out
  const revealedRaw = (overlay as Record<string, unknown>).revealedTraitsBySlot
  if (!revealedRaw || typeof revealedRaw !== 'object' || Array.isArray(revealedRaw)) return out
  const traitKeySet = new Set<string>(EAT_FIRST_TRAIT_KEYS)
  for (const [slotId, arr] of Object.entries(revealedRaw as Record<string, unknown>)) {
    if (!Array.isArray(arr)) continue
    const keys = new Set<EatFirstTraitKey>()
    for (const item of arr) {
      if (typeof item === 'string' && traitKeySet.has(item)) {
        keys.add(item as EatFirstTraitKey)
      }
    }
    if (keys.size > 0) out.set(normalizeEatFirstSlot(slotId), keys)
  }
  return out
}

export type EatFirstSnapshot = {
  room: Record<string, unknown>
  players: Array<Record<string, unknown> & { id: string }>
  votes: Array<Record<string, unknown> & { id: string }>
  /** Server-derived display metadata (not persisted as its own row). */
  display: { hostDisplaySeat: number; playerCount: number }
}

/**
 * @param viewerMode  'host' returns the full snapshot; 'public' strips trait
 *                    values that have not been revealed through the signaling
 *                    overlay (audit R14). Defaults to `'public'` so any caller
 *                    that forgets to pass a mode fails closed.
 */
export async function eatFirstSnapshot(
  prisma: PrismaClient,
  gameId: string,
  viewerMode: 'host' | 'public' = 'public',
): Promise<EatFirstSnapshot> {
  const g = await prisma.eatFirstGame.findUnique({
    where: { id: gameId },
    include: { players: true, votes: true },
  })
  if (!g) {
    return { room: {}, players: [], votes: [], display: { hostDisplaySeat: 1, playerCount: 0 } }
  }
  const rawRoom =
    typeof g.room === 'object' && g.room !== null && !Array.isArray(g.room)
      ? (g.room as Record<string, unknown>)
      : {}
  const allowedSlotIds = new Set<string>()
  for (const p of g.players) {
    const id = normalizeEatFirstSlot(p.slotId)
    if (isEatFirstPlayerSlotId(id)) allowedSlotIds.add(id)
  }
  const effectivePlayerOrder = resolveEatFirstEffectivePlayerOrder(rawRoom.playerOrder, allowedSlotIds)
  const room = {
    ...sanitizeRoom(g.room),
    playerOrder: effectivePlayerOrder,
  }
  const revealedBySlot =
    viewerMode === 'public' ? parseRevealedTraitsFromRoom(rawRoom) : null
  const players = g.players
    .filter((p) => isEatFirstPlayerSlotId(normalizeEatFirstSlot(p.slotId)))
    .map((p) => {
      const id = normalizeEatFirstSlot(p.slotId)
      const base = sanitizePlayerData(p.data)
      const redacted = revealedBySlot
        ? applyPublicTraitRedaction(base, revealedBySlot.get(id) ?? new Set())
        : base
      return { id, ...redacted } as Record<string, unknown> & { id: string }
    })
    .sort((a, b) =>
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' }),
    )
  const votes = g.votes
    .map((v) => {
      const base =
        typeof v.data === 'object' && v.data !== null && !Array.isArray(v.data)
          ? (v.data as Record<string, unknown>)
          : {}
      return { id: normalizeEatFirstSlot(v.voterSlotId), ...stripKey({ ...base }) } as Record<
        string,
        unknown
      > & { id: string }
    })
    .sort((a, b) =>
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' }),
    )
  const display = {
    hostDisplaySeat: getEatFirstHostDisplaySeat(effectivePlayerOrder),
    playerCount: effectivePlayerOrder.length,
  }
  return { room, players, votes, display }
}
