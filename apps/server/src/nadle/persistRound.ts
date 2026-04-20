import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

export type WordleRoundPlayer = {
  userId: string
  attempts: number
  isWinner: boolean
}

export type PersistWordleRoundInput = {
  streamerId: string
  winnerUserId: string
  players: WordleRoundPlayer[]
}

function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

async function resolveDbUserId(
  tx: Prisma.TransactionClient,
  wordleParticipantId: string,
): Promise<string | null> {
  const byId = await tx.user.findUnique({
    where: { id: wordleParticipantId },
    select: { id: true },
  })
  if (byId) {
    return byId.id
  }
  const byTwitch = await tx.user.findFirst({
    where: { twitchId: wordleParticipantId },
    select: { id: true },
  })
  return byTwitch?.id ?? null
}

/**
 * Persists a finished Wordle round (winner known), updates {@link UserStreamerStats} for registered users.
 * Swallows errors — must never break live game / websocket flow.
 */
export async function persistWordleRound(input: PersistWordleRoundInput): Promise<void> {
  if (!isDatabaseConfigured()) {
    return
  }
  const { streamerId, winnerUserId, players } = input
  if (!streamerId || !winnerUserId || !Array.isArray(players) || players.length === 0) {
    return
  }
  try {
    await prisma.$transaction(async (tx) => {
      const streamer = await tx.streamer.findFirst({
        where: { id: streamerId, isActive: true },
        select: { id: true },
      })
      if (!streamer) {
        console.warn('[wordle][persist] skip persist: unknown or inactive streamerId', streamerId)
        return
      }
      const round = await tx.gameRound.create({
        data: { winnerUserId, streamerId },
      })
      await tx.gameResult.createMany({
        data: players.map((p) => ({
          roundId: round.id,
          userId: p.userId,
          attempts: p.attempts,
          isWinner: p.isWinner,
        })),
      })

      for (const p of players) {
        const dbUserId = await resolveDbUserId(tx, p.userId)
        if (!dbUserId) {
          continue
        }
        const update: { gamesPlayed: { increment: number }; wins?: { increment: number } } = {
          gamesPlayed: { increment: 1 },
        }
        if (p.isWinner) {
          update.wins = { increment: 1 }
        }
        await tx.userStreamerStats.upsert({
          where: {
            userId_streamerId: {
              userId: dbUserId,
              streamerId,
            },
          },
          create: {
            userId: dbUserId,
            streamerId,
            gamesPlayed: 1,
            wins: p.isWinner ? 1 : 0,
          },
          update,
        })
      }
    })
  } catch (e) {
    console.error('[wordle][persist] persistWordleRound failed', e)
  }
}
