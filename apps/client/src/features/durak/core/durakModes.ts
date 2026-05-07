export type DurakGameMode = 'matchmaking' | 'friend' | 'bots'

export type DurakPlayerCount = 2 | 3 | 4 | 5 | 6

export type DurakLobbyView = 'lobby' | 'searching' | 'friend-room' | 'demo-table'

export const DURAK_PLAYER_COUNTS: readonly DurakPlayerCount[] = [2, 3, 4, 5, 6]

export const DURAK_GAME_MODES: readonly DurakGameMode[] = ['matchmaking', 'friend', 'bots']

export function isDurakPlayerCount(n: number): n is DurakPlayerCount {
  return n === 2 || n === 3 || n === 4 || n === 5 || n === 6
}
