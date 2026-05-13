/**
 * Default HTTP port when `PORT` is unset (host `npm run dev -w server` only).
 * Keep in sync with `apps/client/vite.config.ts` (VITE_DEV_API_PROXY default) and
 * the DEV fallback in `packages/call-core/src/signaling/useRoomConnection.ts`.
 * Docker / production must set `PORT` explicitly (compose uses 3000).
 */
export const LOCAL_DEV_API_PORT = 3333
