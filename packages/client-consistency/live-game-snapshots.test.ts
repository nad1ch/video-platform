import { describe, expect, it } from 'vitest'
import { createInitialCheckersState } from '../../apps/client/src/features/checkers/core/checkersEngine'
import { parseCheckersLiveRoomSnapshot } from '../../apps/server/src/checkers/checkersLiveRoomPersistence'
import { parseNadleLiveGameSnapshot } from '../../apps/server/src/nadle/liveGamePersistence'
import { parseNadrawLiveRoomSnapshot } from '../../apps/server/src/nadraw-show/nadrawLiveRoomPersistence'

describe('durable live game snapshots', () => {
  it('accepts a versioned Nadle live-game snapshot', () => {
    const parsed = parseNadleLiveGameSnapshot({
      schemaVersion: 1,
      currentGame: { id: 'round-1', word: 'слово', startedAt: 1 },
      players: {
        user1: {
          userId: 'user1',
          displayName: 'Player',
          attempts: 1,
          guessed: false,
          rows: [{ guess: 'казка', feedback: ['absent', 'present', 'absent', 'absent', 'correct'] }],
        },
      },
    })

    expect(parsed?.currentGame.id).toBe('round-1')
    expect(parsed?.players.user1?.rows).toHaveLength(1)
  })

  it('accepts a versioned Checkers room snapshot', () => {
    const parsed = parseCheckersLiveRoomSnapshot({
      schemaVersion: 1,
      state: createInitialCheckersState(),
      meta: {
        mode: 'friend',
        player1: 'client-1',
        player2: 'client-2',
        rematchAccepted: ['client-1'],
        lastMove: null,
        botDifficulty: 'medium',
      },
    })

    expect(parsed?.meta.mode).toBe('friend')
    expect(parsed?.meta.rematchAccepted).toEqual(['client-1'])
    expect(parsed?.state.board).toHaveLength(8)
  })

  it('accepts a versioned Nadraw room snapshot with replay history', () => {
    const parsed = parseNadrawLiveRoomSnapshot({
      schemaVersion: 1,
      room: {
        streamerId: 'streamer-1',
        phase: 'drawing_active',
        currentWord: 'cat',
        revealed: [false, false, false],
        startedAt: 1,
        unlockAt: 2,
        endsAt: 3,
        sessionPlannedRounds: 1,
        sessionCompletedRounds: 0,
        sessionWordSource: 'random',
        sessionRoundDurationSec: 180,
        breakHadWinner: false,
        breakWinnerDisplayName: '',
        breakSessionFinished: false,
        nextRoundWordDraft: '',
        roundId: 'round-1',
      },
      drawOps: [{ phase: 'start', strokeId: 'stroke-1', x: 0.1, y: 0.2 }],
      chatEvents: [{ kind: 'chat', userId: 'u1', displayName: 'Viewer', text: 'hello' }],
    })

    expect(parsed?.room.phase).toBe('drawing_active')
    expect(parsed?.drawOps).toHaveLength(1)
    expect(parsed?.chatEvents).toHaveLength(1)
  })
})
