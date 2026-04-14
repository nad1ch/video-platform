import { VideoPresets } from 'livekit-client'

/** LiveKit WebSocket URL (наприклад wss://PROJECT.livekit.cloud). */
export function liveKitConfigured() {
  return Boolean(String(import.meta.env.VITE_LIVEKIT_URL ?? '').trim())
}

export function getLiveKitServerUrl() {
  return String(import.meta.env.VITE_LIVEKIT_URL ?? '').trim()
}

/**
 * URL для POST JSON { roomName, identity, name, canPublish } → { token }.
 * Dev (Vite): /__livekit/token (middleware). Прод / preview (Vercel): /api/livekit-token.
 */
export function getLiveKitTokenUrl() {
  const u = String(import.meta.env.VITE_LIVEKIT_TOKEN_URL ?? '').trim()
  if (u) return u
  if (import.meta.env.DEV) return '/__livekit/token'
  return '/api/livekit-token'
}

/**
 * Якість відео для підписника (simulcast): high | medium | low.
 * low — мінімальний шар (~180p), medium — середній (~360p залежно від SFU), high — без обмежень у клієнті.
 * На паблішері має бути увімкнений simulcast, інакше ефекту може не бути.
 */
export function getLiveKitSubscribeQualityMode() {
  return String(import.meta.env.VITE_LK_SUBSCRIBE_VIDEO_QUALITY ?? 'high').toLowerCase()
}

/** Основний шар Full HD (~3 Mbps — компроміс артефакти / навантаження для VP8 simulcast). */
const PRIMARY_FHD_MAX_BITRATE = 3_000_000
const PRIMARY_FHD_MAX_FRAMERATE = 30

/**
 * Параметри getUserMedia для вебками: 1080p + явні 30 fps (без «розгону» до 60 fps з камери).
 */
export function getLiveKitVideoCaptureDefaults() {
  return {
    resolution: VideoPresets.h1080.resolution,
    frameRate: PRIMARY_FHD_MAX_FRAMERATE,
  }
}

/**
 * Публікація камери: VP8 simulcast — рівно **три** відеошари (RID q/h/f), не чотири.
 * У client-sdk-js з `videoSimulcastLayers` беруться лише **перші два** пресети; третій — це завжди
 * primary (1080p). Тобто `[h180, h360, h720]` **не** дасть окремо 360 і 720: третій елемент ігнорується.
 * Щоб мати «масово низька якість + гравці ближче до HD + OBS full» → **[h180, h720]** → шари ~180p, ~720p, 1080p.
 */
export function getLiveKitPublishDefaults() {
  return {
    simulcast: true,
    videoEncoding: {
      maxBitrate: PRIMARY_FHD_MAX_BITRATE,
      maxFramerate: PRIMARY_FHD_MAX_FRAMERATE,
    },
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h720],
  }
}
