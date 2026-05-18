/**
 * Pure parsers for the two server-emitted Mafia transfer-host consent
 * messages. Split out of `useMafiaTransferHostConsent.ts` so they can be
 * unit-tested in `packages/client-consistency` without booting Vue / Pinia.
 *
 * Both parsers return `null` on any malformed input — same defensive pattern
 * as the other Mafia inbound parsers in `useMafiaHostSignaling.ts`.
 */

import { MafiaWs } from './mafiaWsProtocol'

export type MafiaTransferHostPendingPayload = {
  fromUserId: string
  fromDisplayName: string | null
  expiresAt: number
}

export type MafiaTransferHostResultOutcome = 'accepted' | 'rejected' | 'expired' | 'cancelled'

export type MafiaTransferHostResultPayload = {
  outcome: MafiaTransferHostResultOutcome
}

export function parseMafiaTransferHostPending(
  data: unknown,
): MafiaTransferHostPendingPayload | null {
  if (!data || typeof data !== 'object') return null
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== MafiaWs.transferHostPending) return null
  const p = o.payload
  if (!p || typeof p !== 'object') return null
  const fromUserId = (p as { fromUserId?: unknown }).fromUserId
  if (typeof fromUserId !== 'string' || fromUserId.length === 0) return null
  const rawName = (p as { fromDisplayName?: unknown }).fromDisplayName
  const fromDisplayName =
    typeof rawName === 'string' && rawName.length > 0 ? rawName : null
  const expiresAt = (p as { expiresAt?: unknown }).expiresAt
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt <= 0) {
    return null
  }
  return { fromUserId, fromDisplayName, expiresAt }
}

const VALID_OUTCOMES: ReadonlySet<MafiaTransferHostResultOutcome> = new Set([
  'accepted',
  'rejected',
  'expired',
  'cancelled',
])

export function parseMafiaTransferHostResult(
  data: unknown,
): MafiaTransferHostResultPayload | null {
  if (!data || typeof data !== 'object') return null
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== MafiaWs.transferHostResult) return null
  const p = o.payload
  if (!p || typeof p !== 'object') return null
  const outcome = (p as { outcome?: unknown }).outcome
  if (typeof outcome !== 'string') return null
  if (!VALID_OUTCOMES.has(outcome as MafiaTransferHostResultOutcome)) return null
  return { outcome: outcome as MafiaTransferHostResultOutcome }
}
