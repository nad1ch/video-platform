import { randomBytes } from 'node:crypto'
import { prisma } from '../prisma'
import { broadcastEatFirstUpdate } from './broadcast'
import { mergeEatFirstPlayerData, mergeEatFirstRoom, mergePlayerDeep } from './roomMerge'
import { eatFirstSnapshot } from './snapshot'
import { isValidGameId, normalizeEatFirstSlot } from './slot'

const MIN_ROUND = 1

const DEFAULT_ROOM = {
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

/** @returns true if the game row was created by this call (no prior row). */
export async function eatFirstEnsureGame(gameId: string): Promise<boolean> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  const existing = await prisma.eatFirstGame.findUnique({ where: { id: gameId } })
  await prisma.eatFirstGame.upsert({
    where: { id: gameId },
    create: { id: gameId, room: DEFAULT_ROOM as object },
    update: {},
  })
  broadcast(gameId)
  return existing == null
}

export async function eatFirstMergeRoomAdmin(gameId: string, patch: unknown): Promise<void> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  await eatFirstEnsureGame(gameId)
  const g = await prisma.eatFirstGame.findUnique({ where: { id: gameId } })
  if (!g) {
    const e = new Error('Not found')
    ;(e as Error & { status?: number }).status = 404
    throw e
  }
  const clean = stripAdminKeyFromPatch(patch)
  const nextRoom = mergeEatFirstRoom(g.room, clean) as object
  await prisma.eatFirstGame.update({ where: { id: gameId }, data: { room: nextRoom } })
  broadcast(gameId)
}

export async function eatFirstPostHand(
  gameId: string,
  playerId: string,
  raised: boolean,
): Promise<void> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  const pid = normalizeEatFirstSlot(playerId)
  await eatFirstEnsureGame(gameId)
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
): Promise<void> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  const pid = normalizeEatFirstSlot(playerId)
  await eatFirstEnsureGame(gameId)
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
): Promise<{ ok: true; token: string } | { ok: false; reason: 'taken' | 'no-slot' | 'no-device' }> {
  if (!isValidGameId(gameId)) return { ok: false, reason: 'no-slot' }
  const pid = normalizeEatFirstSlot(slot)
  const dev = String(deviceId ?? '').trim()
  if (dev.length < 8) return { ok: false, reason: 'no-device' }
  const token = randomBytes(24).toString('hex')
  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.eatFirstPlayer.findUnique({
        where: { gameId_slotId: { gameId, slotId: pid } },
      })
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
    })
    return { ok: true, token }
  } catch (e) {
    const err = e as Error & { code?: string }
    if (err.code === 'TAKEN') return { ok: false, reason: 'taken' }
    if (err.code === 'NO_SLOT') return { ok: false, reason: 'no-slot' }
    throw e
  }
}

export async function eatFirstMergePlayerAdmin(
  gameId: string,
  slot: string,
  patch: unknown,
): Promise<void> {
  if (!isValidGameId(gameId)) {
    const e = new Error('Bad game id')
    ;(e as Error & { status?: number }).status = 400
    throw e
  }
  const pid = normalizeEatFirstSlot(slot)
  await eatFirstEnsureGame(gameId)
  const clean = stripAdminKeyFromPatch(patch)
  await prisma.$transaction(async (tx) => {
    const row = await tx.eatFirstPlayer.findUnique({
      where: { gameId_slotId: { gameId, slotId: pid } },
    })
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
  const row = await prisma.eatFirstPlayer.findFirst({
    where: { gameId, slotId: pid },
  })
  if (row) {
    await prisma.eatFirstPlayer.delete({ where: { id: row.id } })
  } else {
    const all = await prisma.eatFirstPlayer.findMany({ where: { gameId } })
    const match = all.find((r) => normalizeEatFirstSlot(r.slotId) === pid)
    if (match) {
      await prisma.eatFirstPlayer.delete({ where: { id: match.id } })
    }
  }
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
  const players = await prisma.eatFirstPlayer.findMany({ where: { gameId } })
  let n = 0
  for (const p of players) {
    const d =
      typeof p.data === 'object' && p.data !== null && !Array.isArray(p.data)
        ? (p.data as Record<string, unknown>)
        : {}
    if (d.eliminated !== true) continue
    n += 1
    const next = mergePlayerDeep(d, { eliminated: false }) as object
    await prisma.eatFirstPlayer.update({ where: { id: p.id }, data: { data: next } })
  }
  if (n > 0) broadcast(gameId)
  return n
}

export { eatFirstSnapshot }
