import type { Prisma } from '@prisma/client'
import { isDatabaseConfigured, prisma } from '../prisma'
import { invalidateStreamerLeaderboardCache } from '../leaderboardRouter'
import { grantParticipationReward } from '../economy/earn/participationReward'

export type NadleRoundPlayer = {
  userId: string
  attempts: number
  isWinner: boolean
}

export type PersistNadleRoundInput = {
  streamerId: string
  winnerUserId: string
  players: NadleRoundPlayer[]
}

async function resolveDbUserId(
  tx: Prisma.TransactionClient,
  nadleParticipantId: string,
): Promise<string | null> {
  const byId = await tx.user.findUnique({
    where: { id: nadleParticipantId },
    select: { id: true },
  })
  if (byId) {
    return byId.id
  }
  const byTwitch = await tx.user.findFirst({
    where: { twitchId: nadleParticipantId },
    select: { id: true },
  })
  return byTwitch?.id ?? null
}





export async function persistNadleRound(input: PersistNadleRoundInput): Promise<void> {
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
        console.warn('[nadle][persist] skip persist: unknown or inactive streamerId', streamerId)
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
        // Viewer Economy: idempotent participation reward (PendingReward
        // kind='game_participation'). Keyed on (roundId, userId) so re-running
        // this persistence call cannot double-reward.
        await grantParticipationReward(tx, {
          roundId: round.id,
          game: 'nadle',
          userId: dbUserId,
          streamerId,
          isWinner: p.isWinner,
        })
      }
    })
    // Round committed — drop any cached leaderboard snapshot for this
    // streamer so the next read recomputes against fresh stats and the
    // just-finished round appears without waiting out the TTL.
    invalidateStreamerLeaderboardCache(streamerId)
  } catch (e) {
    console.error('[nadle][persist] persistNadleRound failed', e)
  }
}
