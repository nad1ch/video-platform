import type { DurakCard, DurakDemoUiState, DurakTablePair } from './cardTypes'

function c(id: string, suit: DurakCard['suit'], rank: DurakCard['rank']): DurakCard {
  return { id, suit, rank }
}

function pair(id: string, attacker: DurakCard, defender: DurakCard | null): DurakTablePair {
  return { id, attacker, defender }
}

/** Static demo payload — swap for orchestrator + WS snapshot later. */
export const DURAK_DEMO_UI_STATE: DurakDemoUiState = {
  localPlayer: {
    id: 'p-streamer',
    name: 'Streamer',
    cardCount: 6,
    role: 'streamer',
  },
  opponentPlayer: {
    id: 'p-chat',
    name: 'Twitch chat',
    cardCount: 6,
    role: 'chat',
  },
  localHand: [
    c('h1', 'hearts', '10'),
    c('h2', 'spades', 'K'),
    c('h3', 'diamonds', '7'),
    c('h4', 'clubs', 'A'),
    c('h5', 'hearts', '6'),
    c('h6', 'clubs', '9'),
  ],
  opponentHandPlaceholders: [
    c('o1', 'spades', '6'),
    c('o2', 'spades', '6'),
    c('o3', 'spades', '6'),
    c('o4', 'spades', '6'),
    c('o5', 'spades', '6'),
    c('o6', 'spades', '6'),
  ],
  deckCount: 18,
  trumpCard: c('trump', 'diamonds', 'Q'),
  tableCards: [
    pair('t1', c('a1', 'clubs', '8'), c('d1', 'clubs', '10')),
    pair('t2', c('a2', 'hearts', 'J'), null),
    pair('t3', c('a3', 'spades', '7'), null),
  ],
  turn: 'local',
  phase: 'defend',
  statusText: 'Demo: defend the table. Server state will replace this text later.',
}
