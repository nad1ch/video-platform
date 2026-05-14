import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard: Vue 3 Boolean prop coercion turns absent Boolean props
 * into `false`. On the Mafia route, `gameHostShowLifeToggle` is absent and
 * becomes `false`. With `??`, `false ?? props.mafiaHostShowLifeToggle`
 * evaluates to `false` and the Mafia host kill/revive hover button
 * disappears. The fallback MUST stay `||`. See block 25/26 audit history.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const participantTilePath = path.resolve(
  here,
  '../../apps/client/src/components/call/ParticipantTile.vue',
)
const source = readFileSync(participantTilePath, 'utf8')

describe('ParticipantTile.vue Boolean fallback regression guard', () => {
  it('resolvedHostShowLifeToggle binding is defined', () => {
    expect(source).toMatch(/const resolvedHostShowLifeToggle = computed/)
  })

  it('resolvedHostShowLifeToggle uses || between game/mafia props', () => {
    expect(source).toMatch(
      /props\.gameHostShowLifeToggle\s*\|\|\s*props\.mafiaHostShowLifeToggle/,
    )
  })

  it('resolvedHostShowLifeToggle never falls back to ?? between game/mafia props', () => {
    expect(source).not.toMatch(
      /props\.gameHostShowLifeToggle\s*\?\?\s*props\.mafiaHostShowLifeToggle/,
    )
  })

  it('resolvedLayerViewportObserve binding is defined', () => {
    expect(source).toMatch(/const resolvedLayerViewportObserve = computed/)
  })

  it('resolvedLayerViewportObserve uses || between game/mafia props', () => {
    expect(source).toMatch(
      /props\.gameLayerViewportObserve\s*\|\|\s*props\.mafiaLayerViewportObserve/,
    )
  })

  it('resolvedLayerViewportObserve never falls back to ?? between game/mafia props', () => {
    expect(source).not.toMatch(
      /props\.gameLayerViewportObserve\s*\?\?\s*props\.mafiaLayerViewportObserve/,
    )
  })
})
