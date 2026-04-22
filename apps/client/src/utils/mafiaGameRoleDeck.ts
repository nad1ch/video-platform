import type { MafiaRole } from './mafiaGameTypes'

export class MafiaPlayerCountError extends Error {
  readonly n: number

  constructor(n: number, message: string = 'Mafia: player count must be between 5 and 12') {
    super(message)
    this.name = 'MafiaPlayerCountError'
    this.n = n
  }
}

const SPECIAL = 1 + 1 // sheriff + doctor

/**
 * Role counts by rules:
 * 5–6 → 1 mafia
 * 7–8 → 1 mafia + 1 don
 * 9–12 → 2 mafia + 1 don
 * Always: 1 sheriff, 1 doctor. Remainder: civilians.
 */
export function buildMafiaRoleDeck(n: number): MafiaRole[] {
  if (n < 5 || n > 12) {
    throw new MafiaPlayerCountError(n)
  }

  let mafia: number
  let don: number
  if (n <= 6) {
    mafia = 1
    don = 0
  } else if (n <= 8) {
    mafia = 1
    don = 1
  } else {
    mafia = 2
    don = 1
  }

  const out: MafiaRole[] = []
  for (let i = 0; i < mafia; i += 1) {
    out.push('mafia')
  }
  for (let i = 0; i < don; i += 1) {
    out.push('don')
  }
  out.push('sheriff', 'doctor')
  const fixed = mafia + don + SPECIAL
  if (n < fixed) {
    throw new Error('mafiaGameRoleDeck: inconsistent N')
  }
  const civ = n - fixed
  for (let i = 0; i < civ; i += 1) {
    out.push('civilian')
  }
  if (out.length !== n) {
    throw new Error('mafiaGameRoleDeck: deck length mismatch')
  }
  return out
}
