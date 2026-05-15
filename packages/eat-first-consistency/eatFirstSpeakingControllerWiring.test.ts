import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Regression guards proving Eat First uses the SHARED
 * `speakingNominationController` for the speaking-queue / "put to vote"
 * flow, and is NOT a copied implementation:
 *
 *   - the shell store delegates `appendSpeakingNominationPair`,
 *     `removeSpeakingNominationPairAt`, and `applySpeakingQueueFromSignaling`
 *     to the controller's pure helpers
 *   - the shell store host-gates `toggleSpeakingMode`
 *   - `eatFirstPlayerOrderSwap.ts` delegates the seat-swap remap to the
 *     controller (single source of truth for the remap)
 *   - `CallPage.vue` routes the EatFirst tile-click branch through
 *     `decideSpeakingTileClick` so collision toasts surface identically to
 *     Mafia / Game Template
 *   - the new collision-toast i18n keys exist under `eatFirstCall` in every
 *     locale
 *
 * The audit asserts wiring shapes, not specific text, so the locale files
 * are free to evolve.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
function read(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8')
}

const shell = read('apps/client/src/stores/eatFirstCallShell.ts')
const swapHelper = read('apps/client/src/eat-first/utils/eatFirstPlayerOrderSwap.ts')
const callPage = read('apps/client/src/components/call/CallPage.vue')
const controller = read('apps/client/src/utils/speakingNominationController.ts')

const localePaths = [
  'apps/client/src/eat-first/locales/en.json',
  'apps/client/src/eat-first/locales/uk.json',
  'apps/client/src/eat-first/locales/de.json',
  'apps/client/src/eat-first/locales/pl.json',
] as const

describe('Eat First shell store delegates to the shared speaking-nomination controller', () => {
  it('imports the controller helpers (no local re-implementation)', () => {
    expect(shell).toMatch(/from\s+['"]@\/utils\/speakingNominationController['"]/)
    expect(shell).toMatch(/appendSpeakingPair/)
    expect(shell).toMatch(/removeSpeakingPairAt/)
    expect(shell).toMatch(/applySpeakingQueueFromSignalingShared/)
  })

  it('appendSpeakingNominationPair delegates to the shared `appendSpeakingPair`', () => {
    expect(shell).toMatch(
      /function appendSpeakingNominationPair[\s\S]*?appendSpeakingPair\(speakingQueue\.value,\s*by,\s*target\)/,
    )
  })

  it('removeSpeakingNominationPairAt delegates to the shared `removeSpeakingPairAt`', () => {
    expect(shell).toMatch(
      /function removeSpeakingNominationPairAt[\s\S]*?removeSpeakingPairAt\(speakingQueue\.value,\s*pairIndex\)/,
    )
  })

  it('applySpeakingQueueFromSignaling delegates to the shared controller and host-preserves the draft', () => {
    expect(shell).toMatch(
      /function applySpeakingQueueFromSignaling[\s\S]*?applySpeakingQueueFromSignalingShared\(seats,\s*\{[\s\S]*?isHost:\s*isEatFirstRoomHost\.value/,
    )
    expect(shell).toMatch(
      /function applySpeakingQueueFromSignaling[\s\S]*?if \(shouldClearDraft\) clearSpeakingNominationDraft\(\)/,
    )
  })

  it('toggleSpeakingMode is host-gated (parity with Mafia setHostInteractionMode)', () => {
    expect(shell).toMatch(
      /function toggleSpeakingMode\(\)[\s\S]*?if \(!isEatFirstRoomHost\.value\) return[\s\S]*?speakingMode\.value\s*=\s*!speakingMode\.value/,
    )
  })

  it('the shell store does NOT inline its own pair-encoding integer filter (single source of truth)', () => {
    // The old inline `for (const x of seats) ... push(x)` loop must be gone.
    expect(shell).not.toMatch(/for\s*\(\s*const\s+x\s+of\s+seats\s*\)/)
  })
})

describe('Eat First swap helper delegates the queue remap to the shared controller', () => {
  it('imports `remapSpeakingQueueForSeatSwap` from the controller', () => {
    expect(swapHelper).toMatch(
      /import\s*\{\s*remapSpeakingQueueForSeatSwap\s*\}\s*from\s+['"]@\/utils\/speakingNominationController['"]/,
    )
  })

  it('remapEatFirstSpeakingQueueForSwap is a thin pass-through (no inline loop)', () => {
    expect(swapHelper).toMatch(
      /function remapEatFirstSpeakingQueueForSwap[\s\S]*?return remapSpeakingQueueForSeatSwap\(queue,\s*seatA,\s*seatB\)/,
    )
    // Previously the helper had its own `for (let i = 0; i < queue.length; i++)` loop
    // — it must be removed now that the controller owns the implementation.
    expect(swapHelper).not.toMatch(/for \(let i = 0; i < queue\.length; i\+\+\)/)
  })

  it('shell store still calls remapEatFirstSpeakingQueueForSwap (backwards-compat path preserved)', () => {
    expect(shell).toMatch(
      /remapEatFirstSpeakingQueueForSwap\(speakingQueue\.value,\s*seatA,\s*seatB\)/,
    )
  })
})

describe('CallPage tile-click router routes EatFirst speaking-mode through the controller', () => {
  it('imports `decideSpeakingTileClick` from the controller', () => {
    expect(callPage).toMatch(
      /import\s*\{\s*decideSpeakingTileClick\s*\}\s*from\s+['"]@\/utils\/speakingNominationController['"]/,
    )
  })

  it('invokes decideSpeakingTileClick with EatFirst state at the tile click', () => {
    expect(callPage).toMatch(
      /decideSpeakingTileClick\(\{[\s\S]*?mode:\s*'speaking'[\s\S]*?seat,\s*\n[\s\S]*?draft:\s*eatFirstShell\.speakingNominationDraftBySeat[\s\S]*?queue:\s*eatFirstShell\.speakingQueue/,
    )
  })

  it('dispatches all five intent kinds (set-draft, clear-draft, append-pair, two collisions)', () => {
    expect(callPage).toMatch(/case\s+'set-draft'\s*:[\s\S]*?eatFirstShell\.setSpeakingNominationDraftBySeat\(intent\.seat\)/)
    expect(callPage).toMatch(/case\s+'clear-draft'\s*:[\s\S]*?eatFirstShell\.setSpeakingNominationDraftBySeat\(null\)/)
    expect(callPage).toMatch(/case\s+'append-pair'\s*:[\s\S]*?eatFirstShell\.appendSpeakingNominationPair\(intent\.by,\s*intent\.target\)/)
    expect(callPage).toMatch(/case\s+'reject-duplicate-by'\s*:/)
    expect(callPage).toMatch(/case\s+'reject-duplicate-target'\s*:/)
  })

  it('surfaces the duplicate-by toast with Eat First i18n key', () => {
    expect(callPage).toMatch(
      /pushCallToast\([\s\S]*?t\('eatFirstCall\.speakingByAlreadyNominatedToast',\s*\{[\s\S]*?by:\s*intent\.bySeat[\s\S]*?target:\s*intent\.existingTarget/,
    )
  })

  it('surfaces the duplicate-target toast with Eat First i18n key', () => {
    expect(callPage).toMatch(
      /pushCallToast\([\s\S]*?t\('eatFirstCall\.speakingTargetAlreadyNominatedToast',\s*\{[\s\S]*?target:\s*intent\.targetSeat[\s\S]*?by:\s*intent\.existingBySeat\s*\?\?\s*'\?'/,
    )
  })

  it('honors clearDraftAfter when the duplicate-by intent says so', () => {
    expect(callPage).toMatch(
      /case\s+'reject-duplicate-by'\s*:[\s\S]*?if \(intent\.clearDraftAfter\)[\s\S]*?eatFirstShell\.setSpeakingNominationDraftBySeat\(null\)/,
    )
  })
})

describe('Shared controller hard-isolation contract', () => {
  it('controller has no Vue / Pinia / WS / store / i18n / ParticipantTile imports', () => {
    // No imports at all; the module is purely self-contained. (The other
    // checks below are kept as defense-in-depth in case anyone adds an
    // import later — they look for `from '…'` import-clauses only, not
    // docstring text.)
    expect(controller).not.toMatch(/^import\b/m)
    expect(controller).not.toMatch(/from\s+['"]vue['"]/)
    expect(controller).not.toMatch(/from\s+['"]pinia['"]/)
    expect(controller).not.toMatch(/from\s+['"]vue-i18n['"]/)
    expect(controller).not.toMatch(/from\s+['"]@\/stores\//)
    expect(controller).not.toMatch(/from\s+['"]@\/composables\//)
    expect(controller).not.toMatch(/from\s+['"]@\/eat-first\//)
    expect(controller).not.toMatch(/from\s+['"]@\/components\//)
    expect(controller).not.toMatch(/from\s+['"]@\/server\//)
  })

  it('controller exports every public symbol Eat First (and future Mafia / Game Template) adapters rely on', () => {
    expect(controller).toMatch(/export type SpeakingMode/)
    expect(controller).toMatch(/export type SpeakingNominationSegment/)
    expect(controller).toMatch(/export type SpeakingTileClickInput/)
    expect(controller).toMatch(/export type SpeakingTileClickIntent/)
    expect(controller).toMatch(/export function decodeSpeakingQueue/)
    expect(controller).toMatch(/export function decideSpeakingTileClick/)
    expect(controller).toMatch(/export function appendSpeakingPair/)
    expect(controller).toMatch(/export function removeSpeakingPairAt/)
    expect(controller).toMatch(/export function normalizeSpeakingQueueToPairs/)
    expect(controller).toMatch(/export function applySpeakingQueueFromSignaling/)
    expect(controller).toMatch(/export function remapSpeakingQueueForSeatSwap/)
    expect(controller).toMatch(/export function transitionSpeakingMode/)
  })
})

describe('EatFirst collision-toast i18n keys are present in every locale', () => {
  for (const rel of localePaths) {
    it(`${rel} declares speakingByAlreadyNominatedToast + speakingTargetAlreadyNominatedToast under eatFirstCall`, () => {
      const raw = read(rel)
      const parsed = JSON.parse(raw) as Record<string, Record<string, string>>
      const ef = parsed.eatFirstCall
      expect(ef, `${rel}: missing eatFirstCall namespace`).toBeTruthy()
      expect(typeof ef.speakingByAlreadyNominatedToast).toBe('string')
      expect(ef.speakingByAlreadyNominatedToast.length).toBeGreaterThan(2)
      expect(ef.speakingByAlreadyNominatedToast).toMatch(/\{by\}/)
      expect(ef.speakingByAlreadyNominatedToast).toMatch(/\{target\}/)
      expect(typeof ef.speakingTargetAlreadyNominatedToast).toBe('string')
      expect(ef.speakingTargetAlreadyNominatedToast.length).toBeGreaterThan(2)
      expect(ef.speakingTargetAlreadyNominatedToast).toMatch(/\{target\}/)
      expect(ef.speakingTargetAlreadyNominatedToast).toMatch(/\{by\}/)
    })
  }
})
