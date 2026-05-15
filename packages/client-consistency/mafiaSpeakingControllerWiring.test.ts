import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Regression guards proving that the Mafia speaking / voting nomination
 * flow now uses the SHARED `speakingNominationController` and is NOT a
 * locally-duplicated implementation. Mafia is the behavioral source of
 * truth; the controller was extracted FROM Mafia's logic, so this
 * migration is a pure refactor — zero observable behavior change:
 *
 *   - `appendSpeakingNominationPair`, `removeSpeakingNominationPairAt`,
 *     `applySpeakingQueueFromSignaling`, and `remapSpeakingQueueForSeatSwap`
 *     in `mafiaGame.ts` all delegate to controller helpers.
 *   - The tile-click router in `useMafiaCallHostUi.ts` routes the
 *     speaking-mode branch through `decideSpeakingTileClick`, dispatching
 *     all five intent kinds with the same Mafia toast keys.
 *
 * Things this guard intentionally pins down:
 *
 *   - The four delegated functions no longer carry inline copies of the
 *     decoder / pair-splice / integer-filter / odd-length-pop logic.
 *   - The Mafia tri-state `hostInteractionMode: 'night' | 'speaking' | 'swap'`
 *     stays — only the inner state-machine logic moves; the mode enum and
 *     `setHostInteractionMode`'s side-effects stay Mafia-side.
 *   - Mafia-only behavior (log lines, host gating, swap-by-peer-id, night
 *     action assignment, prune-to-max-seat) stays Mafia-side.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
function read(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8')
}

const store = read('apps/client/src/stores/mafiaGame.ts')
const hostUi = read('apps/client/src/composables/useMafiaCallHostUi.ts')

// ---------------------------------------------------------------------------
//  mafiaGame.ts — store delegations
// ---------------------------------------------------------------------------

describe('mafiaGame.ts imports the shared speaking-nomination controller', () => {
  it('imports appendSpeakingPair, removeSpeakingPairAt, applySpeakingQueueFromSignaling, and remapSpeakingQueueForSeatSwap', () => {
    expect(store).toMatch(/from\s+['"]@\/utils\/speakingNominationController['"]/)
    expect(store).toMatch(/appendSpeakingPair/)
    expect(store).toMatch(/removeSpeakingPairAt/)
    expect(store).toMatch(/applySpeakingQueueFromSignaling as applySpeakingQueueFromSignalingShared/)
    expect(store).toMatch(/remapSpeakingQueueForSeatSwap as remapSpeakingQueueForSeatSwapShared/)
  })
})

describe('mafiaGame.ts speaking-queue functions delegate to the controller', () => {
  it('appendSpeakingNominationPair host-gates, delegates to appendSpeakingPair, preserves draft-clear + log', () => {
    expect(store).toMatch(
      /function appendSpeakingNominationPair\(by:\s*number,\s*target:\s*number\)[\s\S]*?if \(!isMafiaHost\.value\)[\s\S]*?return[\s\S]*?appendSpeakingPair\(speakingQueue\.value,\s*by,\s*target\)/,
    )
    // Identity-preservation early-exit (controller returns input ref on
    // invalid seats — same effect as the original `Number.isInteger` check).
    expect(store).toMatch(
      /function appendSpeakingNominationPair[\s\S]*?if \(next === speakingQueue\.value\)/,
    )
    // Draft clear + log line preserved verbatim.
    expect(store).toMatch(
      /function appendSpeakingNominationPair[\s\S]*?clearSpeakingNominationDraft\(\)[\s\S]*?mafiaGameLog\.info\('speaking queue nomination pair'/,
    )
  })

  it('removeSpeakingNominationPairAt host-gates and delegates to removeSpeakingPairAt', () => {
    expect(store).toMatch(
      /function removeSpeakingNominationPairAt\(pairIndex:\s*number\)[\s\S]*?if \(!isMafiaHost\.value\)[\s\S]*?return[\s\S]*?removeSpeakingPairAt\(speakingQueue\.value,\s*pairIndex\)/,
    )
    expect(store).toMatch(
      /function removeSpeakingNominationPairAt[\s\S]*?if \(next === speakingQueue\.value\)/,
    )
  })

  it('applySpeakingQueueFromSignaling delegates to the shared controller and preserves host draft', () => {
    expect(store).toMatch(
      /function applySpeakingQueueFromSignaling\(seats:\s*number\[\]\)[\s\S]*?applySpeakingQueueFromSignalingShared\(seats,\s*\{[\s\S]*?isHost:\s*isMafiaHost\.value/,
    )
    expect(store).toMatch(
      /function applySpeakingQueueFromSignaling[\s\S]*?if \(shouldClearDraft\)[\s\S]*?clearSpeakingNominationDraft\(\)/,
    )
  })

  it('remapSpeakingQueueForSeatSwap delegates to the shared controller (and spreads to preserve always-reallocate semantic)', () => {
    expect(store).toMatch(
      /function remapSpeakingQueueForSeatSwap\(seatA:\s*number,\s*seatB:\s*number\)[\s\S]*?if \(seatA === seatB\)[\s\S]*?return[\s\S]*?remapSpeakingQueueForSeatSwapShared\(speakingQueue\.value,\s*seatA,\s*seatB\)/,
    )
    // The unconditional `[...]` spread is critical: the shared helper is
    // identity-preserving on no-op, but Mafia's original `.map()` always
    // allocated. Preserve the identity-changing semantic for the swap path.
    expect(store).toMatch(
      /function remapSpeakingQueueForSeatSwap[\s\S]*?speakingQueue\.value\s*=\s*\[[\s\S]*?\.\.\.remapSpeakingQueueForSeatSwapShared/,
    )
  })
})

describe('mafiaGame.ts no longer carries the local copies of speaking-queue logic', () => {
  it('appendSpeakingNominationPair has no inline pair-encoded append', () => {
    // The original body included `[...speakingQueue.value, by, target]` —
    // that inline append must be gone now that the controller owns it.
    expect(store).not.toMatch(/\[\.\.\.speakingQueue\.value,\s*by,\s*target\]/)
  })

  it('applySpeakingQueueFromSignaling has no inline integer filter or odd-length pop', () => {
    // The previous `for (const x of seats) ... push(x)` integer filter
    // lived in this function; it must be gone now that the controller owns
    // the normalization.
    expect(store).not.toMatch(/for\s*\(\s*const\s+x\s+of\s+seats\s*\)/)
    expect(store).not.toMatch(/if \(next\.length % 2 === 1\)\s*\{\s*next\.pop\(\)/)
  })

  it('remapSpeakingQueueForSeatSwap no longer uses an inline `.map(n => ...)` ternary', () => {
    expect(store).not.toMatch(/speakingQueue\.value\.map\(\(n\)\s*=>\s*\n?\s*n === seatA \? seatB : n === seatB \? seatA : n,?\s*\)/)
  })
})

// ---------------------------------------------------------------------------
//  mafiaGame.ts — Mafia-specific surfaces preserved
// ---------------------------------------------------------------------------

describe('mafiaGame.ts Mafia-specific surfaces stay Mafia-side', () => {
  it('hostInteractionMode is the Mafia tri-state enum', () => {
    expect(store).toMatch(/hostInteractionMode\s*=\s*ref<MafiaHostInteractionMode>\('night'\)/)
  })

  it('setHostInteractionMode keeps inline mode side-effects (mode !== swap clears swap sel, mode !== speaking clears draft)', () => {
    expect(store).toMatch(
      /function setHostInteractionMode\(mode:\s*MafiaHostInteractionMode\)[\s\S]*?if \(mode !== 'swap'\)[\s\S]*?hostSeatSwapSelectionPeerId\.value\s*=\s*null[\s\S]*?if \(mode !== 'speaking'\)[\s\S]*?clearSpeakingNominationDraft\(\)/,
    )
  })

  it('clearSpeakingQueue keeps its Mafia-specific length guard + log', () => {
    expect(store).toMatch(
      /function clearSpeakingQueue\(\)[\s\S]*?if \(!isMafiaHost\.value\)[\s\S]*?return[\s\S]*?if \(speakingQueue\.value\.length === 0\)[\s\S]*?return[\s\S]*?speakingQueue\.value\s*=\s*\[\][\s\S]*?clearSpeakingNominationDraft\(\)[\s\S]*?mafiaGameLog\.info\('speaking queue cleared'\)/,
    )
  })

  it('pruneSpeakingQueueToMaxSeat is preserved (Mafia-specific seat-cap pruning)', () => {
    expect(store).toMatch(/function pruneSpeakingQueueToMaxSeat\(maxSeat:\s*number\)/)
  })

  it('swapSeatsByPeerId still calls remapSpeakingQueueForSeatSwap', () => {
    expect(store).toMatch(/function swapSeatsByPeerId[\s\S]*?remapSpeakingQueueForSeatSwap\(seatA,\s*seatB\)/)
  })

  it('buildPlayersUpdatePayloadFromState still copies speakingQueue into the broadcast payload (swap path)', () => {
    expect(store).toMatch(
      /function buildPlayersUpdatePayloadFromState[\s\S]*?speakingQueue:\s*\[\.\.\.speakingQueue\.value\]/,
    )
  })
})

// ---------------------------------------------------------------------------
//  useMafiaCallHostUi.ts — tile-click router migration
// ---------------------------------------------------------------------------

describe('useMafiaCallHostUi.ts routes the speaking-mode tile click through the controller', () => {
  it('imports decideSpeakingTileClick from the controller', () => {
    expect(hostUi).toMatch(
      /import\s*\{\s*decideSpeakingTileClick\s*\}\s*from\s+['"]@\/utils\/speakingNominationController['"]/,
    )
  })

  it('no longer imports the inline decoder (controller handles decoding internally)', () => {
    expect(hostUi).not.toMatch(/import\s*\{\s*decodeSpeakingNominationFlat[\s\S]*?\}\s*from/)
  })

  it('still imports nominationTargetSeatsFromSpeakingFlat (host seat-highlight predicate stays inline)', () => {
    expect(hostUi).toMatch(
      /import\s*\{\s*nominationTargetSeatsFromSpeakingFlat\s*\}\s*from\s+['"]@\/utils\/speakingNominationQueue['"]/,
    )
  })

  it('the speaking branch invokes decideSpeakingTileClick with Mafia store state', () => {
    expect(hostUi).toMatch(
      /if \(mafiaGameStore\.hostInteractionMode === 'speaking'\)[\s\S]*?decideSpeakingTileClick\(\{[\s\S]*?mode:\s*'speaking'[\s\S]*?seat,\s*\n[\s\S]*?draft:\s*mafiaGameStore\.speakingNominationDraftBySeat[\s\S]*?queue:\s*mafiaGameStore\.speakingQueue/,
    )
  })

  it('dispatches all five intent kinds (set-draft / clear-draft / append-pair / two collisions)', () => {
    expect(hostUi).toMatch(/case\s+'set-draft'\s*:[\s\S]*?mafiaGameStore\.setSpeakingNominationDraftBySeat\(intent\.seat\)/)
    expect(hostUi).toMatch(/case\s+'clear-draft'\s*:[\s\S]*?mafiaGameStore\.setSpeakingNominationDraftBySeat\(null\)/)
    expect(hostUi).toMatch(/case\s+'append-pair'\s*:[\s\S]*?mafiaGameStore\.appendSpeakingNominationPair\(intent\.by,\s*intent\.target\)/)
    expect(hostUi).toMatch(/case\s+'reject-duplicate-by'\s*:/)
    expect(hostUi).toMatch(/case\s+'reject-duplicate-target'\s*:/)
  })

  it('preserves Mafia i18n toast keys (mafiaPage.*) verbatim', () => {
    expect(hostUi).toMatch(
      /pushCallToast\([\s\S]*?t\('mafiaPage\.speakingByAlreadyNominatedToast',\s*\{[\s\S]*?by:\s*intent\.bySeat[\s\S]*?target:\s*intent\.existingTarget/,
    )
    expect(hostUi).toMatch(
      /pushCallToast\([\s\S]*?t\('mafiaPage\.speakingTargetAlreadyNominatedToast',\s*\{[\s\S]*?target:\s*intent\.targetSeat[\s\S]*?by:\s*intent\.existingBySeat\s*\?\?\s*'\?'/,
    )
  })

  it('honors clearDraftAfter on the duplicate-by intent (second-click stale-draft clear)', () => {
    expect(hostUi).toMatch(
      /case\s+'reject-duplicate-by'\s*:[\s\S]*?if \(intent\.clearDraftAfter\)[\s\S]*?mafiaGameStore\.setSpeakingNominationDraftBySeat\(null\)/,
    )
  })

  it('night-mode fallthrough still calls assignOrClearNightActionForActiveRole (Mafia-specific)', () => {
    expect(hostUi).toMatch(
      /else\s*\{[\s\S]*?mafiaGameStore\.assignOrClearNightActionForActiveRole\(seat\)/,
    )
  })

  it('swap-mode branch is unchanged (peer-id based, Mafia-specific)', () => {
    expect(hostUi).toMatch(
      /if \(mafiaGameStore\.hostInteractionMode === 'swap'\)[\s\S]*?mafiaGameStore\.swapSeatsByPeerId\(sel,\s*pid\)/,
    )
  })

  it('the speaking branch no longer carries the inline `if (draft == null) / else if (draft === seat) / else` chain', () => {
    // The previous body had `const segments = decodeSpeakingNominationFlat(`
    // and an `if (draft == null) {` / `else if (draft === seat) {` chain;
    // those literal strings must be gone.
    expect(hostUi).not.toMatch(/const segments = decodeSpeakingNominationFlat\(/)
    expect(hostUi).not.toMatch(/if \(draft == null\)\s*\{[\s\S]*?\}\s*else if \(draft === seat\)/)
  })
})
