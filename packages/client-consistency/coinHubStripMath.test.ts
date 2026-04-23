import { describe, expect, it } from 'vitest'
import {
  buildCaseStripCells,
  buildSpinStripCells,
  endTranslateX,
  getSpinRarity,
  mapSlotMachineProgress,
  mapSpinScrollProgress,
} from '@/utils/coinHub/coinHubStripMath'

/** Avoids optional near-100 inject and extended tease so tease triplets stay predictable. */
const stableSpinRng = () => 0.99

describe('endTranslateX', () => {
  it('centers land index 0 in viewport', () => {
    expect(endTranslateX(200, 40, 0)).toBe(80)
  })
  it('aligns later cells with negative translate', () => {
    const t = endTranslateX(200, 40, 5)
    expect(t).toBeLessThan(0)
  })
})

describe('getSpinRarity', () => {
  it('maps tiers for strip styling (value bands)', () => {
    expect(getSpinRarity(3)).toBe('common')
    expect(getSpinRarity(8)).toBe('common')
    expect(getSpinRarity(12)).toBe('uncommon')
    expect(getSpinRarity(19)).toBe('uncommon')
    expect(getSpinRarity(20)).toBe('rare')
    expect(getSpinRarity(35)).toBe('rare')
    expect(getSpinRarity(50)).toBe('epic')
    expect(getSpinRarity(99)).toBe('epic')
    expect(getSpinRarity(100)).toBe('legendary')
  })
})

describe('buildSpinStripCells', () => {
  it('places server target on landIndex; optional padding may follow (not last array index)', () => {
    const { cells, landIndex } = buildSpinStripCells(50, { rng: stableSpinRng })
    expect(cells[landIndex]!.display).toBe('50')
    expect(landIndex).toBeLessThan(cells.length)
  })
  it('keeps a long tape: 5× visual pool + weighted filler + optional near-100 + 3-step tease + right pad', () => {
    const { cells, landIndex } = buildSpinStripCells(3, { rng: stableSpinRng })
    expect(cells.length).toBeGreaterThanOrEqual(9 * 5 + 24 + 3 + 10)
    expect(cells[landIndex]!.display).toBe('3')
    expect(cells.slice(landIndex - 2, landIndex + 1).map((c) => c.display)).toEqual(['100', '50', '3'])
  })
  it('avoids double 50 in the tease when the win is 50 (near 100, then 25, then win)', () => {
    const { cells, landIndex } = buildSpinStripCells(50, { rng: stableSpinRng })
    expect(cells.slice(landIndex - 2, landIndex + 1).map((c) => c.display)).toEqual(['100', '25', '50'])
  })
})

describe('mapSlotMachineProgress / mapSpinScrollProgress', () => {
  it('is 0 and 1 at the ends', () => {
    expect(mapSlotMachineProgress(0)).toBe(0)
    expect(mapSlotMachineProgress(1)).toBe(1)
    expect(mapSpinScrollProgress(0)).toBe(0)
    expect(mapSpinScrollProgress(1)).toBe(1)
  })
  it('is monotonic in [0, 1]', () => {
    let prev = mapSlotMachineProgress(0)
    for (let i = 1; i <= 50; i += 1) {
      const u = i / 50
      const p = mapSlotMachineProgress(u)
      expect(p + 1e-9).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })
})

describe('buildCaseStripCells', () => {
  it('places target line at landIndex', () => {
    const { cells, landIndex } = buildCaseStripCells('+99 coins')
    expect(cells[landIndex]).toBe('+99 coins')
  })
})
