import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { broadcastEatFirstUpdate } from './broadcast'
import {
  eatFirstPlayerOrderFromUnknown,
  isEatFirstPlayerOrderPermutationOfAllowed,
  isEatFirstPlayerSlotId,
  resolveEatFirstEffectivePlayerOrder,
} from './playerOrder'
import { mergeEatFirstPlayerData, mergeEatFirstRoom, mergePlayerDeep } from './roomMerge'
import { eatFirstSnapshot } from './snapshot'
import { isValidGameId, normalizeEatFirstSlot } from './slot'
import {
  EAT_FIRST_TRAIT_KEYS,
  pickEatFirstTraitValue,
  type EatFirstTraitKey,
} from './randomPools'
import { pickRandomEatFirstActiveCard } from './activeCards'

const MIN_ROUND = 1

const DEFAULT_ROOM: Record<string, unknown> = {
  round: 1,
  gamePhase: 'intro',
  hands: {},
  playersReady: {},
  activePlayer: '',
  currentSpeaker: '',
  speakingTimer: 0,
  timerPaused: false,
}

function broadcast(gameId: string): void {
  broadcastEatFirstUpdate(gameId)
}

async function eatFirstPersistPlayerOrderReconcile(
  tx: Prisma.TransactionClient,
  game: { id: string; room: unknown; players: { slotId: string }[] },
): Promise<void> {
  const allowed = new Set<string>()
  for (const p of game.players) {
    const id = normalizeEatFirstSlot(p.slotId)
    if (isEatFirstPlayerSlotId(id)) allowed.add(id)
  }
  const room =
    typeof game.room === 'object' && game.room !== null && !Array.isArray(game.room)
      ? { ...(game.room as Record<string, unknown>) }
      : {}
  const order = resolveEatFirstEffectivePlayerOrder(room.playerOrder, allowed)
  await tx.eatFirstGame.update({
    where: { id: game.id },
    data: { room: mergeEatFirstRoom(room, { playerOrder: order }) as object },
  })
}

function stripAdminKeyFromPatch(patch: unknown): Record<string, unknown> {
  const p =
    typeof patch === 'object' && patch !== null && !Array.isArray(patch)
      ? { ...(patch as Record<string, unknown>) }
      : {}
  delete p.key
  return p
}

function collectRaisedHands(room: Record<string, unknown>): Record<string, boolean> {
  const h: Record<string, boolean> = {}
  const rawHands = room.hands
  if (rawHands && typeof rawHands === 'object' && !Array.isArray(rawHands)) {
    for (const [k, v] of Object.entries(rawHands)) {
      if (v === true) h[normalizeEatFirstSlot(k)] = true
    }
  }
  const prefix = 'hands.'
  for (const key of Object.keys(room)) {
    if (typeof key !== 'string' || !key.startsWith(prefix)) continue
    const slot = key.slice(prefix.length)
    if (!slot) continue
    if (room[key] === true) h[normalizeEatFirstSlot(slot)] = true
  }
  return h
}

function collectPlayersReady(room: Record<string, unknown>): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  const raw = room.playersReady
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (v === true) out[normalizeEatFirstSlot(k)] = true
    }
  }
  return out
}

/**
 * @returns true if the game row was created by this call (no prior row).
 *
 * When `ownerUserId` is provided (from an authenticated host/admin session),
 * it is stamped into `room.ownerUserId` for the per-game host gate
 * (`eatFirstSessionCanOperateGame`). Stamping only occurs on first creation
 * or when the field is absent from a legacy row — it is never overwritten
 * for an already-owned game.
 */
export async function eatFirstEnsureGame(
  gameId: string,
  ownerUserId?: string | null,
): Promise<boolean> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  const existing = await prisma.eatFirstGame.findUnique({ where: { id: gameId } })
  const ownerId =
    typeof ownerUserId === 'string' && ownerUserId.trim().length > 0
      ? ownerUserId.trim()
      : null

  if (!existing) {
    const createRoom: Record<string, unknown> = { ...DEFAULT_ROOM }
    if (ownerId) createRoom.ownerUserId = ownerId
    await prisma.eatFirstGame.create({
      data: { id: gameId, room: createRoom as object },
    })
    broadcast(gameId)
    return true
  }

  // Back-fill ownerUserId on legacy rows that never had one stamped. Do NOT
  
  
  let backfilled = false
  if (ownerId) {
    const room =
      typeof existing.room === 'object' && existing.room !== null && !Array.isArray(existing.room)
        ? (existing.room as Record<string, unknown>)
        : {}
    const currentOwnerRaw = room.ownerUserId
    const currentOwner =
      typeof currentOwnerRaw === 'string' && currentOwnerRaw.trim().length > 0
        ? currentOwnerRaw.trim()
        : ''
    if (currentOwner.length === 0) {
      const nextRoom = { ...room, ownerUserId: ownerId }
      await prisma.eatFirstGame.update({
        where: { id: gameId },
        data: { room: nextRoom as object },
      })
      backfilled = true
    }
  }

  
  
  
  if (backfilled) {
    broadcast(gameId)
  }
  return false
}

export async function eatFirstMergeRoomAdmin(
  gameId: string,
  patch: unknown,
  ownerUserId?: string | null,
): Promise<void> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  
  
  
  await eatFirstEnsureGame(gameId, ownerUserId)
  const g = await prisma.eatFirstGame.findUnique({
    where: { id: gameId },
    include: { players: true },
  })
  if (!g) {
    const e = new Error('Not found')
    ;(e as Error & { status?: number }).status = 404
    throw e
  }
  const clean = stripAdminKeyFromPatch(patch)
  const nextRoom = mergeEatFirstRoom(g.room, clean) as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(clean, 'playerOrder')) {
    const allowed = new Set<string>()
    for (const p of g.players) {
      const id = normalizeEatFirstSlot(p.slotId)
      if (isEatFirstPlayerSlotId(id)) allowed.add(id)
    }
    const po = eatFirstPlayerOrderFromUnknown(nextRoom.playerOrder)
    if (!po || !isEatFirstPlayerOrderPermutationOfAllowed(po, allowed)) {
      const e = new Error('Invalid playerOrder')
      ;(e as Error & { status?: number }).status = 400
      throw e
    }
  }
  await prisma.eatFirstGame.update({ where: { id: gameId }, data: { room: nextRoom as object } })
  broadcast(gameId)
}

/**
 * Return `ok` when the provided `joinToken` + `deviceId` match what
 * `eatFirstClaimSlot` stored for this (gameId, slotId). Matches on token and
 * device both so an attacker who reads the token from logs still needs the
 * claimer's device id.
 *
 * When the slot row exists but has NO claim yet (`joinToken` empty), the check
 * returns `ok: false, reason: 'unclaimed'` — callers MUST either (a) force the
 * user to claim first, or (b) accept only from an authenticated host session.
 *
 * When the slot row is missing entirely, returns `ok: false, reason: 'no-slot'`.
 */
export type SlotAuthResult =
  | { ok: true }
  | { ok: false; reason: 'no-slot' | 'unclaimed' | 'forbidden' }

export async function verifyEatFirstSlotAuth(
  gameId: string,
  slotId: string,
  deviceId: string,
  joinToken: string,
): Promise<SlotAuthResult> {
  const row = await prisma.eatFirstPlayer.findUnique({
    where: { gameId_slotId: { gameId, slotId } },
    select: { data: true },
  })
  if (!row) return { ok: false, reason: 'no-slot' }
  const d =
    typeof row.data === 'object' && row.data !== null && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : {}
  const storedTok = typeof d.joinToken === 'string' ? d.joinToken.trim() : ''
  const storedDev = typeof d.joinDeviceId === 'string' ? d.joinDeviceId.trim() : ''
  if (storedTok.length === 0) return { ok: false, reason: 'unclaimed' }
  const tok = typeof joinToken === 'string' ? joinToken.trim() : ''
  const dev = typeof deviceId === 'string' ? deviceId.trim() : ''
  if (tok.length === 0 || dev.length === 0) return { ok: false, reason: 'forbidden' }
  if (tok !== storedTok || dev !== storedDev) return { ok: false, reason: 'forbidden' }
  return { ok: true }
}

/** Whether an Eat First player row exists for this game/slot (call slot-claim uses this for host binding). */
export async function eatFirstPlayerSlotRowExists(gameId: string, slotId: string): Promise<boolean> {
  if (!isValidGameId(gameId)) return false
  const pid = normalizeEatFirstSlot(slotId)
  if (!isEatFirstPlayerSlotId(pid)) return false
  const row = await prisma.eatFirstPlayer.findUnique({
    where: { gameId_slotId: { gameId, slotId: pid } },
    select: { id: true },
  })
  return row != null
}

export async function eatFirstPostHand(
  gameId: string,
  playerId: string,
  raised: boolean,
  ownerUserId?: string | null,
): Promise<void> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  const pid = normalizeEatFirstSlot(playerId)
  if (!isEatFirstPlayerSlotId(pid)) {
    const e = new Error('Invalid player slot')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }

  await eatFirstEnsureGame(gameId, ownerUserId)
  await prisma.$transaction(async (tx) => {
    const g = await tx.eatFirstGame.findUnique({ where: { id: gameId } })
    if (!g) throw new Error('missing')
    const room =
      typeof g.room === 'object' && g.room !== null && !Array.isArray(g.room)
        ? { ...(g.room as Record<string, unknown>) }
        : {}
    const next = { ...collectRaisedHands(room) }
    if (raised) next[pid] = true
    else delete next[pid]
    const nextRoom = mergeEatFirstRoom(room, { hands: next }) as object
    await tx.eatFirstGame.update({ where: { id: gameId }, data: { room: nextRoom } })
  })
  broadcast(gameId)
}

export async function eatFirstPostReady(
  gameId: string,
  playerId: string,
  ready: boolean,
  ownerUserId?: string | null,
): Promise<void> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  const pid = normalizeEatFirstSlot(playerId)
  if (!isEatFirstPlayerSlotId(pid)) {
    const e = new Error('Invalid player slot')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }

  await eatFirstEnsureGame(gameId, ownerUserId)
  await prisma.$transaction(async (tx) => {
    const g = await tx.eatFirstGame.findUnique({ where: { id: gameId } })
    if (!g) throw new Error('missing')
    const room =
      typeof g.room === 'object' && g.room !== null && !Array.isArray(g.room)
        ? { ...(g.room as Record<string, unknown>) }
        : {}
    const next = { ...collectPlayersReady(room) }
    if (ready) next[pid] = true
    else delete next[pid]
    const nextRoom = mergeEatFirstRoom(room, { playersReady: next }) as object
    await tx.eatFirstGame.update({ where: { id: gameId }, data: { room: nextRoom } })
  })
  broadcast(gameId)
}

export async function eatFirstClaimSlot(
  gameId: string,
  slot: string,
  deviceId: string,
  displayName: string,
): Promise<
  | { ok: true; token: string }
  | {
      ok: false
      reason: 'taken' | 'no-slot' | 'no-device' | 'invalid-slot' | 'room-full'
    }
> {
  if (!isValidGameId(gameId)) return { ok: false, reason: 'no-slot' }
  const pid = normalizeEatFirstSlot(slot)
  if (!isEatFirstPlayerSlotId(pid)) {
    return { ok: false, reason: 'invalid-slot' }
  }
  const dev = String(deviceId ?? '').trim()
  if (dev.length < 8) return { ok: false, reason: 'no-device' }
  const token = randomBytes(24).toString('hex')
  try {
    await prisma.$transaction(
      async (tx) => {
        const game = await tx.eatFirstGame.findUnique({
          where: { id: gameId },
          include: { players: true },
        })
        if (!game) {
          const e = new Error('NO_SLOT')
          ;(e as Error & { code?: string }).code = 'NO_SLOT'
          throw e
        }
        const row = game.players.find((p) => normalizeEatFirstSlot(p.slotId) === pid)
        if (!row) {
          const e = new Error('NO_SLOT')
          ;(e as Error & { code?: string }).code = 'NO_SLOT'
          throw e
        }
        const d =
          typeof row.data === 'object' && row.data !== null && !Array.isArray(row.data)
            ? (row.data as Record<string, unknown>)
            : {}
        const exTok = typeof d.joinToken === 'string' ? d.joinToken.trim() : ''
        const exDev = typeof d.joinDeviceId === 'string' ? d.joinDeviceId.trim() : ''
        let claimedCount = 0
        for (const p of game.players) {
          const pd =
            typeof p.data === 'object' && p.data !== null && !Array.isArray(p.data)
              ? (p.data as Record<string, unknown>)
              : {}
          const tok = typeof pd.joinToken === 'string' ? pd.joinToken.trim() : ''
          if (tok.length > 0) claimedCount += 1
        }
        if (exTok.length === 0 && claimedCount >= 11) {
          const e = new Error('ROOM_FULL')
          ;(e as Error & { code?: string }).code = 'ROOM_FULL'
          throw e
        }
        if (exTok.length > 0 && exDev !== dev) {
          const e = new Error('TAKEN')
          ;(e as Error & { code?: string }).code = 'TAKEN'
          throw e
        }
        const nextData: Record<string, unknown> = {
          ...d,
          joinToken: token,
          joinDeviceId: dev,
          joinClaimedAt: new Date().toISOString(),
        }
        if (displayName) nextData.name = displayName
        await tx.eatFirstPlayer.update({
          where: { gameId_slotId: { gameId, slotId: pid } },
          data: { data: nextData as object },
        })
        const gameAfter = await tx.eatFirstGame.findUnique({
          where: { id: gameId },
          include: { players: true },
        })
        if (gameAfter) {
          await eatFirstPersistPlayerOrderReconcile(tx, gameAfter)
        }
      },
      { isolationLevel: 'Serializable' },
    )
    return { ok: true, token }
  } catch (e) {
    const err = e as Error & { code?: string }
    if (err.code === 'TAKEN') return { ok: false, reason: 'taken' }
    if (err.code === 'NO_SLOT') return { ok: false, reason: 'no-slot' }
    if (err.code === 'ROOM_FULL') return { ok: false, reason: 'room-full' }
    const prismaCode = (e as { code?: unknown })?.code
    if (prismaCode === 'P2034') return { ok: false, reason: 'taken' }
    throw e
  }
}

export async function eatFirstMergePlayerAdmin(
  gameId: string,
  slot: string,
  patch: unknown,
  ownerUserId?: string | null,
): Promise<void> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  const pid = normalizeEatFirstSlot(slot)
  if (!isEatFirstPlayerSlotId(pid)) {
    const e = new Error('Invalid player slot')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  await eatFirstEnsureGame(gameId, ownerUserId)
  const clean = stripAdminKeyFromPatch(patch)
  await prisma.$transaction(async (tx) => {
    const row = await tx.eatFirstPlayer.findUnique({
      where: { gameId_slotId: { gameId, slotId: pid } },
    })
    if (!row) {
      const c = await tx.eatFirstPlayer.count({ where: { gameId } })
      if (c >= 11) {
        const e = new Error('Room has maximum players')
        ;(e as Error & { status?: number }).status = 400
        throw e
      }
    }
    const prev =
      row && typeof row.data === 'object' && row.data !== null && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : {}
    const nextData = mergeEatFirstPlayerData(prev, clean) as object
    await tx.eatFirstPlayer.upsert({
      where: { gameId_slotId: { gameId, slotId: pid } },
      create: { gameId, slotId: pid, data: nextData },
      update: { data: nextData },
    })
    const gameAfter = await tx.eatFirstGame.findUnique({
      where: { id: gameId },
      include: { players: true },
    })
    if (gameAfter) {
      await eatFirstPersistPlayerOrderReconcile(tx, gameAfter)
    }
  })
  broadcast(gameId)
}

export async function eatFirstDeletePlayerAdmin(gameId: string, slot: string): Promise<void> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  const pid = normalizeEatFirstSlot(slot)
  if (!isEatFirstPlayerSlotId(pid)) {
    const e = new Error('Invalid player slot')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.eatFirstPlayer.deleteMany({
      where: { gameId, slotId: pid },
    })
    if (deleted.count === 0) {
      const all = await tx.eatFirstPlayer.findMany({ where: { gameId } })
      const match = all.find((r) => normalizeEatFirstSlot(r.slotId) === pid)
      if (match) {
        await tx.eatFirstPlayer.deleteMany({ where: { id: match.id } })
      }
    }
    const game = await tx.eatFirstGame.findUnique({
      where: { id: gameId },
      include: { players: true },
    })
    if (game) {
      await eatFirstPersistPlayerOrderReconcile(tx, game)
    }
  })
  broadcast(gameId)
}

export async function eatFirstSubmitVote(
  gameId: string,
  voterPlayerId: string,
  targetPlayer: string,
  choice: string,
  round: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isValidGameId(gameId)) return { ok: false, reason: 'invalid' }
  const voter = normalizeEatFirstSlot(voterPlayerId)
  if (!isEatFirstPlayerSlotId(voter)) return { ok: false, reason: 'invalid-voter' }
  const target = String(targetPlayer ?? '').trim()
  const c = choice === 'against' ? 'against' : 'for'
  const r = Math.floor(Number(round) || 0)
  if (!voter || !target || r < MIN_ROUND) return { ok: false, reason: 'invalid' }

  const existing = await prisma.eatFirstVote.findUnique({
    where: { gameId_voterSlotId: { gameId, voterSlotId: voter } },
  })
  if (existing) {
    const prev =
      typeof existing.data === 'object' && existing.data !== null && !Array.isArray(existing.data)
        ? (existing.data as Record<string, unknown>)
        : {}
    if (Number(prev.round) === r) return { ok: false, reason: 'already-voted' }
  }

  const data = {
    choice: c,
    targetPlayer: target,
    round: r,
    at: new Date().toISOString(),
  }
  await prisma.eatFirstVote.upsert({
    where: { gameId_voterSlotId: { gameId, voterSlotId: voter } },
    create: { gameId, voterSlotId: voter, data },
    update: { data },
  })
  broadcast(gameId)
  return { ok: true }
}

export async function eatFirstClearVotesAdmin(gameId: string): Promise<void> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  await prisma.eatFirstVote.deleteMany({ where: { gameId } })
  broadcast(gameId)
}

export async function eatFirstDeleteVoteAdmin(gameId: string, voterSlot: string): Promise<void> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  const v = normalizeEatFirstSlot(voterSlot)
  await prisma.eatFirstVote.deleteMany({ where: { gameId, voterSlotId: v } })
  broadcast(gameId)
}

export async function eatFirstReviveEliminatedAdmin(gameId: string): Promise<number> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  
  
  
  
  const n = await prisma.$transaction(async (tx) => {
    const players = await tx.eatFirstPlayer.findMany({ where: { gameId } })
    let count = 0
    for (const p of players) {
      const d =
        typeof p.data === 'object' && p.data !== null && !Array.isArray(p.data)
          ? (p.data as Record<string, unknown>)
          : {}
      if (d.eliminated !== true) continue
      count += 1
      const next = mergePlayerDeep(d, { eliminated: false }) as object
      await tx.eatFirstPlayer.update({ where: { id: p.id }, data: { data: next } })
    }
    return count
  })
  if (n > 0) broadcast(gameId)
  return n
}

const EAT_FIRST_CHARACTER_KEYS = [
  'name',
  'age',
  'gender',
  'profession',
  'health',
  'phobia',
  'luggage',
  'fact',
  'quirk',
  'activeCard',
  'activeCardRequest',
  'revealLedger',
  'identityRevealed',
  'demographicsRevealed',
] as const

function copyEatFirstCharacterPatch(data: unknown): Record<string, unknown> {
  const src =
    typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  const out: Record<string, unknown> = {}
  for (const key of EAT_FIRST_CHARACTER_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue
    out[key] = src[key]
  }
  return out
}

function shuffledCopyStable<T>(list: T[]): T[] {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  if (out.length > 1 && out.every((item, index) => Object.is(item, list[index]))) {
    const first = out.shift()
    if (first !== undefined) out.push(first)
  }
  return out
}

/**
 * Canonical admin patch shape for persisting the full 8-trait + action card model
 * after server-side table hydration (call signaling uses the same field layout as DB snapshots).
 */
export function eatFirstAdminPatchForFullCharacterDeal(
  traits: Record<EatFirstTraitKey, string>,
  card: {
    title: string
    description: string
    templateId: string
    effectId: string
    used: boolean
  },
): Record<string, unknown> {
  return {
    gender: traits.gender,
    age: traits.age,
    profession: { value: traits.profession },
    health: { value: traits.health },
    quirk: { value: traits.hobby },
    phobia: { value: traits.phobia },
    fact: { value: traits.fact },
    luggage: { value: traits.baggage },
    activeCard: {
      title: card.title,
      description: card.description,
      templateId: card.templateId,
      effectId: card.effectId,
      used: card.used,
    },
    revealLedger: { round: 0, count: 0, maxForRound: 0 },
    demographicsRevealed: false,
    identityRevealed: false,
  }
}

export async function eatFirstHostReshuffleAdmin(
  gameId: string,
  participantCount?: number,
  ownerUserId?: string | null,
): Promise<{ playerOrder: string[]; traitsBySeat: Record<number, string[]> }> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  await eatFirstEnsureGame(gameId, ownerUserId)
  const fallbackCount = Number.isFinite(participantCount) ? Math.max(0, Math.floor(participantCount ?? 0)) : 0
  const traitPool = [
    'Професія: інженер',
    'Професія: вчитель',
    'Професія: лікар',
    'Професія: музикант',
    'Професія: дизайнер',
    'Професія: кухар',
    'Здоров’я: астма',
    'Здоров’я: алергія',
    'Фобія: висота',
    'Фобія: темрява',
    'Багаж: набір інструментів',
    'Багаж: аптечка',
    'Факт: говорить 4 мовами',
    'Факт: пережив кораблетрощу',
    'Особливість: ніколи не бреше',
    'Особливість: говорить уві сні',
  ]

  const fallbackTraitsBySeat = (count: number): Record<number, string[]> => {
    const seats = Math.max(0, count)
    const out: Record<number, string[]> = {}
    for (let seat = 1; seat <= seats; seat += 1) {
      const pick = shuffledCopyStable(traitPool).slice(0, 3)
      out[seat] = pick
    }
    return out
  }

  const result = await prisma.$transaction(async (tx) => {
    const game = await tx.eatFirstGame.findUnique({
      where: { id: gameId },
      include: { players: true },
    })
    if (!game) {
      const e = new Error('Not found')
      ;(e as Error & { status?: number }).status = 404
      throw e
    }
    const playersBySlot = new Map<string, { id: string; data: unknown }>()
    for (const row of game.players) {
      const slot = normalizeEatFirstSlot(row.slotId)
      if (!isEatFirstPlayerSlotId(slot)) continue
      playersBySlot.set(slot, { id: row.id, data: row.data })
    }
    let slots = [...playersBySlot.keys()].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    )
    /**
     * Ensure Prisma has contiguous `p1..pN` up to the live table size. When the DB
     * already had ≥2 rows (e.g. only `p1`,`p2`) but the call has more peers, the old
     * `slots.length < 2` branch was skipped and no `p3+` stubs were created — call
     * tiles beyond the first seats never got traits or slot bindings.
     */
    const targetSlotCount = Math.min(11, Math.max(2, fallbackCount, slots.length))
    let expandedSlots = false
    for (let n = 1; n <= targetSlotCount; n += 1) {
      const pid = normalizeEatFirstSlot(`p${n}`)
      if (!isEatFirstPlayerSlotId(pid) || playersBySlot.has(pid)) continue
      expandedSlots = true
      const traits = {} as Record<EatFirstTraitKey, string>
      for (const key of EAT_FIRST_TRAIT_KEYS) {
        traits[key] = pickEatFirstTraitValue(key)
      }
      const rolled = pickRandomEatFirstActiveCard()
      const patch = eatFirstAdminPatchForFullCharacterDeal(traits, { ...rolled, used: false })
      const prevRow = await tx.eatFirstPlayer.findUnique({
        where: { gameId_slotId: { gameId, slotId: pid } },
      })
      const prev =
        prevRow && typeof prevRow.data === 'object' && prevRow.data !== null && !Array.isArray(prevRow.data)
          ? (prevRow.data as Record<string, unknown>)
          : {}
      const nextData = mergeEatFirstPlayerData(prev, patch) as object
      const upserted = await tx.eatFirstPlayer.upsert({
        where: { gameId_slotId: { gameId, slotId: pid } },
        create: { gameId, slotId: pid, data: nextData },
        update: { data: nextData },
      })
      playersBySlot.set(pid, { id: upserted.id, data: upserted.data })
    }
    if (expandedSlots) {
      const gameReload = await tx.eatFirstGame.findUnique({
        where: { id: gameId },
        include: { players: true },
      })
      if (!gameReload) {
        const e = new Error('Not found')
        ;(e as Error & { status?: number }).status = 404
        throw e
      }
      await eatFirstPersistPlayerOrderReconcile(tx, gameReload)
      playersBySlot.clear()
      for (const row of gameReload.players) {
        const slot = normalizeEatFirstSlot(row.slotId)
        if (!isEatFirstPlayerSlotId(slot)) continue
        playersBySlot.set(slot, { id: row.id, data: row.data })
      }
      slots = [...playersBySlot.keys()].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
      )
    }
    if (slots.length < 2) {
      const room =
        typeof game.room === 'object' && game.room !== null && !Array.isArray(game.room)
          ? (game.room as Record<string, unknown>)
          : {}
      const traitsBySeat = fallbackTraitsBySeat(fallbackCount)
      const nextRoom = mergeEatFirstRoom(room, {
        callTraitsBySeat: traitsBySeat,
        callSignalingSnapshot: null,
      }) as object
      await tx.eatFirstGame.update({ where: { id: gameId }, data: { room: nextRoom } })
      return { playerOrder: [] as string[], traitsBySeat }
    }
    const sourceSlots = shuffledCopyStable(slots)
    for (let i = 0; i < slots.length; i += 1) {
      const targetSlot = slots[i]
      const sourceSlot = sourceSlots[i]
      const targetRow = playersBySlot.get(targetSlot)
      const sourceRow = playersBySlot.get(sourceSlot)
      if (!targetRow || !sourceRow) continue
      const targetData =
        typeof targetRow.data === 'object' && targetRow.data !== null && !Array.isArray(targetRow.data)
          ? (targetRow.data as Record<string, unknown>)
          : {}
      const sourcePatch = copyEatFirstCharacterPatch(sourceRow.data)
      const nextData = mergePlayerDeep(targetData, sourcePatch) as object
      await tx.eatFirstPlayer.update({ where: { id: targetRow.id }, data: { data: nextData } })
    }
    const room =
      typeof game.room === 'object' && game.room !== null && !Array.isArray(game.room)
        ? (game.room as Record<string, unknown>)
        : {}
    const playerOrder = shuffledCopyStable(slots)
    const traitsBySeat: Record<number, string[]> = {}
    for (let i = 0; i < playerOrder.length; i += 1) {
      const row = playersBySlot.get(playerOrder[i])
      const data =
        row && typeof row.data === 'object' && row.data !== null && !Array.isArray(row.data)
          ? (row.data as Record<string, unknown>)
          : {}
      const toStr = (key: string): string => {
        const chunk = data[key]
        if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) return ''
        const value = (chunk as { value?: unknown }).value
        return typeof value === 'string' ? value.trim() : ''
      }
      traitsBySeat[i + 1] = [toStr('profession'), toStr('health'), toStr('phobia'), toStr('luggage'), toStr('fact'), toStr('quirk')].filter(
        (v) => v.length > 0,
      )
    }
    // Single persist: a second merge against stale `game.room` dropped `playerOrder`
    // from the previous update, so every deal after the first looked identical.
    const nextRoom = mergeEatFirstRoom(room, {
      playerOrder,
      callTraitsBySeat: traitsBySeat,
      callSignalingSnapshot: null,
    }) as object
    await tx.eatFirstGame.update({ where: { id: gameId }, data: { room: nextRoom } })
    return { playerOrder, traitsBySeat }
  })
  broadcast(gameId)
  return result
}

export { eatFirstSnapshot }
