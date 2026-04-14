export type Game = {
  id: string
  word: string
  startedAt: number
}

export type GuessFeedback = 'correct' | 'present' | 'absent'

export type GuessRow = {
  guess: string
  feedback: GuessFeedback[]
}

export type PlayerState = {
  userId: string
  displayName: string
  attempts: number
  guessed: boolean
  guessedAt?: number
  rows: GuessRow[]
}

export type Store = {
  currentGame: Game
  players: Record<string, PlayerState>
}

export type GameStatePayload = {
  gameId: string
  wordLength: number
  startedAt: number
  players: Array<{
    userId: string
    displayName: string
    attempts: number
    guessed: boolean
    rows: GuessRow[]
  }>
}

export type LeaderboardEntry = {
  position: number
  userId: string
  displayName: string
  attempts: number
  guessed: boolean
  guessedAt?: number
}

export type SessionUser = {
  id: string
  display_name: string
  profile_image_url: string
}
