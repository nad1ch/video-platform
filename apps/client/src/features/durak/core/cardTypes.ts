export type DurakCardSuit = 'clubs' | 'diamonds' | 'hearts' | 'spades'

export type DurakCardRank = '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export type DurakCard = {
  id: string
  suit: DurakCardSuit
  rank: DurakCardRank
}

export type DurakPlayerRole = 'streamer' | 'chat'

export type DurakPublicPlayer = {
  id: string
  name: string
  cardCount: number
  role: DurakPlayerRole
}

export type DurakDemoPhase = 'idle' | 'attack' | 'defend' | 'take' | 'discard'

export type DurakTablePair = {
  id: string
  attacker: DurakCard
  defender: DurakCard | null
}

export type DurakTurn = 'local' | 'opponent'

/** Shape-only UI model for future server-driven state (orchestrator-ready). */
export type DurakDemoUiState = {
  localPlayer: DurakPublicPlayer
  opponentPlayer: DurakPublicPlayer
  localHand: DurakCard[]
  opponentHandPlaceholders: DurakCard[]
  deckCount: number
  trumpCard: DurakCard
  tableCards: DurakTablePair[]
  turn: DurakTurn
  phase: DurakDemoPhase
  statusText: string
}
