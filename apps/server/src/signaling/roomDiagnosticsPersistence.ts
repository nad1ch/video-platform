/**
 * RoomDiagnostics persistence layer (D1.3).
 *
 * Registers a finalizer with `roomDiagnosticsBus` that, when the bus
 * elects to finalize a room bucket (empty-room grace elapsed), writes a
 * single `RoomDiagnosticReport` row to Prisma.
 *
 * Constraints:
 *   - Best-effort: a Prisma failure must NEVER block the bus or leak
 *     memory. We log via `console.error` and let the bucket clear.
 *   - No DB write for `session:<sid>` buckets (those stay in-memory).
 *   - No additional sanitization: the bus already redacts before storage.
 *   - No re-entrancy: persistence does not emit back into the bus on
 *     success (preventing loops). On failure we log to console only.
 */

import { Prisma } from '@prisma/client'
import { isDatabaseConfigured, prisma } from '../prisma'
import {
  BUCKET_PREFIX_SESSION,
  registerRoomDiagnosticsFinalizer,
  type RoomDiagnosticsFinalizationMeta,
  type RoomDiagnosticsSnapshot,
} from './roomDiagnosticsBus'
import {
  buildGameSessionReport,
  buildRoomDiagnosticReportMetadata,
} from './roomDiagnosticsReport'

let initialized = false

/**
 * Called once at server bootstrap from `index.ts`. Idempotent.
 */
export function initRoomDiagnosticsPersistence(): void {
  if (initialized) return
  initialized = true
  registerRoomDiagnosticsFinalizer(persistFinalizedReport)
}

function persistFinalizedReport(
  meta: RoomDiagnosticsFinalizationMeta,
  snapshot: RoomDiagnosticsSnapshot,
): void {
  // Synchronous wrapper: never throws into the bus's finalization loop.
  try {
    if (!isDatabaseConfigured()) return
    if (meta.bucketKey.startsWith(BUCKET_PREFIX_SESSION)) return
    // No async/await in the bus call stack: fire-and-forget the write so
    // the timer callstack returns immediately.
    void writeRoomDiagnosticReport(meta, snapshot).catch((err: unknown) => {
      console.error('[diagnostics-persist] write failed', {
        bucketKey: meta.bucketKey,
        reason: meta.reason,
        error: err instanceof Error ? err.message : String(err),
      })
    })
  } catch (err) {
    console.error('[diagnostics-persist] schedule failed', {
      bucketKey: meta.bucketKey,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function writeRoomDiagnosticReport(
  meta: RoomDiagnosticsFinalizationMeta,
  snapshot: RoomDiagnosticsSnapshot,
): Promise<void> {
  const reportMeta = buildRoomDiagnosticReportMetadata(meta.bucketKey, snapshot)
  const reportJson = buildGameSessionReport(meta.bucketKey, snapshot, {
    exportedBy: 'admin',
    finalizedAt: new Date(meta.finalizedAt),
    finalizedReason: meta.reason,
  })

  await prisma.roomDiagnosticReport.create({
    data: {
      roomId: reportMeta.roomId,
      gameType: reportMeta.gameType ?? null,
      startedAt: reportMeta.startedAt,
      endedAt: reportMeta.endedAt,
      durationMs: reportMeta.durationMs,
      eventCount: reportMeta.eventCount,
      warningCount: reportMeta.warningCount,
      errorCount: reportMeta.errorCount,
      criticalCount: reportMeta.criticalCount,
      hasErrors: reportMeta.hasErrors,
      hasWarnings: reportMeta.hasWarnings,
      truncated: reportMeta.truncated,
      hostUserId: reportMeta.hostUserId,
      hostDisplayName: reportMeta.hostDisplayName,
      participantCount: reportMeta.participantCount,
      finalizedReason: meta.reason,
      reportJson: reportJson as Prisma.InputJsonValue,
    },
  })
}
