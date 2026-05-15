import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Regression guards for the shared game-call tile UI:
 *
 *   - the drag-reorder tooltip ("Перетягніть, щоб змінити порядок") is
 *     bound to the SAME gate as `:draggable`, so non-host / non-reorder
 *     routes (Mafia, Eat First, Game Template, OBS / view-only) never
 *     show it on hover.
 *   - the hovered-unpinned tile is layered ABOVE the centered timer
 *     chip wrappers (`.mafia-overlay` / `.game-template-overlay` /
 *     `.eat-first-call-timer`, each `z-index: 42`).
 *   - pinned tiles remain BELOW the timer chip even while hovered, so
 *     the centered countdown reads on top of the spotlight card.
 *
 * The guards assert source-string shapes (no Vue mounting), matching the
 * existing project pattern for grep-style regression tests.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
function read(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8')
}

const callPage = read('apps/client/src/components/call/CallPage.vue')
const gameTemplatePage = read('apps/client/src/components/game-template/GameTemplateCallPage.vue')
const callCss = read('apps/client/src/components/call/CallPage.css')
const mafiaOverlay = read('apps/client/src/components/mafia/MafiaOverlay.vue')
const gameTemplateOverlay = read('apps/client/src/components/game-template/GameTemplateOverlay.vue')
const eatFirstStrip = read('apps/client/src/eat-first/components/EatFirstCallTimerStrip.vue')

// Numeric layer expectations. Encoded once so a future bump moves the
// floor for both the tile fix and the timer overlay together.
const TIMER_OVERLAY_Z_INDEX = 42
const UNPINNED_HOVER_Z_INDEX = 44
const PINNED_HOVER_Z_INDEX = 35

// ---------------------------------------------------------------------------
//  Problem 1 — drag-reorder tooltip gating
// ---------------------------------------------------------------------------

describe('CallPage.vue — drag-reorder tooltip is gated by canReorderTiles', () => {
  it('declares a single `canReorderTiles` computed that mirrors the previous :draggable expression', () => {
    expect(callPage).toMatch(
      /const canReorderTiles = computed\([\s\S]*?!mafiaViewUi\.value\s*&&\s*!isMafiaRoute\.value\s*&&\s*!isEatFirstRoute\.value/,
    )
  })

  it(':draggable binds to canReorderTiles (no longer a duplicated boolean expression)', () => {
    expect(callPage).toMatch(/:draggable="canReorderTiles"/)
    expect(callPage).not.toMatch(/:draggable="!mafiaViewUi && !isMafiaRoute && !isEatFirstRoute"/)
  })

  it(':title and :aria-label resolve to undefined when canReorderTiles is false', () => {
    expect(callPage).toMatch(
      /:title="canReorderTiles \? t\('callPage\.dragReorder'\) : undefined"/,
    )
    expect(callPage).toMatch(
      /:aria-label="canReorderTiles \? t\('callPage\.dragReorder'\) : undefined"/,
    )
  })

  it('does NOT bind the tooltip text unconditionally (no bare `t("callPage.dragReorder")` next to :draggable)', () => {
    // The pre-fix shape was `:title="t('callPage.dragReorder')"` — must be gone.
    expect(callPage).not.toMatch(/:title="t\('callPage\.dragReorder'\)"/)
    expect(callPage).not.toMatch(/:aria-label="t\('callPage\.dragReorder'\)"/)
  })
})

describe('GameTemplateCallPage.vue — drag-reorder tooltip is gated by canReorderTiles', () => {
  it('declares a single `canReorderTiles` computed that mirrors the previous :draggable expression', () => {
    expect(gameTemplatePage).toMatch(
      /const canReorderTiles = computed\([\s\S]*?!gameRoomViewUi\.value\s*&&\s*!isGameRoomRoute\.value/,
    )
  })

  it(':draggable binds to canReorderTiles', () => {
    expect(gameTemplatePage).toMatch(/:draggable="canReorderTiles"/)
    expect(gameTemplatePage).not.toMatch(/:draggable="!gameRoomViewUi && !isGameRoomRoute"/)
  })

  it(':title and :aria-label resolve to undefined when canReorderTiles is false', () => {
    expect(gameTemplatePage).toMatch(
      /:title="canReorderTiles \? t\('callPage\.dragReorder'\) : undefined"/,
    )
    expect(gameTemplatePage).toMatch(
      /:aria-label="canReorderTiles \? t\('callPage\.dragReorder'\) : undefined"/,
    )
  })

  it('does NOT bind the tooltip text unconditionally', () => {
    expect(gameTemplatePage).not.toMatch(/:title="t\('callPage\.dragReorder'\)"/)
    expect(gameTemplatePage).not.toMatch(/:aria-label="t\('callPage\.dragReorder'\)"/)
  })
})

// ---------------------------------------------------------------------------
//  Problem 2 — hovered tile vs timer overlay z-index layering
// ---------------------------------------------------------------------------

describe('CallPage.css — hovered unpinned tile is layered above the timer chip', () => {
  it(`elevates :hover / :focus-within / --over / --speaking to z-index ${UNPINNED_HOVER_Z_INDEX}`, () => {
    expect(callCss).toMatch(
      new RegExp(
        `\\.call-page__tile-wrap:hover,[\\s\\S]*?\\.call-page__tile-wrap:focus-within,[\\s\\S]*?\\.call-page__tile-wrap--over,[\\s\\S]*?\\.call-page__tile-wrap--speaking\\s*\\{[\\s\\S]*?z-index:\\s*${UNPINNED_HOVER_Z_INDEX}`,
      ),
    )
  })

  it('the unpinned hover z-index is strictly above the timer overlay wrapper (42)', () => {
    expect(UNPINNED_HOVER_Z_INDEX).toBeGreaterThan(TIMER_OVERLAY_Z_INDEX)
  })

  it('drops the pre-fix z-index 35 from the unpinned hover rule', () => {
    // The previous shape had `z-index: 35` immediately after the
    // four-selector list — must be gone now that 44 owns it.
    expect(callCss).not.toMatch(
      /\.call-page__tile-wrap:hover,\s*\n\s*\.call-page__tile-wrap:focus-within,\s*\n\s*\.call-page__tile-wrap--over,\s*\n\s*\.call-page__tile-wrap--speaking\s*\{\s*\n\s*z-index:\s*35\s*;/,
    )
  })
})

// ---------------------------------------------------------------------------
//  Problem 2b — the GRID itself must lift to escape its own stacking context
// ---------------------------------------------------------------------------
//
//  `.call-page__grid` creates a stacking context via `contain: layout`,
//  which traps every z-index applied to `.call-page__tile-wrap` inside the
//  grid's SC. The tile-wrap can never compete with the timer overlay's
//  z-index 42 in the PARENT context unless the grid itself is also lifted.
//  This block guards the `:has()` rule that promotes the grid above the
//  chip when an unpinned tile inside it is in an interactive state.

describe('CallPage.css — grid lifts above the timer chip when an unpinned tile is interactive', () => {
  it('declares a `:has()` rule on `.call-page__grid` gated by @media (hover: hover)', () => {
    // The block opens with `@media (hover: hover)` and closes with the
    // `z-index: 44` body. Assert the @media wrapper presence first.
    expect(callCss).toMatch(/@media \(hover: hover\)\s*\{[\s\S]*?\.call-page__grid:has\(/)
  })

  it('matches `:has(.call-page__tile-wrap:hover:not(--pinned))` on the grid', () => {
    expect(callCss).toMatch(
      /\.call-page__grid:has\(\.call-page__tile-wrap:hover:not\(\.call-page__tile-wrap--pinned\)\)/,
    )
  })

  it('matches `:has(.call-page__tile-wrap:focus-within:not(--pinned))` on the grid', () => {
    expect(callCss).toMatch(
      /\.call-page__grid:has\(\.call-page__tile-wrap:focus-within:not\(\.call-page__tile-wrap--pinned\)\)/,
    )
  })

  it('matches `:has(.call-page__tile-wrap--over:not(--pinned))` on the grid', () => {
    expect(callCss).toMatch(
      /\.call-page__grid:has\(\.call-page__tile-wrap--over:not\(\.call-page__tile-wrap--pinned\)\)/,
    )
  })

  it(`promotes the grid to z-index ${UNPINNED_HOVER_Z_INDEX} (strictly above the chip's ${TIMER_OVERLAY_Z_INDEX})`, () => {
    // The three `:has()` selectors share a single body; the block must
    // resolve to `z-index: 44`. The selectors and the value live in one
    // CSS rule, so a single regex covering the three-selector list and the
    // body is the strict assertion.
    expect(callCss).toMatch(
      new RegExp(
        `\\.call-page__grid:has\\(\\.call-page__tile-wrap:hover:not\\(\\.call-page__tile-wrap--pinned\\)\\),[\\s\\S]*?\\.call-page__grid:has\\(\\.call-page__tile-wrap:focus-within:not\\(\\.call-page__tile-wrap--pinned\\)\\),[\\s\\S]*?\\.call-page__grid:has\\(\\.call-page__tile-wrap--over:not\\(\\.call-page__tile-wrap--pinned\\)\\)\\s*\\{[\\s\\S]*?z-index:\\s*${UNPINNED_HOVER_Z_INDEX}`,
      ),
    )
  })

  it(`leaves the grid at its default position when only a --pinned tile is hovered (so chip stays on top of pinned card)`, () => {
    // A future regression that drops `:not(.call-page__tile-wrap--pinned)`
    // from any of the three `:has()` selectors would lift the grid on
    // pinned-only hovers and put the pinned card above the chip — exactly
    // the rule the user said must NOT change. Assert the unfiltered shape
    // never appears.
    expect(callCss).not.toMatch(
      /\.call-page__grid:has\(\.call-page__tile-wrap:hover\)/,
    )
    expect(callCss).not.toMatch(
      /\.call-page__grid:has\(\.call-page__tile-wrap:focus-within\)/,
    )
    expect(callCss).not.toMatch(
      /\.call-page__grid:has\(\.call-page__tile-wrap--over\)/,
    )
  })
})

describe('CallPage.css — pinned tile stays below the timer chip even when hovered', () => {
  it('declares a --pinned override that pins elevation to z-index 35 across hover / focus / over / speaking', () => {
    const re = new RegExp(
      `\\.call-page__tile-wrap--pinned,[\\s\\S]*?\\.call-page__tile-wrap--pinned:hover,[\\s\\S]*?\\.call-page__tile-wrap--pinned:focus-within,[\\s\\S]*?\\.call-page__tile-wrap--pinned\\.call-page__tile-wrap--over,[\\s\\S]*?\\.call-page__tile-wrap--pinned\\.call-page__tile-wrap--speaking\\s*\\{[\\s\\S]*?z-index:\\s*${PINNED_HOVER_Z_INDEX}`,
    )
    expect(callCss).toMatch(re)
  })

  it('the pinned hover z-index is strictly below the timer overlay wrapper (42)', () => {
    expect(PINNED_HOVER_Z_INDEX).toBeLessThan(TIMER_OVERLAY_Z_INDEX)
  })
})

describe('Timer overlay wrappers stay at z-index 42 in all three game adapters', () => {
  it('Mafia overlay wrapper is z-index 42', () => {
    expect(mafiaOverlay).toMatch(/\.mafia-overlay\s*\{[\s\S]*?z-index:\s*42/)
  })

  it('Game Template overlay wrapper is z-index 42', () => {
    expect(gameTemplateOverlay).toMatch(/\.game-template-overlay\s*\{[\s\S]*?z-index:\s*42/)
  })

  it('Eat First call timer wrapper is z-index 42', () => {
    expect(eatFirstStrip).toMatch(/\.eat-first-call-timer\s*\{[\s\S]*?z-index:\s*42/)
  })
})

describe('Page-level transient surfaces remain above the new tile hover z-index', () => {
  it('call toasts (45) stay above hovered tiles (44)', () => {
    expect(callCss).toMatch(/\.call-page__toasts\s*\{[\s\S]*?z-index:\s*45/)
  })

  it('device popover (50) stays above hovered tiles', () => {
    expect(callCss).toMatch(/\.call-page__device-pop[\s\S]*?z-index:\s*50/)
  })

  it('join error (55) stays above hovered tiles', () => {
    expect(callCss).toMatch(/\.call-page__join-error\s*\{[\s\S]*?z-index:\s*55/)
  })
})
