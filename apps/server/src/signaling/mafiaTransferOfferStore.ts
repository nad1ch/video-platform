/**
 * In-memory Mafia transfer-host pending-offer store.
 *
 * **Status: FOUNDATION ONLY.** This module exists so that any future caller
 * of the transfer-host protocol cannot bypass target consent. No user-facing
 * UI is wired in this branch and no production traffic creates offers today
 * (no client invokes `mafia:transfer-host-offer` / the legacy
 * `mafia:transfer-host`). The store is therefore an invariant-keeper, not a
 * hot path — but the contract it pins must hold the moment UI is added.
 *
 * Implements the server-side state for the two-phase transfer-host consent
 * flow (audit Finding I). The current host creates an offer; the target must
 * `mafia:transfer-host-accept` (or `reject`) within {@link DEFAULT_OFFER_TTL_MS}
 * before the host change is applied. Authority remains server-side — accept /
 * reject only changes state when the sender's identity matches the recorded
 * target user + Mafia session.
 *
 * Storage
 * -------
 * One pending offer per Mafia `roomId` at a time. Creating a new offer
 * replaces (and times out) any prior offer. In-memory only; restart cancels
 * all offers, which is acceptable — host can reissue.
 *
 * Lifecycle
 * ---------
 *  - `createTransferOffer(roomId, offer, onExpire)` — replaces prior, schedules
 *    expiry via `setTimeout`, returns the prior offer (or `null`) so the caller
 *    can notify the previous target / host.
 *  - `getTransferOffer(roomId)` — lazy-expiry getter; returns `null` if the
 *    offer has passed `expiresAt` (and drops it).
 *  - `clearTransferOffer(roomId)` — clears timer + removes.
 *  - `clearTransferOfferForPeer(peerId)` — clears the offer if `peerId` is
 *    either the host or the target peer; returns which role matched so the
 *    caller can pick the right side-effect (notify host on target leave, etc.).
 *
 * No cross-Mafia leaks: the store is keyed by `roomId`. GameRoom transfers use
 * the separate generic flow (out of scope for this module).
 *
 * Test helpers: `_transferOfferStoreSizeForTests` and
 * `_resetMafiaTransferOfferStoreForTests` mirror the pattern used by
 * `mafiaRoomOwnerStore`.
 */

export const DEFAULT_OFFER_TTL_MS = 30_000

export type MafiaTransferOffer = {
  /** Current host's stable userId at offer creation time. */
  fromUserId: string
  /** Host's peer id — used by `clearTransferOfferForPeer` to detect host-leave. */
  fromPeerId: string
  /** Host's Mafia session id at offer creation time. */
  fromSessionId: string
  /** Host's `Peer.displayName` snapshot for the target prompt; `null` if unknown. */
  fromDisplayName: string | null
  /** Target user's stable userId. */
  targetUserId: string
  /** Target peer id — used by `clearTransferOfferForPeer` to detect target-leave. */
  targetPeerId: string
  /** Target peer's Mafia session id at offer creation time. */
  targetSessionId: string
  /** Absolute ms timestamp when the offer becomes invalid. */
  expiresAt: number
}

type StoredOffer = MafiaTransferOffer & {
  timer: ReturnType<typeof setTimeout> | null
}

const offerByRoomId = new Map<string, StoredOffer>()

function nowMs(): number {
  return Date.now()
}

/**
 * Create or replace the pending offer for `roomId`. If an offer already
 * existed, its expiry timer is cleared and the prior offer is returned so the
 * caller can notify the previous host/target that it was superseded. The new
 * offer's `expiresAt` is computed from the supplied TTL (defaulting to
 * {@link DEFAULT_OFFER_TTL_MS}). `onExpire` fires once if the timer elapses
 * before `clearTransferOffer` is called.
 */
export function createTransferOffer(
  roomId: string,
  offer: Omit<MafiaTransferOffer, 'expiresAt'>,
  onExpire: (expired: MafiaTransferOffer) => void,
  ttlMs: number = DEFAULT_OFFER_TTL_MS,
): MafiaTransferOffer | null {
  if (typeof roomId !== 'string' || roomId.length === 0) return null
  const prior = offerByRoomId.get(roomId) ?? null
  if (prior && prior.timer != null) {
    clearTimeout(prior.timer)
    prior.timer = null
  }
  const ttl = Math.max(0, ttlMs)
  const expiresAt = nowMs() + ttl
  const stored: StoredOffer = { ...offer, expiresAt, timer: null }
  offerByRoomId.set(roomId, stored)
  if (ttl > 0) {
    stored.timer = setTimeout(() => {
      const current = offerByRoomId.get(roomId)
      if (!current || current !== stored) return
      offerByRoomId.delete(roomId)
      try {
        onExpire(toPublicOffer(stored))
      } catch {
        /* never throw from expiry callback */
      }
    }, ttl)
  }
  return prior ? toPublicOffer(prior) : null
}

/**
 * Lazy-expiry getter. Returns `null` for an unseen roomId, or for an offer
 * whose `expiresAt` has already passed (which is also dropped from the store).
 * The timer-driven expiry should normally fire first, but a clock-jump or a
 * sync read in the same tick after expiry is handled here too.
 */
export function getTransferOffer(roomId: string): MafiaTransferOffer | null {
  const stored = offerByRoomId.get(roomId)
  if (!stored) return null
  if (stored.expiresAt <= nowMs()) {
    if (stored.timer != null) {
      clearTimeout(stored.timer)
      stored.timer = null
    }
    offerByRoomId.delete(roomId)
    return null
  }
  return toPublicOffer(stored)
}

/** Remove the pending offer for `roomId` (no-op when there isn't one). */
export function clearTransferOffer(roomId: string): MafiaTransferOffer | null {
  const stored = offerByRoomId.get(roomId)
  if (!stored) return null
  if (stored.timer != null) {
    clearTimeout(stored.timer)
    stored.timer = null
  }
  offerByRoomId.delete(roomId)
  return toPublicOffer(stored)
}

export type ClearedOfferRole = 'host' | 'target' | null

/**
 * Drop the offer for `roomId` if `peerId` matches either the host or the
 * target peer. Returns which side matched so the caller can decide whether to
 * notify the surviving party. No-op when the peer is unrelated to the offer.
 */
export function clearTransferOfferForPeer(
  roomId: string,
  peerId: string,
): { role: ClearedOfferRole; offer: MafiaTransferOffer | null } {
  const stored = offerByRoomId.get(roomId)
  if (!stored) return { role: null, offer: null }
  let role: ClearedOfferRole = null
  if (stored.fromPeerId === peerId) {
    role = 'host'
  } else if (stored.targetPeerId === peerId) {
    role = 'target'
  }
  if (role == null) {
    return { role: null, offer: null }
  }
  if (stored.timer != null) {
    clearTimeout(stored.timer)
    stored.timer = null
  }
  offerByRoomId.delete(roomId)
  return { role, offer: toPublicOffer(stored) }
}

function toPublicOffer(stored: StoredOffer): MafiaTransferOffer {
  // Explicit field copy avoids leaking the internal `timer` handle to callers.
  return {
    fromUserId: stored.fromUserId,
    fromPeerId: stored.fromPeerId,
    fromSessionId: stored.fromSessionId,
    fromDisplayName: stored.fromDisplayName,
    targetUserId: stored.targetUserId,
    targetPeerId: stored.targetPeerId,
    targetSessionId: stored.targetSessionId,
    expiresAt: stored.expiresAt,
  }
}

/** Test-only helpers (not exported through any barrel). */
export function _transferOfferStoreSizeForTests(): number {
  return offerByRoomId.size
}

export function _resetMafiaTransferOfferStoreForTests(): void {
  for (const stored of offerByRoomId.values()) {
    if (stored.timer != null) {
      clearTimeout(stored.timer)
      stored.timer = null
    }
  }
  offerByRoomId.clear()
}
