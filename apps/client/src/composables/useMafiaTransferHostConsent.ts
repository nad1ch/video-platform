import { onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { WsStatus } from 'call-core'
import { MafiaWs } from './mafiaWsProtocol'
import {
  parseMafiaTransferHostPending,
  parseMafiaTransferHostResult,
  type MafiaTransferHostPendingPayload,
  type MafiaTransferHostResultOutcome,
} from './mafiaTransferHostConsentParsers'

/**
 * Two-phase Mafia transfer-host consent — client-side signaling.
 *
 * **Status: FOUNDATION ONLY. No user-facing UI is wired and none is intended
 * in this branch.** The composable is mounted from `CallPage.vue` so the new
 * `mafia:transfer-host-pending` / `mafia:transfer-host-result` frames are
 * parsed (and not silently dropped) and so the `mafia:transfer-host-offer`
 * / `accept` / `reject` send helpers exist for any future UI. No button,
 * no modal, no prompt, no template hook reads the refs returned below.
 * If/when product decides to expose host-transfer to users, the UI PR is
 * a thin wrapper over the refs and helpers here — it must not bypass
 * `useMafiaTransferHostConsent` and must not add a second WS sender.
 *
 * Symmetric to the server module added in audit Finding I. Owns:
 *   - inbound: subscribes to `mafia:transfer-host-pending` and
 *     `mafia:transfer-host-result` and exposes them as reactive refs so a
 *     future UI (host modal, target prompt) can bind to them;
 *   - outbound: thin wrappers around `mafia:transfer-host-offer`,
 *     `mafia:transfer-host-accept`, `mafia:transfer-host-reject`.
 *
 * The composable holds no authoritative state — it is a UI cache for the
 * pending offer plus the last terminal outcome. The server remains the only
 * source of truth for host identity (see `useMafiaHostSignaling`).
 *
 * Auto-cleanup
 * ------------
 *  - clears local state on `wsStatus` leaving `'open'` (so a reconnect does
 *    not show a stale prompt);
 *  - clears the incoming prompt the moment we observe its `expiresAt` has
 *    passed (the server's timer authoritatively expires it too, but the
 *    local clear avoids a hanging prompt if the result frame is dropped);
 *  - on `onBeforeUnmount`, removes the subscriber and clears state.
 */

export type MafiaTransferHostIncomingOffer = MafiaTransferHostPendingPayload

export type MafiaTransferHostOutgoingOffer = {
  targetUserId: string
  /**
   * Local optimistic estimate of the expiry. The server is authoritative;
   * this is only used for the host's "waiting…" countdown UI. Cleared the
   * moment a `mafia:transfer-host-result` lands.
   */
  expiresAtLocal: number
}

export type UseMafiaTransferHostConsent = {
  pendingIncomingOffer: Ref<MafiaTransferHostIncomingOffer | null>
  pendingOutgoingOffer: Ref<MafiaTransferHostOutgoingOffer | null>
  lastTransferResult: Ref<MafiaTransferHostResultOutcome | null>
  sendTransferHostOffer: (targetUserId: string) => void
  acceptPendingTransfer: () => void
  rejectPendingTransfer: () => void
}

const DEFAULT_OFFER_TTL_MS = 30_000

export function useMafiaTransferHostConsent(
  sendSignalingMessage: (obj: object) => void,
  subscribeSignalingMessage: (fn: (data: unknown) => void) => () => void,
  wsStatus: Ref<WsStatus | string>,
): UseMafiaTransferHostConsent {
  const pendingIncomingOffer = ref<MafiaTransferHostIncomingOffer | null>(null)
  const pendingOutgoingOffer = ref<MafiaTransferHostOutgoingOffer | null>(null)
  const lastTransferResult = ref<MafiaTransferHostResultOutcome | null>(null)

  const off = subscribeSignalingMessage((data) => {
    const pending = parseMafiaTransferHostPending(data)
    if (pending != null) {
      pendingIncomingOffer.value = pending
      return
    }
    const result = parseMafiaTransferHostResult(data)
    if (result != null) {
      lastTransferResult.value = result.outcome
      // The result frame closes any open prompt on this client, regardless of
      // which role it was playing. Both refs are cleared so a stale modal is
      // not left on screen.
      pendingIncomingOffer.value = null
      pendingOutgoingOffer.value = null
    }
  })

  watch(wsStatus, (next) => {
    if (next !== 'open') {
      pendingIncomingOffer.value = null
      pendingOutgoingOffer.value = null
      lastTransferResult.value = null
    }
  })

  onBeforeUnmount(() => {
    off()
    pendingIncomingOffer.value = null
    pendingOutgoingOffer.value = null
    lastTransferResult.value = null
  })

  function sendTransferHostOffer(targetUserId: string): void {
    if (typeof targetUserId !== 'string' || targetUserId.length === 0) return
    if (wsStatus.value !== 'open') return
    sendSignalingMessage({
      type: MafiaWs.transferHostOffer,
      payload: { targetUserId },
    })
    pendingOutgoingOffer.value = {
      targetUserId,
      expiresAtLocal: Date.now() + DEFAULT_OFFER_TTL_MS,
    }
  }

  function acceptPendingTransfer(): void {
    if (pendingIncomingOffer.value == null) return
    if (wsStatus.value !== 'open') return
    sendSignalingMessage({ type: MafiaWs.transferHostAccept })
    // Optimistically clear; the server will follow up with `mafia:host-updated`
    // and `mafia:transfer-host-result`. The result handler above also clears.
    pendingIncomingOffer.value = null
  }

  function rejectPendingTransfer(): void {
    if (pendingIncomingOffer.value == null) return
    if (wsStatus.value !== 'open') return
    sendSignalingMessage({ type: MafiaWs.transferHostReject })
    pendingIncomingOffer.value = null
  }

  return {
    pendingIncomingOffer,
    pendingOutgoingOffer,
    lastTransferResult,
    sendTransferHostOffer,
    acceptPendingTransfer,
    rejectPendingTransfer,
  }
}
