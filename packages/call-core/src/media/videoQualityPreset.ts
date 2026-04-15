import type { RtpEncodingParameters } from 'mediasoup-client/types'

export type VideoQualityPreset = 'economy' | 'balanced' | 'hd'

/**
 * Manual UI presets (admin) + automatic room profiles.
 * Automatic profiles are chosen at safe wire points only (initial publish / reconnect), not on mid-call peer churn (avoids flapping + track restart loops).
 */
export type VideoPublishTier = VideoQualityPreset | 'auto_small_room' | 'auto_large_room'

export const VIDEO_QUALITY_PRESETS: VideoQualityPreset[] = ['economy', 'balanced', 'hd']

/** Inclusive: <= this many active camera publishers → high small-room profile. */
export const ACTIVE_CAMERA_SMALL_ROOM_MAX = 4

export function isVideoQualityPreset(v: string): v is VideoQualityPreset {
  return v === 'economy' || v === 'balanced' || v === 'hd'
}

/** Multi-user capture (~1024×576 @ 25fps). */
export const AUTO_LARGE_ROOM_VIDEO_CAPTURE = {
  WIDTH_IDEAL: 1024,
  HEIGHT_IDEAL: 576,
  WIDTH_MAX: 1280,
  HEIGHT_MAX: 720,
  FPS_IDEAL: 25,
  FPS_MAX: 30,
} as const

const AUTO_LARGE_SINGLE_LAYER_MAX_BITRATE_BPS = 2_000_000

const AUTO_LARGE_SIMULCAST_MAX_BITRATE_BPS = {
  R0: 250_000,
  R1: 700_000,
  R2: 2_000_000,
} as const

export type ProducerKindList = { peerId: string; kind: string }[]

/**
 * Active camera publishers at a wire snapshot: distinct peers with a video producer in `existingProducers`,
 * plus self when they will publish video on this wire.
 */
export function countActiveCameraPublishersAtWire(
  existingProducers: ProducerKindList,
  selfPeerId: string,
  selfWillPublishVideo: boolean,
): number {
  const ids = new Set<string>()
  for (const p of existingProducers) {
    if (p.kind === 'video') {
      ids.add(p.peerId)
    }
  }
  if (selfWillPublishVideo) {
    ids.add(selfPeerId)
  }
  return ids.size
}

export type ResolveOutgoingVideoPublishTierInput = {
  manualPreset: VideoQualityPreset
  /** User chose economy/balanced/hd in UI (or legacy LS). */
  manualExplicit: boolean
  /** Only admins see manual controls; when false, manual preset is ignored for encoding. */
  allowManualQuality: boolean
  activeCameraPublishersAtWire: number
}

/**
 * Single source of truth for outbound capture/encode tier at initial publish and reconnect.
 * Does not react to mid-call participant count changes (stable; avoids republish loops).
 */
export function resolveOutgoingVideoPublishTier(input: ResolveOutgoingVideoPublishTierInput): VideoPublishTier {
  if (input.allowManualQuality && input.manualExplicit) {
    return input.manualPreset
  }
  if (input.activeCameraPublishersAtWire <= ACTIVE_CAMERA_SMALL_ROOM_MAX) {
    return 'auto_small_room'
  }
  return 'auto_large_room'
}

/** @deprecated Use `resolveOutgoingVideoPublishTier` — kept for narrow call sites that only map explicit preset. */
export function resolveVideoPublishTier(preset: VideoQualityPreset, explicit: boolean): VideoPublishTier {
  if (!explicit) {
    return 'auto_large_room'
  }
  return preset
}

/** Capture constraints per tier (keeps CPU/encode predictable). */
export function getCallVideoConstraints(tier: VideoPublishTier): MediaTrackConstraints {
  switch (tier) {
    case 'auto_large_room':
      return {
        width: { ideal: AUTO_LARGE_ROOM_VIDEO_CAPTURE.WIDTH_IDEAL, max: AUTO_LARGE_ROOM_VIDEO_CAPTURE.WIDTH_MAX },
        height: { ideal: AUTO_LARGE_ROOM_VIDEO_CAPTURE.HEIGHT_IDEAL, max: AUTO_LARGE_ROOM_VIDEO_CAPTURE.HEIGHT_MAX },
        frameRate: { ideal: AUTO_LARGE_ROOM_VIDEO_CAPTURE.FPS_IDEAL, max: AUTO_LARGE_ROOM_VIDEO_CAPTURE.FPS_MAX },
      }
    case 'auto_small_room':
      return {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
      }
    case 'economy':
      return {
        width: { ideal: 640, max: 854 },
        height: { ideal: 360, max: 480 },
        frameRate: { ideal: 24, max: 30 },
      }
    case 'hd':
      return {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
      }
    case 'balanced':
    default:
      return {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
      }
  }
}

/** Outbound VP8 single layer (small rooms). */
export function getSingleLayerEncodingsForPreset(tier: VideoPublishTier): RtpEncodingParameters[] {
  switch (tier) {
    case 'auto_large_room':
      return [{ maxBitrate: AUTO_LARGE_SINGLE_LAYER_MAX_BITRATE_BPS, maxFramerate: AUTO_LARGE_ROOM_VIDEO_CAPTURE.FPS_IDEAL }]
    case 'auto_small_room':
      return [{ maxBitrate: 2_800_000, maxFramerate: 30 }]
    case 'economy':
      return [{ maxBitrate: 600_000, maxFramerate: 24 }]
    case 'hd':
      return [{ maxBitrate: 4_000_000, maxFramerate: 30 }]
    case 'balanced':
    default:
      return [{ maxBitrate: 2_800_000, maxFramerate: 30 }]
  }
}

/** Outbound VP8 simulcast (large rooms). */
export function getSimulcastEncodingsForPreset(tier: VideoPublishTier): RtpEncodingParameters[] {
  const fpsLarge = AUTO_LARGE_ROOM_VIDEO_CAPTURE.FPS_IDEAL
  const fps = tier === 'auto_large_room' ? fpsLarge : tier === 'economy' ? 24 : 30
  switch (tier) {
    case 'auto_large_room':
      return [
        { rid: 'r0', maxBitrate: AUTO_LARGE_SIMULCAST_MAX_BITRATE_BPS.R0, scaleResolutionDownBy: 4, maxFramerate: fpsLarge },
        { rid: 'r1', maxBitrate: AUTO_LARGE_SIMULCAST_MAX_BITRATE_BPS.R1, scaleResolutionDownBy: 2, maxFramerate: fpsLarge },
        { rid: 'r2', maxBitrate: AUTO_LARGE_SIMULCAST_MAX_BITRATE_BPS.R2, scaleResolutionDownBy: 1, maxFramerate: fpsLarge },
      ]
    case 'auto_small_room':
      return [
        { rid: 'r0', maxBitrate: 280_000, scaleResolutionDownBy: 4, maxFramerate: fps },
        { rid: 'r1', maxBitrate: 800_000, scaleResolutionDownBy: 2, maxFramerate: fps },
        { rid: 'r2', maxBitrate: 3_200_000, scaleResolutionDownBy: 1, maxFramerate: fps },
      ]
    case 'economy':
      return [
        { rid: 'r0', maxBitrate: 120_000, scaleResolutionDownBy: 4, maxFramerate: fps },
        { rid: 'r1', maxBitrate: 320_000, scaleResolutionDownBy: 2, maxFramerate: fps },
        { rid: 'r2', maxBitrate: 650_000, scaleResolutionDownBy: 1, maxFramerate: fps },
      ]
    case 'hd':
      return [
        { rid: 'r0', maxBitrate: 350_000, scaleResolutionDownBy: 4, maxFramerate: fps },
        { rid: 'r1', maxBitrate: 1_200_000, scaleResolutionDownBy: 2, maxFramerate: fps },
        { rid: 'r2', maxBitrate: 4_500_000, scaleResolutionDownBy: 1, maxFramerate: fps },
      ]
    case 'balanced':
    default:
      return [
        { rid: 'r0', maxBitrate: 280_000, scaleResolutionDownBy: 4, maxFramerate: fps },
        { rid: 'r1', maxBitrate: 800_000, scaleResolutionDownBy: 2, maxFramerate: fps },
        { rid: 'r2', maxBitrate: 3_200_000, scaleResolutionDownBy: 1, maxFramerate: fps },
      ]
  }
}
