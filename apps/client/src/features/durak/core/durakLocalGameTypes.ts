import type { DurakCard, DurakCardSuit, DurakTablePair } from './cardTypes'

export type DurakLocalPhase = 'attack' | 'defend'

/** Local two-player snapshot; mirrors a future server round snapshot shape. */
export type DurakLocalSnapshot = {
  hands: [DurakCard[], DurakCard[]]
  stock: DurakCard[]
  trumpSuit: DurakCardSuit
  /** Bottom-of-stock at last deal; used when stock is empty for display. */
  trumpCard: DurakCard
  table: DurakTablePair[]
  attackerIndex: 0 | 1
  defenderIndex: 0 | 1
  phase: DurakLocalPhase
  turnIndex: 0 | 1
  nextRowSeq: number
  lastErrorKey: string | null
}

export type DurakLocalOk = { ok: true; snapshot: DurakLocalSnapshot }

export type DurakLocalErr = { ok: false; snapshot: DurakLocalSnapshot; errorKey: string }

export type DurakLocalResult = DurakLocalOk | DurakLocalErr
