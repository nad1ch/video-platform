import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard: the Eat First host actions adapter must
 *   - mount the shared `<GameHostActionsBar>`
 *   - SHOW the swap button (Choice A — positional player swap reuses
 *     the shared bar's swap button; the previous `:show-swap="false"`
 *     hide was removed when swap mode was implemented in Eat First)
 *   - declare the `force-mute-all` and `reshuffle` outward emits CallPage relies on
 *   - wire `@toggle-swap-mode` to the Eat First shell's host-interaction-mode setter
 *   - never reference Mafia's `'night'` interaction-mode string (Eat First's
 *     host interaction mode is `'idle' | 'swap'`, not `'night' | 'swap'`)
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

  it('does NOT bind :show-swap="false" (swap button must be visible — Choice A parity)', () => {
    expect(source).not.toMatch(/:show-swap="false"/)
  })

  it('declares the force-mute-all emit', () => {
    expect(source).toMatch(/'force-mute-all':\s*\[muted:\s*boolean\]/)
  })

  it('declares the reshuffle emit', () => {
    expect(source).toMatch(/\breshuffle:\s*\[\]/)
  })

  it('wires @toggle-swap-mode to the Eat First shell host-interaction-mode setter', () => {
    expect(source).toMatch(/swapModeActive\s*=\s*computed\([\s\S]*?hostInteractionMode\.value\s*===\s*'swap'/)
    expect(source).toMatch(/:swap-active="swapModeActive"/)
    expect(source).toMatch(/@toggle-swap-mode="onToggleSwapMode"/)
    expect(source).toMatch(
      /function onToggleSwapMode[\s\S]*?eatFirstShell\.setHostInteractionMode\(swapModeActive\.value \? 'idle' : 'swap'\)/,
    )
  })

  it('uses Eat First swap-mode i18n keys (no fake / empty strings)', () => {
    expect(source).toMatch(/swapModeTitle:\s*t\('eatFirstCall\.swapModeHint'\)/)
    expect(source).toMatch(/swapModeAria:\s*t\('eatFirstCall\.modeSwap'\)/)
    expect(source).not.toMatch(/swapModeTitle:\s*''/)
    expect(source).not.toMatch(/swapModeAria:\s*''/)
  })

  it('does not reference Mafia off-state literal (Eat First uses idle/swap, not night)', () => {
    expect(source).not.toMatch(/'night'/)
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
