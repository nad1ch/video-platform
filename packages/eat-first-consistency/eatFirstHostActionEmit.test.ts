import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard: the Eat First host actions adapter must
 *   - mount the shared `<GameHostActionsBar>`
 *   - hide the swap button via `:show-swap="false"`
 *   - declare the `force-mute-all` and `reshuffle` outward emits CallPage relies on
 *   - never reference Mafia's `'night'` or Game Template's `'idle'`
 *     interaction-mode strings (Eat First has no generic swap mechanic)
 *   - never import Mafia / GameRoom stores or WS protocols
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const adapterPath = path.resolve(
  here,
  '../../apps/client/src/eat-first/components/EatFirstHostActionsBar.vue',
)
const source = readFileSync(adapterPath, 'utf8')

describe('EatFirstHostActionsBar.vue adapter contract', () => {
  it('imports and mounts the shared GameHostActionsBar', () => {
    expect(source).toMatch(
      /import\s+GameHostActionsBar[\s\S]*?from\s+['"]@\/components\/game-call\/GameHostActionsBar\.vue['"]/,
    )
    expect(source).toMatch(/<GameHostActionsBar/)
  })

  it('binds :show-swap="false"', () => {
    expect(source).toMatch(/:show-swap="false"/)
  })

  it('declares the force-mute-all emit', () => {
    expect(source).toMatch(/'force-mute-all':\s*\[muted:\s*boolean\]/)
  })

  it('declares the reshuffle emit', () => {
    expect(source).toMatch(/\breshuffle:\s*\[\]/)
  })

  it('does not reference Mafia/GameRoom off-state literals', () => {
    expect(source).not.toMatch(/'night'/)
    expect(source).not.toMatch(/'idle'/)
  })

  it('does not import Mafia or GameRoom stores / protocols', () => {
    expect(source).not.toMatch(/useMafia/)
    expect(source).not.toMatch(/MafiaWs/)
    expect(source).not.toMatch(/useGameRoom/)
    expect(source).not.toMatch(/GameRoomWs/)
    expect(source).not.toMatch(/mafiaGameStore/)
    expect(source).not.toMatch(/gameTemplateGame/)
  })

  it('uses the Eat First shell store', () => {
    expect(source).toMatch(/useEatFirstCallShellStore/)
  })
})
