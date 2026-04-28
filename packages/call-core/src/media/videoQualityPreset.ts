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
export const CALL_VIDEO_WIDTH = 854
export const CALL_VIDEO_HEIGHT = 480
export const CALL_VIDEO_MIN_FRAMERATE = 12
export const CALL_VIDEO_MAX_FRAMERATE = 20
export const CALL_VIDEO_TARGET_BITRATE_BPS = 600_000
export const CALL_VIDEO_MIN_BITRATE_BPS = 500_000
export const CALL_VIDEO_MAX_BITRATE_BPS = 700_000

export function isVideoQualityPreset(v: string): v is VideoQualityPreset {
  return v === 'economy' || v === 'balanced' || v === 'hd'
}

function clampCallVideoFramerate(fps: number): number {
  return Math.min(CALL_VIDEO_MAX_FRAMERATE, Math.max(CALL_VIDEO_MIN_FRAMERATE, Math.round(fps)))
}

export function clampCallVideoBitrate(bps: number): number {
  return Math.min(CALL_VIDEO_MAX_BITRATE_BPS, Math.max(CALL_VIDEO_MIN_BITRATE_BPS, Math.round(bps)))
}

export const FIXED_CALL_VIDEO_ENCODING: RtpEncodingParameters = {
  maxBitrate: clampCallVideoBitrate(CALL_VIDEO_TARGET_BITRATE_BPS),
  maxFramerate: CALL_VIDEO_MAX_FRAMERATE,
  scaleResolutionDownBy: 1,
} as const

/**
 * Fixed call camera capture: every participant publishes exactly 854×480 with a 20 fps cap.
 */
export const VIDEO_PRESET_MAFIA: MediaTrackConstraints = {
  width: { exact: CALL_VIDEO_WIDTH },
  height: { exact: CALL_VIDEO_HEIGHT },
  frameRate: { max: CALL_VIDEO_MAX_FRAMERATE },
} as const

/**
 * Back-compat export; fixed-quality calls intentionally use the same capture constraints for every tier.
 */
export const VIDEO_PRESET_FALLBACK: MediaTrackConstraints = {
  ...VIDEO_PRESET_MAFIA,
} as const

/**
 * Numeric view of the fixed capture target for call sites that read `WIDTH_IDEAL` / `FPS_MAX`.
 */
export const AUTO_LARGE_ROOM_VIDEO_CAPTURE = {
  WIDTH_IDEAL: CALL_VIDEO_WIDTH,
  HEIGHT_IDEAL: CALL_VIDEO_HEIGHT,
  WIDTH_MAX: CALL_VIDEO_WIDTH,
  HEIGHT_MAX: CALL_VIDEO_HEIGHT,
  FPS_IDEAL: CALL_VIDEO_MAX_FRAMERATE,
  FPS_MAX: CALL_VIDEO_MAX_FRAMERATE,
} as const

/** Back-compat export; small rooms use the same fixed 480p capture as every other room. */
export const AUTO_SMALL_ROOM_VIDEO_CAPTURE = {
  WIDTH_IDEAL: CALL_VIDEO_WIDTH,
  HEIGHT_IDEAL: CALL_VIDEO_HEIGHT,
  WIDTH_MAX: CALL_VIDEO_WIDTH,
  HEIGHT_MAX: CALL_VIDEO_HEIGHT,
} as const

/**
 * Back-compat shape for older imports. All entries are the same fixed 480p layer; publishing uses one encoding only.
 */
export const AUTO_LARGE_ROOM_SIMULCAST = {
  low: { ...FIXED_CALL_VIDEO_ENCODING },
  medium: { ...FIXED_CALL_VIDEO_ENCODING },
  high: { ...FIXED_CALL_VIDEO_ENCODING },
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
 * Single source of truth for outbound capture/encode tier.
 * Fixed-quality calls intentionally ignore manual presets and participant counts.
 */
export function resolveOutgoingVideoPublishTier(input: ResolveOutgoingVideoPublishTierInput): VideoPublishTier {
  void input
  return 'auto_large_room'
}

/** @deprecated Use `resolveOutgoingVideoPublishTier` — kept for narrow call sites that only map explicit preset. */
export function resolveVideoPublishTier(preset: VideoQualityPreset, explicit: boolean): VideoPublishTier {
  void preset
  void explicit
  return 'auto_large_room'
}

/** Fixed capture constraints for every tier. */
export function getCallVideoConstraints(tier: VideoPublishTier): MediaTrackConstraints {
  void tier
  return { ...VIDEO_PRESET_MAFIA }
}

/**
 * Outbound VP8 single encoding. Every tier maps to the same fixed 480p / 20 fps / 600 kbps layer.
 */
export function getSingleLayerEncodingsForPreset(tier: VideoPublishTier): RtpEncodingParameters[] {
  void tier
  return [{ ...FIXED_CALL_VIDEO_ENCODING, maxFramerate: clampCallVideoFramerate(CALL_VIDEO_MAX_FRAMERATE) }]
}

/** Back-compat API: simulcast is disabled, so callers still receive exactly one fixed encoding. */
export function getSimulcastEncodingsForPreset(tier: VideoPublishTier): RtpEncodingParameters[] {
  void tier
  return getSingleLayerEncodingsForPreset('auto_large_room')
}
