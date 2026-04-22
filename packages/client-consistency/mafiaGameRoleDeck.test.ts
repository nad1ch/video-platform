import { describe, expect, it } from 'vitest'
import { buildMafiaRoleDeck, MafiaPlayerCountError } from '../../apps/client/src/utils/mafiaGameRoleDeck'

function countByRole(deck: string[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const r of deck) {
    m[r] = (m[r] ?? 0) + 1
  }
  return m
}

describe('buildMafiaRoleDeck', () => {
  it('5–6: 1 mafia, no don; always sheriff + doctor', () => {
    for (const n of [5, 6]) {
      const d = buildMafiaRoleDeck(n)
      expect(d).toHaveLength(n)
      const c = countByRole(d)
      expect(c.sheriff).toBe(1)
      expect(c.doctor).toBe(1)
      expect(c.mafia).toBe(1)
      expect(c.don).toBeUndefined()
    }
  })

  it('7–8: 1 mafia, 1 don; always sheriff + doctor', () => {
    for (const n of [7, 8]) {
      const d = buildMafiaRoleDeck(n)
      expect(d).toHaveLength(n)
      const c = countByRole(d)
      expect(c.sheriff).toBe(1)
      expect(c.doctor).toBe(1)
      expect(c.mafia).toBe(1)
      expect(c.don).toBe(1)
    }
  })

  it('9–12: 2 mafia, 1 don; always sheriff + doctor', () => {
    for (const n of [9, 10, 11, 12]) {
      const d = buildMafiaRoleDeck(n)
      expect(d).toHaveLength(n)
      const c = countByRole(d)
      expect(c.sheriff).toBe(1)
      expect(c.doctor).toBe(1)
      expect(c.mafia).toBe(2)
      expect(c.don).toBe(1)
      const civ = c.civilian ?? 0
      const fixed = 2 + 1 + 1 + 1
      expect(civ + fixed).toBe(n)
    }
  })

  it('rejects n outside 5–12', () => {
    expect(() => buildMafiaRoleDeck(4)).toThrow(MafiaPlayerCountError)
    expect(() => buildMafiaRoleDeck(13)).toThrow(MafiaPlayerCountError)
  })
})
