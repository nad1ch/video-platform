import { describe, expect, it } from 'vitest'
import { DURAK_GAME_MODES, DURAK_PLAYER_COUNTS, isDurakPlayerCount } from '../../apps/client/src/features/durak/core/durakModes'

describe('durakModes', () => {
  it('includes player counts 2 through 6', () => {
    expect(DURAK_PLAYER_COUNTS).toEqual([2, 3, 4, 5, 6])
  })

  it('isDurakPlayerCount guards range', () => {
    expect(isDurakPlayerCount(2)).toBe(true)
    expect(isDurakPlayerCount(6)).toBe(true)
    expect(isDurakPlayerCount(1)).toBe(false)
    expect(isDurakPlayerCount(7)).toBe(false)
  })

  it('lists all game modes', () => {
    expect(DURAK_GAME_MODES).toEqual(['matchmaking', 'friend', 'bots'])
  })
})
