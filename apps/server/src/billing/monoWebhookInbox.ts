import type { Prisma } from '@prisma/client'
import { isDatabaseConfigured, prisma } from '../prisma'
import { ingestStatementWebhook } from './billingService'

/**
 * Durable webhook inbox helpers (audit Batch G).
 *
 * The webhook handler in `billingRouter.ts` writes every valid Mono delivery
 * here BEFORE attempting `ingestStatementWebhook`, so a downstream throw
 * (DB blip, parse drift, matcher failure) does not lose the raw payload.
 *
 * Activation idempotency is at the `MonoTransaction` table downstream
 * (`monoTransactionId @unique`), so re-running this against the same row is
 * always safe — it is an upsert plus a Serializable matcher pass that
 * re-reads authoritative state.
 *
 * No background scheduler is wired here in this batch; the row is processed
 * once inline after enqueue. Admin tooling / a future scheduler can replay
 * any row with `processedAt IS NULL`.
 */

export type InboxEnqueueResult = { id: string } | null

const LAST_ERROR_MAX_CHARS = 1000

/**
 * Persist the raw webhook payload as an inbox row. Returns `null` when the
 * database is not configured (dev without `DATABASE_URL`) so callers can fall
 * back to the legacy inline path. Never throws.
 */
export async function enqueueMonoWebhook(rawBody: unknown): Promise<InboxEnqueueResult> {
  if (!isDatabaseConfigured()) return null
  try {
    const row = await prisma.monoWebhookInbox.create({
      data: {
        payloadJson: (rawBody ?? null) as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    return { id: row.id }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[billing] monoWebhookInbox enqueue failed', err)
    }
    return null
  }
}

/**
 * Process one inbox row by id. Re-reads the payload, calls
 * `ingestStatementWebhook`, and either marks `processedAt` on success or
 * increments `attempts` + stores `lastError` on failure. Idempotent: a row
 * that already has `processedAt` is skipped. Never throws.
 */
export async function processMonoWebhookInboxRow(inboxId: string): Promise<void> {
  if (!isDatabaseConfigured()) return
  let row: { id: string; payloadJson: Prisma.JsonValue; processedAt: Date | null } | null
  try {
    row = await prisma.monoWebhookInbox.findUnique({
      where: { id: inboxId },
      select: { id: true, payloadJson: true, processedAt: true },
    })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[billing] inbox row fetch failed', { inboxId, err })
    }
    return
  }
  if (!row || row.processedAt) return

  try {
    await ingestStatementWebhook(row.payloadJson)
    try {
      await prisma.monoWebhookInbox.update({
        where: { id: row.id },
        data: {
          processedAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
        },
      })
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[billing] inbox row mark-processed failed', { inboxId, err })
      }
    }
  } catch (err) {
    const message = formatInboxErrorMessage(err)
    try {
      await prisma.monoWebhookInbox.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          lastError: message,
        },
      })
    } catch {
      /* best-effort — attempt counter is non-critical */
    }
  }
}

/**
 * Pure helper. Truncates and labels the error for storage in `lastError`.
 * Pulled out so a unit test can pin the redaction without touching Prisma.
 */
export function formatInboxErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const base = `${err.name}: ${err.message ?? ''}`.trim()
    return base.length > LAST_ERROR_MAX_CHARS
      ? base.slice(0, LAST_ERROR_MAX_CHARS)
      : base
  }
  const s = typeof err === 'string' ? err : 'unknown'
  return s.length > LAST_ERROR_MAX_CHARS ? s.slice(0, LAST_ERROR_MAX_CHARS) : s
}
