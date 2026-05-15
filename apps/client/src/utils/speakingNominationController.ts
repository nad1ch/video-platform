/**
 * Shared speaking-nomination state machine for game-call routes.
 *
 * Extracted so Mafia, Game Template, and Eat First share a single source of
 * truth for the rules that drive the "put to vote / speaking queue" flow:
 *
 *   1. tile-click decision in `'speaking'` mode
 *        - first valid click stores a draft
 *        - same-seat re-click clears the draft
 *        - second click on a different seat appends `[by, target]`
 *        - duplicate-by collisions (the clicked seat or the current draft is
 *          already a nominator in the queue) are rejected
 *        - duplicate-target collisions (the clicked seat is already a
 *          nominee in the queue) are rejected
 *   2. inbound `*:speaking-queue-update` application
 *        - integer filter + `≥1` clamp
 *        - odd-length truncated to even (pair-encoded)
 *        - host preserves its in-flight nomination draft (it may already be
 *          choosing the next `[by, target]` pair); non-host clears the draft
 *   3. queue ops (append, remove, clear, swap remap)
 *   4. host-interaction-mode transitions across `'idle' | 'speaking' | 'swap'`
 *
 * **Hard isolation.** This module imports zero Vue / Pinia / store / WS /
 * i18n / ParticipantTile / StreamVideo / StreamAudio / call-core code. Every
 * input arrives as a plain value; every output is a plain intent that the
 * route adapter applies to its own store. That is what lets Mafia, Game
 * Template, and Eat First reuse the same logic without dragging in each
 * other's domains.
 *
 * Route adapters keep route-specific behavior outside this module:
 *
 *   - **Mafia**: tri-state `'night' | 'speaking' | 'swap'` (where `'night'`
 *     plays the role of `'idle'`); swap-by-peer-id; numbering order +
 *     night-action remap; per-route toast keys; debounced WS broadcast.
 *   - **Game Template**: tri-state `'idle' | 'speaking' | 'swap'`; no traits.
 *   - **Eat First**: dual flag (`speakingMode: boolean` +
 *     `hostInteractionMode: 'idle' | 'swap'`) collapsed into the controller's
 *     three-way `SpeakingMode` at the call site; slot-bound traits and action
 *     cards never touched; `eat:speaking-queue-update` WS path; the
 *     "clear-all also exits speaking mode" carve-out lives in the bar adapter.
 *
 * Mafia is the behavioral source of truth. The unit tests in
 * `packages/client-consistency/speakingNominationController.test.ts` pin
 * down every rule so future migrations of Mafia / Game Template onto the
 * controller can be proven non-regressive.
 */

export type SpeakingMode = 'idle' | 'speaking' | 'swap'

/** Pair-decoded view of the flat speaking queue. */
export type SpeakingNominationSegment = {
  pairIndex: number
  bySeat: number | null
  targetSeat: number
}

export type SpeakingTileClickInput = {
  /** Caller-resolved current mode. Only `'speaking'` produces non-ignore intents. */
  mode: SpeakingMode
  /** 1-based seat number of the clicked tile (caller resolves peer → seat). */
  seat: number
  /** Current first-click draft seat, or `null` when nothing is in progress. */
  draft: number | null
  /** Current speaking queue (pair-encoded when even length, legacy target-only when odd). */
  queue: readonly number[]
}

export type SpeakingTileClickIntent =
  /** Mode is not `'speaking'`, or seat is not a positive integer — adapter does nothing. */
  | { kind: 'ignore' }
  /** First valid click: store this seat as the draft (nominator-in-progress). */
  | { kind: 'set-draft'; seat: number }
  /** Re-clicked the same seat that is already the draft: clear the draft. */
  | { kind: 'clear-draft' }
  /** Second click, no collision: append `[by, target]` to the queue and clear draft. */
  | { kind: 'append-pair'; by: number; target: number }
  /**
   * Rejected because this seat is already a nominator in the queue. On a
   * first-click rejection `clearDraftAfter` is `false`; on a second-click
   * rejection caused by the *current draft* already being a nominator,
   * `clearDraftAfter` is `true` so the adapter discards the stale draft along
   * with the toast.
   */
  | {
      kind: 'reject-duplicate-by'
      bySeat: number
      existingTarget: number
      clearDraftAfter: boolean
    }
  /** Rejected because this seat is already a nominee in the queue. */
  | {
      kind: 'reject-duplicate-target'
      targetSeat: number
      existingBySeat: number | null
    }

function isPositiveIntegerSeat(seat: unknown): seat is number {
  return typeof seat === 'number' && Number.isInteger(seat) && seat >= 1
}

/**
 * Pair-decode a flat speaking queue.
 *
 *   - **Even length** is the canonical encoding `[by1, target1, by2, target2, ...]`.
 *   - **Odd length** is treated as legacy target-only (one nominee per entry,
 *     `bySeat: null`) so old clients / server-sanitization-after-peer-leave
 *     still render.
 *
 * Pure. Returns a fresh array each call so callers can mutate freely.
 */
export function decodeSpeakingQueue(queue: readonly number[]): SpeakingNominationSegment[] {
  if (!Array.isArray(queue) || queue.length < 1) return []
  if (queue.length % 2 === 1) {
    return queue.map((targetSeat, pairIndex) => ({
      pairIndex,
      bySeat: null,
      targetSeat,
    }))
  }
  const out: SpeakingNominationSegment[] = []
  for (let i = 0; i + 1 < queue.length; i += 2) {
    out.push({ pairIndex: out.length, bySeat: queue[i]!, targetSeat: queue[i + 1]! })
  }
  return out
}

/**
 * Decide what a host tile click should do in speaking mode.
 *
 * Mirrors Mafia's `useMafiaCallHostUi.handleMafiaHostTileClick` speaking
 * branch line-for-line so the three routes share identical UX:
 *
 *   ┌──────────────────────────────┬──────────────────────────────────────────┐
 *   │ State                        │ Intent                                   │
 *   ├──────────────────────────────┼──────────────────────────────────────────┤
 *   │ mode ≠ 'speaking'            │ ignore                                   │
 *   │ seat ≤ 0 or non-integer      │ ignore                                   │
 *   │ draft == null,               │ reject-duplicate-by                      │
 *   │   seat already a nominator   │   (clearDraftAfter = false)              │
 *   │ draft == null,               │ set-draft                                │
 *   │   no collision               │                                          │
 *   │ draft === seat               │ clear-draft                              │
 *   │ draft != null,               │ reject-duplicate-target                  │
 *   │   seat already a nominee     │                                          │
 *   │ draft != null,               │ reject-duplicate-by                      │
 *   │   draft already a nominator  │   (clearDraftAfter = true)               │
 *   │ draft != null, no collision  │ append-pair                              │
 *   └──────────────────────────────┴──────────────────────────────────────────┘
 */
export function decideSpeakingTileClick(input: SpeakingTileClickInput): SpeakingTileClickIntent {
  if (input.mode !== 'speaking') return { kind: 'ignore' }
  if (!isPositiveIntegerSeat(input.seat)) return { kind: 'ignore' }
  const segments = decodeSpeakingQueue(input.queue)
  if (input.draft == null) {
    const existingBy = segments.find((seg) => seg.bySeat === input.seat)
    if (existingBy) {
      return {
        kind: 'reject-duplicate-by',
        bySeat: input.seat,
        existingTarget: existingBy.targetSeat,
        clearDraftAfter: false,
      }
    }
    return { kind: 'set-draft', seat: input.seat }
  }
  if (input.draft === input.seat) {
    return { kind: 'clear-draft' }
  }
  const existingTarget = segments.find((seg) => seg.targetSeat === input.seat)
  if (existingTarget) {
    return {
      kind: 'reject-duplicate-target',
      targetSeat: input.seat,
      existingBySeat: existingTarget.bySeat,
    }
  }
  const draftAlreadyBy = segments.find((seg) => seg.bySeat === input.draft)
  if (draftAlreadyBy) {
    return {
      kind: 'reject-duplicate-by',
      bySeat: input.draft,
      existingTarget: draftAlreadyBy.targetSeat,
      clearDraftAfter: true,
    }
  }
  return { kind: 'append-pair', by: input.draft, target: input.seat }
}

/**
 * Append a `[by, target]` pair to a flat queue. Returns the input reference on
 * invalid input so callers can use referential equality to skip work. Caller
 * is responsible for host-gating; this helper does NOT enforce roles.
 */
export function appendSpeakingPair(
  queue: readonly number[],
  by: number,
  target: number,
): readonly number[] {
  if (!isPositiveIntegerSeat(by) || !isPositiveIntegerSeat(target)) return queue
  return [...queue, by, target]
}

/**
 * Remove a pair (even-length canonical) or a single entry (odd-length legacy)
 * at the given pair index. Returns the input reference if `pairIndex` is out
 * of range. Pure; caller host-gates.
 */
export function removeSpeakingPairAt(
  queue: readonly number[],
  pairIndex: number,
): readonly number[] {
  if (!Number.isInteger(pairIndex) || pairIndex < 0) return queue
  if (queue.length % 2 === 1) {
    if (pairIndex >= queue.length) return queue
    return queue.filter((_, i) => i !== pairIndex)
  }
  const i = pairIndex * 2
  if (i + 1 >= queue.length) return queue
  return [...queue.slice(0, i), ...queue.slice(i + 2)]
}

/**
 * Normalize an inbound seat array: drop non-integers and seats `< 1`, then
 * truncate odd length to even so the result is always pair-encoded. Pure;
 * always returns a fresh array.
 */
export function normalizeSpeakingQueueToPairs(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const out: number[] = []
  for (const x of raw) {
    if (typeof x === 'number' && Number.isInteger(x) && x >= 1) {
      out.push(x)
    }
  }
  if (out.length % 2 === 1) out.pop()
  return out
}

/**
 * Apply an inbound `*:speaking-queue-update` payload.
 *
 * Mirrors Mafia's `applySpeakingQueueFromSignaling` (`mafiaGame.ts`):
 *
 *   - integer filter + `≥1` clamp
 *   - odd-length truncated to even
 *   - `isHost = true` ⇒ preserve the in-flight nomination draft (the host may
 *     already be selecting the next `[by, target]` pair after their previous
 *     append fired the outbound watcher — wiping the draft here would lose
 *     that selection between rapid clicks)
 *   - `isHost = false` ⇒ clear the draft (non-host has no draft semantic and
 *     should track server state)
 *
 * Adapter pattern:
 *
 *   const { nextQueue, shouldClearDraft } = applySpeakingQueueFromSignaling(raw, { isHost })
 *   store.speakingQueue.value = nextQueue
 *   if (shouldClearDraft) store.clearSpeakingNominationDraft()
 */
export function applySpeakingQueueFromSignaling(
  raw: unknown,
  options: { isHost: boolean },
): { nextQueue: number[]; shouldClearDraft: boolean } {
  const shouldClearDraft = !options.isHost
  if (!Array.isArray(raw)) {
    return { nextQueue: [], shouldClearDraft }
  }
  return {
    nextQueue: normalizeSpeakingQueueToPairs(raw),
    shouldClearDraft,
  }
}

/**
 * Remap 1-based seat numbers inside a speaking queue when two seats swap
 * positions. Every occurrence of `seatA` becomes `seatB` and vice versa.
 *
 * Identity-preserving: returns the input reference when nothing changed
 * (no occurrences) or when `seatA === seatB`. The pair-encoded layout is
 * preserved because length and parity are untouched.
 */
export function remapSpeakingQueueForSeatSwap(
  queue: readonly number[],
  seatA: number,
  seatB: number,
): readonly number[] {
  if (seatA === seatB) return queue
  let changed = false
  const next: number[] = new Array(queue.length)
  for (let i = 0; i < queue.length; i++) {
    const v = queue[i]!
    if (v === seatA) {
      next[i] = seatB
      changed = true
    } else if (v === seatB) {
      next[i] = seatA
      changed = true
    } else {
      next[i] = v
    }
  }
  return changed ? next : queue
}

/**
 * Pure mode-transition state machine. Mirrors Mafia's `setHostInteractionMode`
 * side-effects so every route adapter expresses the same rules:
 *
 *   - `next !== 'swap'`     ⇒ clear any pending swap selection
 *   - `next !== 'speaking'` ⇒ clear the nomination draft
 *
 * The `current` mode is accepted as a parameter for future extensibility
 * (e.g. transition-specific side effects) but is currently not consulted —
 * Mafia treats every mode change identically, so the controller does too.
 */
export function transitionSpeakingMode(
  _current: SpeakingMode,
  next: SpeakingMode,
): {
  mode: SpeakingMode
  shouldClearDraft: boolean
  shouldClearSwapSelection: boolean
} {
  return {
    mode: next,
    shouldClearDraft: next !== 'speaking',
    shouldClearSwapSelection: next !== 'swap',
  }
}
