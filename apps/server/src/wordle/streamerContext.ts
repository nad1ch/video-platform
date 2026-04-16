/**
 * When `DATABASE_URL` is unset (local dev), we still run one in-memory Wordle room + IRC ingest
 * using this synthetic id so URLs and WebSocket `streamerId` stay stable.
 */
export const DEV_FALLBACK_STREAMER_ID = '__dev_fallback_streamer__'
