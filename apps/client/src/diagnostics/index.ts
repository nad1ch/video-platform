/**
 * Public re-export surface for the diagnostics client API (Block D1).
 *
 * Consumers import via `@/diagnostics`. Subpath imports
 * (`@/diagnostics/useDiagnostics`) remain available for advanced cases.
 */
export {
  emitDiagnosticEvent,
  flushDiagnostics,
  getDiagnosticsDroppedCount,
  installDiagnosticsVueErrorHandler,
  setDiagnosticsContext,
  type DiagnosticEventInput,
} from './useDiagnostics'

export type {
  DiagnosticArea,
  DiagnosticEvent,
  DiagnosticEventType,
  DiagnosticGameType,
  DiagnosticLevel,
  GameSessionReport,
} from './schema'
