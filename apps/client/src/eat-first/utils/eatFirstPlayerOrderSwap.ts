/**
 * Pure helpers for the Eat First host-side positional player swap.
 *
 * Semantic (Choice A — Mafia / Game Template parity):
 *   - Swap the two slots' POSITIONS inside `playerOrder`.
 *   - Leave `slotByPeer` and `traitsBySlot` / `actionCardBySlot` untouched.
 *   - Players keep their slot identity (and therefore their traits / action
 *     cards). Only the visual seat number changes.
 *   - The speaking queue stores 1-based seat numbers that index into
 *     `playerOrder`; after the swap those entries must be remapped so the
 *     same logical players remain the nominator / nominee.
 *
 * `swapEatFirstPlayerOrder` is Eat First-specific (slot ids are `pN`
 * strings). `remapEatFirstSpeakingQueueForSwap` is a thin pass-through to
 * the shared `remapSpeakingQueueForSeatSwap` in
 * `@/utils/speakingNominationController` — Mafia, Game Template, and Eat
 * First all reuse the same identity-preserving remap so a follow-up Mafia
 * migration onto the shared controller will not change behavior. The
 * named re-export is kept so existing call sites (shell store, regression
 * guards) continue to compile against this Eat First-namespaced module.
 *
 * Both helpers are **pure** and return the original reference when the
 * call is a no-op so callers can use referential equality to short-circuit
 * watchers / broadcasts.
 */

import { remapSpeakingQueueForSeatSwap } from '@/utils/speakingNominationController'

/**
 * Swap two slot positions inside a player-order list.
 *
 * Returns a NEW array with `slotA` and `slotB` exchanging positions, OR
 * the input array (same reference) when:
 *   - `slotA === slotB`, or
 *   - either slot is absent from `order`.
 *
 * Idempotent on no-op. Does not mutate the input.
 */
export function swapEatFirstPlayerOrder(
  order: readonly string[],
  slotA: string,
  slotB: string,
): readonly string[] {
  if (slotA === slotB) return order
  const ia = order.indexOf(slotA)
  if (ia < 0) return order
  const ib = order.indexOf(slotB)
  if (ib < 0) return order
  const next = order.slice()
  next[ia] = slotB
  next[ib] = slotA
  return next
}

/**
 * Remap 1-based seat numbers in the Eat First speaking queue after a
 * positional swap of two seats. Thin Eat First-namespaced alias around the
 * shared `remapSpeakingQueueForSeatSwap` controller helper so every route
 * uses the same implementation. Identity-preserving on no-op.
 */
export function remapEatFirstSpeakingQueueForSwap(
  queue: readonly number[],
  seatA: number,
  seatB: number,
): readonly number[] {
  return remapSpeakingQueueForSeatSwap(queue, seatA, seatB)
}
