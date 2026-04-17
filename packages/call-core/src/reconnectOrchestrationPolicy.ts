/**
 * Pure reconnect / resync orchestration policy for `useCallEngine`.
 * Input → decision only: no WebSocket, transports, timers, or Pinia.
 *
 * Side effects stay in `useCallEngine`: `scheduleReconnectSignaling` (backoff + single-flight
 * timer → `tryReconnectSignalingAndMedia`), `scheduleRecvResyncAfterTabForeground` (debounce +
 * DOM visibility → `requestForcedProducerResync`).
 *
 * ------------------------------------------------------------------------------------------------
 * Mapping (audit): event → guards → side effects → policy decision
 * (Copy into PR description if useful.)
 *
 * | Event / trigger | Guards (before policy or in executor) | Current side effects | Policy decision |
 * |-----------------|----------------------------------------|------------------------|-----------------|
 * | `wsStatus`: was `open`, now `closed` or `error` | `intentionalLeave`, `inCall`; policy also: `joining`, `reconnectTimerActive` | `scheduleReconnectSignaling('socket-not-open')` | `schedule-reconnect` or `noop` |
 * | Reconnect after failed `tryReconnect` | `scheduleReconnectSignaling` internal | `scheduleReconnectSignaling('after-error')` | **Out of scope** — not modeled here; still uses same backoff |
 * | Backoff timer fires | N/A | `tryReconnectSignalingAndMedia()` | **Out of scope** — not an orchestration event |
 * | `visibilitychange` → page visible, WS `open` | `intentionalLeave`, `inCall` (handler also requires `visibilityState === 'visible'`) | `scheduleRecvResyncAfterTabForeground('visibility')` → debounced `requestForcedProducerResync` | `soft-resync` (visibility) |
 * | `visibilitychange` → page visible, WS not `open` | same | `scheduleReconnectSignaling('tab-visible-again')` — **not** soft-resync (no double path) | `schedule-reconnect` |
 * | `window` `focus`, WS `open` | `intentionalLeave`, `inCall` | `scheduleRecvResyncAfterTabForeground('focus')` | `soft-resync` (focus) |
 * | `window` `focus`, WS not `open` | `scheduleRecvResyncAfterTabForeground` returns early | **none** (no reconnect on focus alone) | `noop` |
 * | Intentional leave / not in call | policy | none | `noop` |
 * | `joining` while tab requests reconnect | not in policy for tab; `scheduleReconnectSignaling` no-ops | no timer stacked | `schedule-reconnect` from policy, executor may noop (duplicate guard **intentional**) |
 * | `joinCall` / `teardownMedia` | `clearReconnectTimer()` | timer cleared | **Out of scope** — engine lifecycle |
 * | `wireCallMediaAfterRoomState` | successful `joinCall` or successful `tryReconnect` | transports, recv, produce, soft producer-sync | **Out of scope** — not orchestration policy |
 *
 * WS flap note: only `open` → `closed`|`error` schedules reconnect; `closed` → `connecting` → `closed`
 * does not match `isSocketDropFromOpen`, so no extra stacked timers from the watcher beyond
 * `scheduleReconnectSignaling` single-flight + same backoff formula.
 * ------------------------------------------------------------------------------------------------
 */

export type WsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

export type OrchestrationInput = {
  intentionalLeave: boolean
  inCall: boolean
  joining: boolean
  wsStatus: WsStatus
  reconnectTimerActive: boolean
}

/**
 * - `noop`: do nothing for this orchestration event.
 * - `schedule-reconnect`: call `scheduleReconnectSignaling(reason)` — **same** backoff as today
 *   (`Math.min(30_000, 1000 * 2 ** min(failures, 5))`), single timer; when it fires, engine runs
 *   `tryReconnectSignalingAndMedia` (not decided here).
 * - `soft-resync`: call `scheduleRecvResyncAfterTabForeground(source)` → debounced
 *   `requestForcedProducerSync` (ordering unchanged vs `recoveryCoordinator` / `recvApplySerialQueue`).
 */
export type OrchestrationDecision =
  | { kind: 'noop' }
  | { kind: 'schedule-reconnect'; reason: string }
  | { kind: 'soft-resync'; source: 'visibility' | 'focus' }

function isSocketDropFromOpen(prev: WsStatus | undefined, next: WsStatus): boolean {
  return prev === 'open' && (next === 'closed' || next === 'error')
}

/**
 * When the signaling socket leaves `open` for `closed`/`error` after being `open`.
 * Joining + active reconnect timer → `noop` so parallel reconnect attempts match previous
 * `scheduleReconnectSignaling` behavior.
 */
export function decideAfterSocketStatusChange(
  prev: WsStatus | undefined,
  next: WsStatus,
  input: OrchestrationInput,
): OrchestrationDecision {
  if (input.intentionalLeave || !input.inCall) {
    return { kind: 'noop' }
  }
  if (!isSocketDropFromOpen(prev, next)) {
    return { kind: 'noop' }
  }
  if (input.joining || input.reconnectTimerActive) {
    return { kind: 'noop' }
  }
  return { kind: 'schedule-reconnect', reason: 'socket-not-open' }
}

/**
 * `visibilitychange` when `document.visibilityState === 'visible'` (caller checks).
 * When WS is not open, schedule reconnect (backoff), not an immediate full reconnect.
 * Mutually exclusive with soft-resync: dead WS → reconnect path only.
 */
export function decideAfterDocumentBecameVisible(input: OrchestrationInput): OrchestrationDecision {
  if (input.intentionalLeave || !input.inCall) {
    return { kind: 'noop' }
  }
  if (input.wsStatus === 'open') {
    return { kind: 'soft-resync', source: 'visibility' }
  }
  return { kind: 'schedule-reconnect', reason: 'tab-visible-again' }
}

/**
 * `window` `focus`. Unlike visibility, a dead socket does not schedule reconnect here —
 * only debounced soft-resync when WS is open (see `scheduleRecvResyncAfterTabForeground`).
 */
export function decideAfterWindowFocus(input: OrchestrationInput): OrchestrationDecision {
  if (input.intentionalLeave || !input.inCall) {
    return { kind: 'noop' }
  }
  if (input.wsStatus !== 'open') {
    return { kind: 'noop' }
  }
  return { kind: 'soft-resync', source: 'focus' }
}
