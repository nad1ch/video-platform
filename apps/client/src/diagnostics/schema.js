/**
 * Diagnostics + GameSessionReport schema — client-side type-only copy.
 *
 * The server keeps a mirrored type module at
 * `apps/server/src/signaling/roomDiagnosticsTypes.ts`. The two files define
 * the same JSON wire format used by `POST /api/events/room` and the admin
 * report endpoint; runtime never crosses the boundary, matching the existing
 * `mafiaWsProtocol.ts` client/server duplication pattern.
 *
 * Deliberately not placed under `packages/call-core/` — diagnostics is
 * broader than the call/media stack and we do not want app-level event
 * vocabularies to bleed into the reusable WebRTC package.
 */
export {};
