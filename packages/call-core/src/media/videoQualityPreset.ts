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
export const CALL_VIDEO_MIN_FRAMERATE = 12
export const CALL_VIDEO_MAX_FRAMERATE = 24

export function isVideoQualityPreset(v: string): v is VideoQualityPreset {
  return v === 'economy' || v === 'balanced' || v === 'hd'
}

function clampCallVideoFramerate(fps: number): number {
  return Math.min(CALL_VIDEO_MAX_FRAMERATE, Math.max(CALL_VIDEO_MIN_FRAMERATE, Math.round(fps)))
}

/**
 * Main large-room (Mafia / 6–12) capture: **960×540** @ 24 fps — strong balance of clarity vs CPU and uplink.
 * Paired with {@link AUTO_LARGE_ROOM_SIMULCAST}: “720-class” *feel* on tile without 720p-for-all cost.
 */
export const VIDEO_PRESET_MAFIA: MediaTrackConstraints = {
  width: { ideal: 960, max: 960 },
  height: { ideal: 540, max: 540 },
  frameRate: { ideal: 24, max: 24 },
} as const

/**
 * Weaker devices / last-resort camera hint. Not auto-selected by `resolveOutgoingVideoPublishTier` (export for
 * admin or future gating), but kept as the single place for the numbers.
 */
export const VIDEO_PRESET_FALLBACK: MediaTrackConstraints = {
  width: { ideal: 640, max: 640 },
  height: { ideal: 360, max: 360 },
  frameRate: { ideal: 20, max: 20 },
} as const

/**
 * Numeric view of `VIDEO_PRESET_MAFIA` for call sites that read `WIDTH_IDEAL` / `FPS_MAX` (send transport, tests).
 * Single-room **normal** should not *encode* 360p as the only layer — that is the **R0** simulcast rung + receive
 * degradation, not the default capture target.
 */
export const AUTO_LARGE_ROOM_VIDEO_CAPTURE = {
  WIDTH_IDEAL: 960,
  HEIGHT_IDEAL: 540,
  WIDTH_MAX: 960,
  HEIGHT_MAX: 540,
  FPS_IDEAL: CALL_VIDEO_MAX_FRAMERATE,
  FPS_MAX: CALL_VIDEO_MAX_FRAMERATE,
} as const

/** Small-room capture: 720p ideal; fps cap follows large-room (24) for a consistent feel when switching tiers. */
export const AUTO_SMALL_ROOM_VIDEO_CAPTURE = {
  WIDTH_IDEAL: 1280,
  HEIGHT_IDEAL: 720,
  WIDTH_MAX: 1920,
  HEIGHT_MAX: 1080,
} as const

/**
 * `auto_large_room` VP8 simulcast ladder (r0 / r1 / r2) — mediasoup `maxBitrate` caps; CC can send less.
 * - **low** (~320p-class @12fps): pressure / off-tile; low, but still watchable in large grids.
 * - **medium** (x2 of 960x540 -> 480x270, ~20fps): main UX rung for {@link MAX_MEDIUM_STREAMS} visible peers.
 * - **high** (540p @22fps, <=1Mbps): active speaker / host; {@link MAX_HIGH_STREAMS} slots.
 * Single-layer (no simulcast): one encoding capped like **high** (no 2M+ bloat).
 */
export const AUTO_LARGE_ROOM_SIMULCAST = {
  low: { scaleResolutionDownBy: 3, maxBitrate: 500_000, maxFramerate: 14 },
  medium: { scaleResolutionDownBy: 2, maxBitrate: 700_000, maxFramerate: 20 },
  high: { scaleResolutionDownBy: 1, maxBitrate: 1_000_000, maxFramerate: 22 },
} as const

const AUTO_LARGE_SINGLE_LAYER_MAX_BITRATE_BPS = AUTO_LARGE_ROOM_SIMULCAST.high.maxBitrate

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
      return { ...VIDEO_PRESET_MAFIA }
    case 'auto_small_room':
      return {
        width: { ideal: AUTO_SMALL_ROOM_VIDEO_CAPTURE.WIDTH_IDEAL, max: AUTO_SMALL_ROOM_VIDEO_CAPTURE.WIDTH_MAX },
        height: { ideal: AUTO_SMALL_ROOM_VIDEO_CAPTURE.HEIGHT_IDEAL, max: AUTO_SMALL_ROOM_VIDEO_CAPTURE.HEIGHT_MAX },
        frameRate: { ideal: AUTO_LARGE_ROOM_VIDEO_CAPTURE.FPS_IDEAL, max: AUTO_LARGE_ROOM_VIDEO_CAPTURE.FPS_MAX },
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

/**
 * Outbound VP8 single encoding (used when this publish does not enable simulcast — see send transport).
 * Tier still follows the same capture profiles as `getCallVideoConstraints`.
 */
export function getSingleLayerEncodingsForPreset(tier: VideoPublishTier): RtpEncodingParameters[] {
  switch (tier) {
    case 'auto_large_room':
      return [
        {
          maxBitrate: AUTO_LARGE_SINGLE_LAYER_MAX_BITRATE_BPS,
          maxFramerate: clampCallVideoFramerate(AUTO_LARGE_ROOM_SIMULCAST.high.maxFramerate),
        },
      ]
    case 'auto_small_room':
      return [{ maxBitrate: 2_800_000, maxFramerate: clampCallVideoFramerate(AUTO_LARGE_ROOM_VIDEO_CAPTURE.FPS_IDEAL) }]
    case 'economy':
      return [{ maxBitrate: 600_000, maxFramerate: clampCallVideoFramerate(24) }]
    case 'hd':
      return [{ maxBitrate: 4_000_000, maxFramerate: clampCallVideoFramerate(30) }]
    case 'balanced':
    default:
      return [{ maxBitrate: 2_800_000, maxFramerate: clampCallVideoFramerate(30) }]
  }
}

/** Outbound VP8 simulcast (large rooms). */
export function getSimulcastEncodingsForPreset(tier: VideoPublishTier): RtpEncodingParameters[] {
  const fpsLarge = clampCallVideoFramerate(AUTO_LARGE_ROOM_VIDEO_CAPTURE.FPS_IDEAL)
  const fps =
    tier === 'auto_large_room' || tier === 'auto_small_room'
      ? fpsLarge
      : tier === 'economy'
        ? clampCallVideoFramerate(24)
        : clampCallVideoFramerate(30)
  switch (tier) {
    case 'auto_large_room': {
      const s = AUTO_LARGE_ROOM_SIMULCAST
      return [
        { rid: 'r0', ...s.low },
        { rid: 'r1', ...s.medium },
        { rid: 'r2', ...s.high },
      ]
    }
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
