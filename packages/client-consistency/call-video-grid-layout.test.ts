import { describe, expect, it } from 'vitest'
import {
  CALL_GRID_MAX_COLS,
  computeCallVideoGridLayout,
} from '../../apps/client/src/components/call/callVideoGridLayout'

/** Same as CallPage active call: GAP, MIN_TILE_WIDTH, GRID_CONTENT_INSET_PX */
const PAGE_PARAMS = {
  gapPx: 12,
  minTileWidthPx: 180,
  contentInsetPx: 12,
} as const

/** Typical landscape stage (after padding) — golden cols/rows are stable for this size. */
const STAGE_W = 1600
const STAGE_H = 900

describe('computeCallVideoGridLayout (call gallery)', () => {
  it('n=0 → empty grid', () => {
    const g = computeCallVideoGridLayout(0, STAGE_W, STAGE_H, PAGE_PARAMS)
    expect(g).toEqual({ cols: 1, rows: 0, tileWidth: 0, tileHeight: 0 })
  })

  it('never exceeds CALL_GRID_MAX_COLS columns for n=1..12', () => {
    for (let n = 1; n <= 12; n++) {
      const { cols } = computeCallVideoGridLayout(n, STAGE_W, STAGE_H, PAGE_PARAMS)
      expect(cols, `n=${n}`).toBeLessThanOrEqual(CALL_GRID_MAX_COLS)
    }
  })

  it('rows * cols fits all participants', () => {
    for (let n = 1; n <= 12; n++) {
      const g = computeCallVideoGridLayout(n, STAGE_W, STAGE_H, PAGE_PARAMS)
      expect(g.cols * g.rows, `n=${n}`).toBeGreaterThanOrEqual(n)
    }
  })

  /**
   * Product rules + best fit at 1600×900 reference stage.
   * If this fails after an intentional layout change, update the table and recheck UI.
   */
  it('golden cols×rows at reference stage', () => {
    const golden: Array<{ n: number; cols: number; rows: number }> = [
      { n: 1, cols: 1, rows: 1 },
      { n: 2, cols: 2, rows: 1 },
      { n: 3, cols: 2, rows: 2 },
      { n: 4, cols: 2, rows: 2 },
      { n: 5, cols: 3, rows: 2 },
      { n: 6, cols: 3, rows: 2 },
      { n: 7, cols: 3, rows: 3 },
      { n: 8, cols: 3, rows: 3 },
      { n: 9, cols: 3, rows: 3 },
      { n: 10, cols: 4, rows: 3 },
      { n: 11, cols: 4, rows: 3 },
      { n: 12, cols: 4, rows: 3 },
    ]
    for (const { n, cols, rows } of golden) {
      const g = computeCallVideoGridLayout(n, STAGE_W, STAGE_H, PAGE_PARAMS)
      expect({ n, cols: g.cols, rows: g.rows }, `n=${n}`).toEqual({ n, cols, rows })
    }
  })

  it('4 participants → 2×2 (not 3+1)', () => {
    const g = computeCallVideoGridLayout(4, STAGE_W, STAGE_H, PAGE_PARAMS)
    expect(g.cols).toBe(2)
    expect(g.rows).toBe(2)
  })

  it('8 participants → 3×3 (3+3+2, one empty cell)', () => {
    const g = computeCallVideoGridLayout(8, STAGE_W, STAGE_H, PAGE_PARAMS)
    expect(g.cols).toBe(3)
    expect(g.rows).toBe(3)
  })

  it('9 participants → 3×3 (not 4+4+1)', () => {
    const g = computeCallVideoGridLayout(9, STAGE_W, STAGE_H, PAGE_PARAMS)
    expect(g.cols).toBe(3)
    expect(g.rows).toBe(3)
  })

  it('positive tile metrics when n>0 and stage is large enough', () => {
    const g = computeCallVideoGridLayout(5, STAGE_W, STAGE_H, PAGE_PARAMS)
    expect(g.tileWidth).toBeGreaterThanOrEqual(PAGE_PARAMS.minTileWidthPx)
    expect(g.tileHeight).toBeGreaterThan(0)
  })

  it('same inputs → same output (stable)', () => {
    const a = computeCallVideoGridLayout(7, STAGE_W, STAGE_H, PAGE_PARAMS)
    const b = computeCallVideoGridLayout(7, STAGE_W, STAGE_H, PAGE_PARAMS)
    expect(a).toEqual(b)
  })
})
