import { describe, expect, it } from 'vitest'
import {
  appendSpeakingPair,
  applySpeakingQueueFromSignaling,
  decideSpeakingTileClick,
  decodeSpeakingQueue,
  normalizeSpeakingQueueToPairs,
  remapSpeakingQueueForSeatSwap,
  removeSpeakingPairAt,
  transitionSpeakingMode,
} from '@/utils/speakingNominationController'

/**
 * Pure tests for the shared speaking-nomination state machine.
 *
 * These pin down the exact rules Mafia / Game Template / Eat First all
 * reuse. The controller is intentionally Vue-free / store-free / WS-free so
 * every behavior can be asserted as plain function calls. If any of the
 * route adapters ever drift, these tests stay green only because the
 * controller's behavior matches Mafia (the behavioral source of truth).
 */

// ---------------------------------------------------------------------------
//  decideSpeakingTileClick — first-click flow
// ---------------------------------------------------------------------------

describe('decideSpeakingTileClick — first-click flow', () => {
  it('ignores click when mode is idle', () => {
    expect(
      decideSpeakingTileClick({ mode: 'idle', seat: 3, draft: null, queue: [] }),
    ).toEqual({ kind: 'ignore' })
  })

  it('ignores click when mode is swap', () => {
    expect(
      decideSpeakingTileClick({ mode: 'swap', seat: 3, draft: null, queue: [] }),
    ).toEqual({ kind: 'ignore' })
  })

  it('ignores click when seat is 0', () => {
    expect(
      decideSpeakingTileClick({ mode: 'speaking', seat: 0, draft: null, queue: [] }),
    ).toEqual({ kind: 'ignore' })
  })

  it('ignores click when seat is negative', () => {
    expect(
      decideSpeakingTileClick({ mode: 'speaking', seat: -3, draft: null, queue: [] }),
    ).toEqual({ kind: 'ignore' })
  })

  it('ignores click when seat is not an integer', () => {
    expect(
      decideSpeakingTileClick({ mode: 'speaking', seat: 1.5, draft: null, queue: [] }),
    ).toEqual({ kind: 'ignore' })
  })

  it('first click sets draft when no collisions exist', () => {
    expect(
      decideSpeakingTileClick({ mode: 'speaking', seat: 3, draft: null, queue: [] }),
    ).toEqual({ kind: 'set-draft', seat: 3 })
  })

  it('first click on a seat already a nominator rejects duplicate-by (clearDraftAfter=false)', () => {
    const intent = decideSpeakingTileClick({
      mode: 'speaking',
      seat: 2,
      draft: null,
      queue: [2, 5],
    })
    expect(intent).toEqual({
      kind: 'reject-duplicate-by',
      bySeat: 2,
      existingTarget: 5,
      clearDraftAfter: false,
    })
  })

  it('first click on a seat that is a target but not a nominator still sets draft', () => {
    // seat 5 is a target (not a nominator) in [2, 5] — first click should
    // still set draft, because Mafia's rule only collides on *nominator*
    // duplication for the first click.
    expect(
      decideSpeakingTileClick({ mode: 'speaking', seat: 5, draft: null, queue: [2, 5] }),
    ).toEqual({ kind: 'set-draft', seat: 5 })
  })
})

// ---------------------------------------------------------------------------
//  decideSpeakingTileClick — second-click flow
// ---------------------------------------------------------------------------

describe('decideSpeakingTileClick — second-click flow', () => {
  it('same seat as draft clears draft', () => {
    expect(
      decideSpeakingTileClick({ mode: 'speaking', seat: 3, draft: 3, queue: [] }),
    ).toEqual({ kind: 'clear-draft' })
  })

  it('different seat appends [draft, seat] when no collision', () => {
    expect(
      decideSpeakingTileClick({ mode: 'speaking', seat: 4, draft: 3, queue: [] }),
    ).toEqual({ kind: 'append-pair', by: 3, target: 4 })
  })

  it('different seat already a target rejects duplicate-target', () => {
    const intent = decideSpeakingTileClick({
      mode: 'speaking',
      seat: 5,
      draft: 3,
      queue: [2, 5],
    })
    expect(intent).toEqual({
      kind: 'reject-duplicate-target',
      targetSeat: 5,
      existingBySeat: 2,
    })
  })

  it('different seat OK but current draft already a nominator rejects duplicate-by + clears draft', () => {
    const intent = decideSpeakingTileClick({
      mode: 'speaking',
      seat: 4,
      draft: 3,
      queue: [3, 7],
    })
    expect(intent).toEqual({
      kind: 'reject-duplicate-by',
      bySeat: 3,
      existingTarget: 7,
      clearDraftAfter: true,
    })
  })

  it('legacy odd-length queue: every entry is a target, so duplicate-target still detected', () => {
    // [2, 5, 7] is odd-length → all three are treated as nominees.
    const intent = decideSpeakingTileClick({
      mode: 'speaking',
      seat: 5,
      draft: 3,
      queue: [2, 5, 7],
    })
    expect(intent).toEqual({
      kind: 'reject-duplicate-target',
      targetSeat: 5,
      existingBySeat: null,
    })
  })

  it('legacy odd-length queue: bySeat collision check finds no nominator (null bySeat)', () => {
    // [2, 5, 7] has no `bySeat`-keyed segments (all null) — so even if
    // draft=2, there is no duplicate-by collision and the pair appends.
    expect(
      decideSpeakingTileClick({ mode: 'speaking', seat: 4, draft: 2, queue: [2, 5, 7] }),
    ).toEqual({ kind: 'append-pair', by: 2, target: 4 })
  })

  it('append intent reports the input draft as `by` even when draft === 0 is rejected upstream', () => {
    // Defensive: append-pair never fires unless draft is a positive integer
    // because set-draft / clear-draft / collisions can only be issued from a
    // prior valid `set-draft`. This test asserts the structural shape of the
    // intent.
    expect(
      decideSpeakingTileClick({ mode: 'speaking', seat: 9, draft: 1, queue: [] }),
    ).toEqual({ kind: 'append-pair', by: 1, target: 9 })
  })
})

// ---------------------------------------------------------------------------
//  queue ops
// ---------------------------------------------------------------------------

describe('appendSpeakingPair', () => {
  it('appends [by, target] to an empty queue', () => {
    expect(appendSpeakingPair([], 1, 2)).toEqual([1, 2])
  })

  it('appends [by, target] to a non-empty queue', () => {
    expect(appendSpeakingPair([1, 2], 3, 4)).toEqual([1, 2, 3, 4])
  })

  it('returns input reference on invalid `by`', () => {
    const input = [1, 2]
    expect(appendSpeakingPair(input, 0, 5)).toBe(input)
    expect(appendSpeakingPair(input, -1, 5)).toBe(input)
    expect(appendSpeakingPair(input, 1.5, 5)).toBe(input)
  })

  it('returns input reference on invalid `target`', () => {
    const input = [1, 2]
    expect(appendSpeakingPair(input, 1, 0)).toBe(input)
    expect(appendSpeakingPair(input, 1, -2)).toBe(input)
    expect(appendSpeakingPair(input, 1, 2.7)).toBe(input)
  })
})

describe('removeSpeakingPairAt', () => {
  it('removes the indexed pair (even-length)', () => {
    expect(removeSpeakingPairAt([1, 2, 3, 4, 5, 6], 1)).toEqual([1, 2, 5, 6])
    expect(removeSpeakingPairAt([1, 2, 3, 4], 0)).toEqual([3, 4])
    expect(removeSpeakingPairAt([1, 2, 3, 4], 1)).toEqual([1, 2])
  })

  it('out-of-range pair index returns input ref (even-length)', () => {
    const input = [1, 2, 3, 4]
    expect(removeSpeakingPairAt(input, 5)).toBe(input)
    expect(removeSpeakingPairAt(input, -1)).toBe(input)
  })

  it('odd-length: treats index as single-entry slot (legacy)', () => {
    expect(removeSpeakingPairAt([1, 2, 3], 1)).toEqual([1, 3])
    expect(removeSpeakingPairAt([1, 2, 3], 2)).toEqual([1, 2])
    expect(removeSpeakingPairAt([1, 2, 3], 0)).toEqual([2, 3])
  })

  it('odd-length: out-of-range index returns input ref', () => {
    const input = [1, 2, 3]
    expect(removeSpeakingPairAt(input, 9)).toBe(input)
  })

  it('non-integer or negative pair index returns input ref', () => {
    const input = [1, 2, 3, 4]
    expect(removeSpeakingPairAt(input, -1)).toBe(input)
    expect(removeSpeakingPairAt(input, 1.5)).toBe(input)
  })
})

// ---------------------------------------------------------------------------
//  normalizeSpeakingQueueToPairs
// ---------------------------------------------------------------------------

describe('normalizeSpeakingQueueToPairs', () => {
  it('drops non-integers and out-of-range values, then truncates odd length', () => {
    // 7 raw → 3 valid (1, 2, 4) → odd → trimmed to [1, 2].
    expect(normalizeSpeakingQueueToPairs([1, 2, 'x', 3.5, -1, 0, 4])).toEqual([1, 2])
  })

  it('preserves an even count after filtering verbatim', () => {
    // 5 raw → 4 valid (1, 2, 3, 4) → even → stays intact.
    expect(normalizeSpeakingQueueToPairs([1, 'x', 2, 3, 4])).toEqual([1, 2, 3, 4])
  })

  it('truncates odd-length to even (pops the trailing entry)', () => {
    expect(normalizeSpeakingQueueToPairs([1, 2, 3])).toEqual([1, 2])
  })

  it('preserves a valid even-length queue verbatim', () => {
    expect(normalizeSpeakingQueueToPairs([1, 2, 3, 4])).toEqual([1, 2, 3, 4])
  })

  it('returns [] on non-array input', () => {
    expect(normalizeSpeakingQueueToPairs(null)).toEqual([])
    expect(normalizeSpeakingQueueToPairs(undefined)).toEqual([])
    expect(normalizeSpeakingQueueToPairs('queue')).toEqual([])
    expect(normalizeSpeakingQueueToPairs({ length: 2 })).toEqual([])
  })

  it('returns [] when all entries are dropped (filtered + post-trim odd)', () => {
    expect(normalizeSpeakingQueueToPairs(['a', 'b', 'c'])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
//  applySpeakingQueueFromSignaling — the host-draft-preservation guarantee
// ---------------------------------------------------------------------------

describe('applySpeakingQueueFromSignaling', () => {
  it('host: preserves nomination draft on own echo (shouldClearDraft=false)', () => {
    expect(applySpeakingQueueFromSignaling([1, 2, 3, 4], { isHost: true })).toEqual({
      nextQueue: [1, 2, 3, 4],
      shouldClearDraft: false,
    })
  })

  it('non-host: clears nomination draft on echo (shouldClearDraft=true)', () => {
    expect(applySpeakingQueueFromSignaling([1, 2, 3, 4], { isHost: false })).toEqual({
      nextQueue: [1, 2, 3, 4],
      shouldClearDraft: true,
    })
  })

  it('host: invalid payload returns empty queue without clearing draft', () => {
    expect(applySpeakingQueueFromSignaling(null, { isHost: true })).toEqual({
      nextQueue: [],
      shouldClearDraft: false,
    })
    expect(applySpeakingQueueFromSignaling('garbage', { isHost: true })).toEqual({
      nextQueue: [],
      shouldClearDraft: false,
    })
  })

  it('non-host: invalid payload returns empty queue and clears draft', () => {
    expect(applySpeakingQueueFromSignaling(null, { isHost: false })).toEqual({
      nextQueue: [],
      shouldClearDraft: true,
    })
  })

  it('truncates odd-length pre-storage on both sides', () => {
    expect(applySpeakingQueueFromSignaling([1, 2, 3], { isHost: true })).toEqual({
      nextQueue: [1, 2],
      shouldClearDraft: false,
    })
    expect(applySpeakingQueueFromSignaling([1, 2, 3], { isHost: false })).toEqual({
      nextQueue: [1, 2],
      shouldClearDraft: true,
    })
  })

  it('drops invalid entries and returns the integer-clamped queue (trimmed when odd)', () => {
    // 7 raw → 3 valid (1, 2, 4) → odd → trimmed to [1, 2].
    expect(
      applySpeakingQueueFromSignaling([1, 'foo', 2, 3.5, -1, 0, 4], { isHost: true }),
    ).toEqual({ nextQueue: [1, 2], shouldClearDraft: false })
    // 5 raw → 4 valid (1, 2, 3, 4) → even → preserved verbatim.
    expect(
      applySpeakingQueueFromSignaling([1, 'foo', 2, 3, 4], { isHost: true }),
    ).toEqual({ nextQueue: [1, 2, 3, 4], shouldClearDraft: false })
  })
})

// ---------------------------------------------------------------------------
//  remapSpeakingQueueForSeatSwap — identity preservation on no-op
// ---------------------------------------------------------------------------

describe('remapSpeakingQueueForSeatSwap', () => {
  it('swaps occurrences of seatA and seatB', () => {
    expect(remapSpeakingQueueForSeatSwap([1, 2, 3, 4], 2, 4)).toEqual([1, 4, 3, 2])
  })

  it('returns input ref when no occurrences', () => {
    const input = [1, 2, 3, 4]
    expect(remapSpeakingQueueForSeatSwap(input, 5, 6)).toBe(input)
  })

  it('no-op when seatA === seatB', () => {
    const input = [1, 2]
    expect(remapSpeakingQueueForSeatSwap(input, 2, 2)).toBe(input)
  })

  it('handles asymmetric occurrences', () => {
    expect(remapSpeakingQueueForSeatSwap([2, 5, 5, 7], 5, 8)).toEqual([2, 8, 8, 7])
  })

  it('preserves pair-encoded layout (length and parity unchanged)', () => {
    const remapped = remapSpeakingQueueForSeatSwap([1, 2, 3, 4], 1, 3)
    expect(remapped).toEqual([3, 2, 1, 4])
    expect(remapped.length).toBe(4)
    expect(remapped.length % 2).toBe(0)
  })

  it('works on an empty queue (returns same ref)', () => {
    const input: number[] = []
    expect(remapSpeakingQueueForSeatSwap(input, 1, 2)).toBe(input)
  })
})

// ---------------------------------------------------------------------------
//  transitionSpeakingMode — mutual-exclusion side-effect contract
// ---------------------------------------------------------------------------

describe('transitionSpeakingMode', () => {
  it('idle → speaking: clears swap selection, KEEPS draft', () => {
    expect(transitionSpeakingMode('idle', 'speaking')).toEqual({
      mode: 'speaking',
      shouldClearDraft: false,
      shouldClearSwapSelection: true,
    })
  })

  it('idle → swap: keeps swap selection (entering swap), clears draft', () => {
    expect(transitionSpeakingMode('idle', 'swap')).toEqual({
      mode: 'swap',
      shouldClearDraft: true,
      shouldClearSwapSelection: false,
    })
  })

  it('speaking → idle: clears draft AND swap selection', () => {
    expect(transitionSpeakingMode('speaking', 'idle')).toEqual({
      mode: 'idle',
      shouldClearDraft: true,
      shouldClearSwapSelection: true,
    })
  })

  it('speaking → swap (mutual exclusion): clears draft, keeps swap selection', () => {
    expect(transitionSpeakingMode('speaking', 'swap')).toEqual({
      mode: 'swap',
      shouldClearDraft: true,
      shouldClearSwapSelection: false,
    })
  })

  it('swap → speaking (mutual exclusion): clears swap selection, keeps draft', () => {
    expect(transitionSpeakingMode('swap', 'speaking')).toEqual({
      mode: 'speaking',
      shouldClearDraft: false,
      shouldClearSwapSelection: true,
    })
  })

  it('swap → idle: clears draft AND swap selection', () => {
    expect(transitionSpeakingMode('swap', 'idle')).toEqual({
      mode: 'idle',
      shouldClearDraft: true,
      shouldClearSwapSelection: true,
    })
  })

  it('same-mode transition is still well-defined (idempotent)', () => {
    expect(transitionSpeakingMode('speaking', 'speaking')).toEqual({
      mode: 'speaking',
      shouldClearDraft: false,
      shouldClearSwapSelection: true,
    })
    expect(transitionSpeakingMode('swap', 'swap')).toEqual({
      mode: 'swap',
      shouldClearDraft: true,
      shouldClearSwapSelection: false,
    })
  })
})

// ---------------------------------------------------------------------------
//  decodeSpeakingQueue — pair vs legacy semantics
// ---------------------------------------------------------------------------

describe('decodeSpeakingQueue', () => {
  it('decodes even-length as [by, target] pairs', () => {
    expect(decodeSpeakingQueue([1, 2, 3, 4])).toEqual([
      { pairIndex: 0, bySeat: 1, targetSeat: 2 },
      { pairIndex: 1, bySeat: 3, targetSeat: 4 },
    ])
  })

  it('decodes odd-length as legacy target-only', () => {
    expect(decodeSpeakingQueue([1, 2, 3])).toEqual([
      { pairIndex: 0, bySeat: null, targetSeat: 1 },
      { pairIndex: 1, bySeat: null, targetSeat: 2 },
      { pairIndex: 2, bySeat: null, targetSeat: 3 },
    ])
  })

  it('returns [] on empty', () => {
    expect(decodeSpeakingQueue([])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
//  End-to-end scenario — host-draft race regression guard
// ---------------------------------------------------------------------------

describe('regression: host nomination draft survives own echo between rapid clicks', () => {
  it('host clicks A → B → server echoes [A,B] → host clicks C → server echoes again → host clicks D → [A,B,C,D]', () => {
    // Step 1: Host clicks A.
    const c1 = decideSpeakingTileClick({ mode: 'speaking', seat: 1, draft: null, queue: [] })
    expect(c1).toEqual({ kind: 'set-draft', seat: 1 })
    let draft: number | null = 1
    let queue: number[] = []

    // Step 2: Host clicks B → appendSpeakingPair.
    const c2 = decideSpeakingTileClick({ mode: 'speaking', seat: 2, draft, queue })
    expect(c2).toEqual({ kind: 'append-pair', by: 1, target: 2 })
    queue = [...appendSpeakingPair(queue, 1, 2)]
    draft = null
    expect(queue).toEqual([1, 2])
    expect(draft).toBeNull()

    // Step 3: Echo of [1, 2] arrives. Host's draft is still null, no harm.
    const ec1 = applySpeakingQueueFromSignaling([1, 2], { isHost: true })
    queue = ec1.nextQueue
    if (ec1.shouldClearDraft) draft = null
    expect(queue).toEqual([1, 2])
    expect(draft).toBeNull()

    // Step 4: Host clicks C BEFORE the next echo.
    const c3 = decideSpeakingTileClick({ mode: 'speaking', seat: 3, draft, queue })
    expect(c3).toEqual({ kind: 'set-draft', seat: 3 })
    draft = 3

    // Step 5: A late echo of [1, 2] arrives (race) — draft must NOT be wiped.
    const ec2 = applySpeakingQueueFromSignaling([1, 2], { isHost: true })
    queue = ec2.nextQueue
    if (ec2.shouldClearDraft) draft = null
    expect(queue).toEqual([1, 2])
    expect(draft).toBe(3) // ← the regression: prior EatFirst code wiped this to null

    // Step 6: Host clicks D → pair (3, 4) appends correctly.
    const c4 = decideSpeakingTileClick({ mode: 'speaking', seat: 4, draft, queue })
    expect(c4).toEqual({ kind: 'append-pair', by: 3, target: 4 })
    queue = [...appendSpeakingPair(queue, 3, 4)]
    expect(queue).toEqual([1, 2, 3, 4])
  })

  it('non-host echo wipes draft (only the host is allowed to keep it)', () => {
    const ec = applySpeakingQueueFromSignaling([1, 2], { isHost: false })
    expect(ec.shouldClearDraft).toBe(true)
  })
})
