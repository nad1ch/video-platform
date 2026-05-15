import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Regression guards proving that the Game Template speaking / voting
 * nomination flow now uses the SHARED `speakingNominationController` and
 * is NOT a locally-duplicated implementation.
 *
 * Mafia is the behavioral source of truth; the controller was extracted
 * from Mafia, and Game Template's prior inline implementation was a
 * verbatim copy of the Mafia state machine (minus the night-action
 * branch). This migration is therefore a pure refactor — zero observable
 * behavior change:
 *
 *   - `appendSpeakingNominationPair`, `removeSpeakingNominationPairAt`,
 *     `applySpeakingQueueFromSignaling`, and `remapSpeakingQueueForSeatSwap`
 *     in `gameTemplateGame.ts` all delegate to controller helpers.
 *   - The tile-click router in `useGameRoomCallHostUi.ts` routes the
 *     speaking-mode branch through `decideSpeakingTileClick`, dispatching
 *     all five intent kinds with the same `gameRoom.*` i18n toast keys.
 *
 * Things this guard intentionally pins down:
 *
 *   - The four delegated functions no longer carry inline copies of the
 *     decoder / pair-splice / integer-filter / odd-length-pop logic.
 *   - Game Template's tri-state `hostInteractionMode: 'idle' | 'speaking'
 *     | 'swap'` stays — only the inner state-machine logic moves; the
 *     mode enum and `setHostInteractionMode`'s side-effects stay generic-
 *     game-room-side.
 *   - Game Template-only behavior (length-guarded clear, seat-cap prune,
 *     peer-id swap, players-update payload shape, default-mode no-op
 *     fallthrough) stays Game Template-side.
 *   - Mafia and Eat First adapters are NOT regressed by this block (their
 *     existing controller-wiring is unchanged).
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
function read(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8')
}

const store = read('apps/client/src/stores/gameTemplateGame.ts')
const hostUi = read('apps/client/src/composables/useGameRoomCallHostUi.ts')

// ---------------------------------------------------------------------------
//  gameTemplateGame.ts — store delegations
// ---------------------------------------------------------------------------

describe('gameTemplateGame.ts imports the shared speaking-nomination controller', () => {
  it('imports appendSpeakingPair, removeSpeakingPairAt, applySpeakingQueueFromSignaling, and remapSpeakingQueueForSeatSwap', () => {
    expect(store).toMatch(/from\s+['"]@\/utils\/speakingNominationController['"]/)
    expect(store).toMatch(/appendSpeakingPair/)
    expect(store).toMatch(/removeSpeakingPairAt/)
    expect(store).toMatch(/applySpeakingQueueFromSignaling as applySpeakingQueueFromSignalingShared/)
    expect(store).toMatch(/remapSpeakingQueueForSeatSwap as remapSpeakingQueueForSeatSwapShared/)
  })
})

describe('gameTemplateGame.ts speaking-queue functions delegate to the controller', () => {
  it('appendSpeakingNominationPair host-gates and delegates to appendSpeakingPair', () => {
    expect(store).toMatch(
      /function appendSpeakingNominationPair\(by:\s*number,\s*target:\s*number\)[\s\S]*?if \(!isGameRoomHost\.value\)[\s\S]*?return[\s\S]*?appendSpeakingPair\(speakingQueue\.value,\s*by,\s*target\)/,
    )
    // Identity-preservation early-exit (controller returns input ref on
    // invalid seats — same effect as the original `Number.isInteger` check).
    expect(store).toMatch(
      /function appendSpeakingNominationPair[\s\S]*?if \(next === speakingQueue\.value\)/,
    )
    // Draft clear preserved.
    expect(store).toMatch(
      /function appendSpeakingNominationPair[\s\S]*?clearSpeakingNominationDraft\(\)/,
    )
  })

  it('removeSpeakingNominationPairAt host-gates and delegates to removeSpeakingPairAt', () => {
    expect(store).toMatch(
      /function removeSpeakingNominationPairAt\(pairIndex:\s*number\)[\s\S]*?if \(!isGameRoomHost\.value\)[\s\S]*?return[\s\S]*?removeSpeakingPairAt\(speakingQueue\.value,\s*pairIndex\)/,
    )
    expect(store).toMatch(
      /function removeSpeakingNominationPairAt[\s\S]*?if \(next === speakingQueue\.value\)/,
    )
  })

  it('applySpeakingQueueFromSignaling delegates to the shared controller and preserves host draft', () => {
    expect(store).toMatch(
      /function applySpeakingQueueFromSignaling\(seats:\s*number\[\]\)[\s\S]*?applySpeakingQueueFromSignalingShared\(seats,\s*\{[\s\S]*?isHost:\s*isGameRoomHost\.value/,
    )
    expect(store).toMatch(
      /function applySpeakingQueueFromSignaling[\s\S]*?if \(shouldClearDraft\)[\s\S]*?clearSpeakingNominationDraft\(\)/,
    )
  })

  it('remapSpeakingQueueForSeatSwap delegates to the shared controller (and spreads to preserve always-reallocate semantic)', () => {
    expect(store).toMatch(
      /function remapSpeakingQueueForSeatSwap\(seatA:\s*number,\s*seatB:\s*number\)[\s\S]*?if \(seatA === seatB\)[\s\S]*?return[\s\S]*?remapSpeakingQueueForSeatSwapShared\(speakingQueue\.value,\s*seatA,\s*seatB\)/,
    )
    // Unconditional spread preserves the always-reallocate identity-
    // changing semantic the original `.map()` provided.
    expect(store).toMatch(
      /function remapSpeakingQueueForSeatSwap[\s\S]*?speakingQueue\.value\s*=\s*\[[\s\S]*?\.\.\.remapSpeakingQueueForSeatSwapShared/,
    )
  })
})

describe('gameTemplateGame.ts no longer carries the local copies of speaking-queue logic', () => {
  it('appendSpeakingNominationPair has no inline pair-encoded append', () => {
    expect(store).not.toMatch(/\[\.\.\.speakingQueue\.value,\s*by,\s*target\]/)
  })

  it('applySpeakingQueueFromSignaling has no inline integer filter or odd-length pop', () => {
    expect(store).not.toMatch(/for\s*\(\s*const\s+x\s+of\s+seats\s*\)/)
    expect(store).not.toMatch(/if \(next\.length % 2 === 1\)\s*\{\s*next\.pop\(\)/)
  })

  it('remapSpeakingQueueForSeatSwap no longer uses an inline `.map(n => ...)` ternary', () => {
    expect(store).not.toMatch(/speakingQueue\.value\.map\(\(n\)\s*=>\s*\n?\s*n === seatA \? seatB : n === seatB \? seatA : n,?\s*\)/)
  })

  it('removeSpeakingNominationPairAt has no inline even/odd splice/filter chain', () => {
    expect(store).not.toMatch(/const flat = speakingQueue\.value[\s\S]*?if \(flat\.length % 2 === 1\)\s*\{[\s\S]*?speakingQueue\.value\s*=\s*flat\.filter\(\(_,/)
  })
})

// ---------------------------------------------------------------------------
//  gameTemplateGame.ts — Game Template-specific surfaces preserved
// ---------------------------------------------------------------------------

describe('gameTemplateGame.ts Game Template-specific surfaces stay generic-game-room-side', () => {
  it('hostInteractionMode keeps the GameRoom tri-state enum and defaults to idle', () => {
    expect(store).toMatch(/hostInteractionMode\s*=\s*ref<GameRoomHostInteractionMode>\('idle'\)/)
  })

  it('GameRoomHostInteractionMode is "idle" | "speaking" | "swap" (no "night")', () => {
    expect(store).toMatch(/export type GameRoomHostInteractionMode = 'idle' \| 'speaking' \| 'swap'/)
    // Negative checks: no executable references to the Mafia-only
    // `'night'` mode. The literal may still appear in JSDoc that explains
    // the difference from Mafia, so the negatives only flag write / read /
    // comparison sites, not bare comment text.
    expect(store).not.toMatch(/hostInteractionMode\.value\s*=\s*'night'/)
    expect(store).not.toMatch(/===\s*'night'/)
    expect(store).not.toMatch(/!==\s*'night'/)
  })

  it('setHostInteractionMode keeps inline mode side-effects (mode !== swap clears swap sel, mode !== speaking clears draft)', () => {
    expect(store).toMatch(
      /function setHostInteractionMode\(mode:\s*GameRoomHostInteractionMode\)[\s\S]*?if \(mode !== 'swap'\)[\s\S]*?hostSeatSwapSelectionPeerId\.value\s*=\s*null[\s\S]*?if \(mode !== 'speaking'\)[\s\S]*?clearSpeakingNominationDraft\(\)/,
    )
  })

  it('clearSpeakingQueue keeps its host-gate + length-guard inline (Game Template-specific)', () => {
    expect(store).toMatch(
      /function clearSpeakingQueue\(\)[\s\S]*?if \(!isGameRoomHost\.value\)[\s\S]*?return[\s\S]*?if \(speakingQueue\.value\.length === 0\)[\s\S]*?return[\s\S]*?speakingQueue\.value\s*=\s*\[\][\s\S]*?clearSpeakingNominationDraft\(\)/,
    )
  })

  it('pruneSpeakingQueueToMaxSeat is preserved (Game Template-specific seat-cap pruning)', () => {
    expect(store).toMatch(/function pruneSpeakingQueueToMaxSeat\(maxSeat:\s*number\)/)
  })

  it('swapSeatsByPeerId still calls remapSpeakingQueueForSeatSwap', () => {
    expect(store).toMatch(/function swapSeatsByPeerId[\s\S]*?remapSpeakingQueueForSeatSwap\(seatA,\s*seatB\)/)
  })

  it('buildPlayersUpdatePayloadFromState still copies speakingQueue into the broadcast payload (order + speakingQueue only — no nightActions)', () => {
    expect(store).toMatch(
      /function buildPlayersUpdatePayloadFromState[\s\S]*?speakingQueue:\s*\[\.\.\.speakingQueue\.value\]/,
    )
    // Game Template's payload shape excludes `nightActions` (Mafia-only).
    expect(store).not.toMatch(/function buildPlayersUpdatePayloadFromState[\s\S]*?nightActions/)
  })

  it('applyGameRoomPlayersUpdateFromSignaling still calls applySpeakingQueueFromSignaling', () => {
    expect(store).toMatch(
      /function applyGameRoomPlayersUpdateFromSignaling[\s\S]*?applySpeakingQueueFromSignaling\(\[\.\.\.\(payload\.speakingQueue \?\? \[\]\)\]\)/,
    )
  })
})

// ---------------------------------------------------------------------------
//  useGameRoomCallHostUi.ts — tile-click router migration
// ---------------------------------------------------------------------------

describe('useGameRoomCallHostUi.ts routes the speaking-mode tile click through the controller', () => {
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

  it('the speaking branch invokes decideSpeakingTileClick with Game Template store state', () => {
    expect(hostUi).toMatch(
      /if \(gameStore\.hostInteractionMode === 'speaking'\)[\s\S]*?decideSpeakingTileClick\(\{[\s\S]*?mode:\s*'speaking'[\s\S]*?seat,\s*\n[\s\S]*?draft:\s*gameStore\.speakingNominationDraftBySeat[\s\S]*?queue:\s*gameStore\.speakingQueue/,
    )
  })

  it('dispatches all five intent kinds (set-draft / clear-draft / append-pair / two collisions)', () => {
    expect(hostUi).toMatch(/case\s+'set-draft'\s*:[\s\S]*?gameStore\.setSpeakingNominationDraftBySeat\(intent\.seat\)/)
    expect(hostUi).toMatch(/case\s+'clear-draft'\s*:[\s\S]*?gameStore\.setSpeakingNominationDraftBySeat\(null\)/)
    expect(hostUi).toMatch(/case\s+'append-pair'\s*:[\s\S]*?gameStore\.appendSpeakingNominationPair\(intent\.by,\s*intent\.target\)/)
    expect(hostUi).toMatch(/case\s+'reject-duplicate-by'\s*:/)
    expect(hostUi).toMatch(/case\s+'reject-duplicate-target'\s*:/)
  })

  it('preserves Game Template i18n toast keys (gameRoom.*) verbatim', () => {
    expect(hostUi).toMatch(
      /pushCallToast\([\s\S]*?t\('gameRoom\.speakingByAlreadyNominatedToast',\s*\{[\s\S]*?by:\s*intent\.bySeat[\s\S]*?target:\s*intent\.existingTarget/,
    )
    expect(hostUi).toMatch(
      /pushCallToast\([\s\S]*?t\('gameRoom\.speakingTargetAlreadyNominatedToast',\s*\{[\s\S]*?target:\s*intent\.targetSeat[\s\S]*?by:\s*intent\.existingBySeat\s*\?\?\s*'\?'/,
    )
  })

  it('honors clearDraftAfter on the duplicate-by intent (second-click stale-draft clear)', () => {
    expect(hostUi).toMatch(
      /case\s+'reject-duplicate-by'\s*:[\s\S]*?if \(intent\.clearDraftAfter\)[\s\S]*?gameStore\.setSpeakingNominationDraftBySeat\(null\)/,
    )
  })

  it('does NOT add a Mafia-style night-action fallthrough (default click stays no-op for the generic protocol)', () => {
    // Game Template has no night-action equivalent. The original
    // composable preserves a JSDoc reference to the Mafia branch, so the
    // negative check only flags an actual call site (function-call form),
    // not the explanatory comment.
    expect(hostUi).not.toMatch(/gameStore\.assignOrClearNightActionForActiveRole\(/)
    expect(hostUi).not.toMatch(/\.assignOrClearNightActionForActiveRole\(/)
  })

  it('swap-mode branch is unchanged (peer-id based, generic-game-room)', () => {
    expect(hostUi).toMatch(
      /if \(gameStore\.hostInteractionMode === 'swap'\)[\s\S]*?gameStore\.swapSeatsByPeerId\(sel,\s*pid\)/,
    )
  })

  it('the speaking branch no longer carries the inline `if (draft == null) / else if (draft === seat) / else` chain', () => {
    expect(hostUi).not.toMatch(/const segments = decodeSpeakingNominationFlat\(/)
    expect(hostUi).not.toMatch(/if \(draft == null\)\s*\{[\s\S]*?\}\s*else if \(draft === seat\)/)
  })
})

// ---------------------------------------------------------------------------
//  Negative isolation: Mafia and Eat First adapter wiring is untouched by
//  this block — re-asserted here so a future drift in those adapters fails
//  this Game Template guard suite as a co-located safety net.
// ---------------------------------------------------------------------------

describe('Mafia and Eat First adapters still use the shared controller (negative isolation)', () => {
  const mafiaStore = read('apps/client/src/stores/mafiaGame.ts')
  const mafiaUi = read('apps/client/src/composables/useMafiaCallHostUi.ts')
  const eatFirstShell = read('apps/client/src/stores/eatFirstCallShell.ts')

  it('Mafia store still imports from speakingNominationController', () => {
    expect(mafiaStore).toMatch(/from\s+['"]@\/utils\/speakingNominationController['"]/)
    expect(mafiaStore).toMatch(/appendSpeakingPair/)
    expect(mafiaStore).toMatch(/applySpeakingQueueFromSignalingShared/)
    expect(mafiaStore).toMatch(/remapSpeakingQueueForSeatSwapShared/)
  })

  it('Mafia host UI still imports decideSpeakingTileClick', () => {
    expect(mafiaUi).toMatch(
      /import\s*\{\s*decideSpeakingTileClick\s*\}\s*from\s+['"]@\/utils\/speakingNominationController['"]/,
    )
  })

  it('Eat First shell still imports from speakingNominationController', () => {
    expect(eatFirstShell).toMatch(/from\s+['"]@\/utils\/speakingNominationController['"]/)
    expect(eatFirstShell).toMatch(/appendSpeakingPair/)
    expect(eatFirstShell).toMatch(/applySpeakingQueueFromSignalingShared/)
  })
})
