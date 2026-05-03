import type { RtpEncodingParameters } from 'mediasoup-client/types'

export type VideoQualityPreset = 'economy' | 'balanced' | 'hd'

/**
 * Manual UI presets (admin) + automatic room profiles.
 * Automatic profiles are chosen at safe wire points only (initial publish / reconnect), not on mid-call peer churn (avoids flapping + track restart loops).
 */
export type VideoPublishTier = VideoQualityPreset | 'auto_small_room' | 'auto_large_room'

export const VIDEO_QUALITY_PRESETS: VideoQualityPreset[] = ['economy', 'balanced', 'hd']


export const ACTIVE_CAMERA_SMALL_ROOM_MAX = 4
export const CALL_VIDEO_WIDTH = 854
export const CALL_VIDEO_HEIGHT = 480
export const CALL_VIDEO_MIN_FRAMERATE = 12
export const CALL_VIDEO_MAX_FRAMERATE = 20
export const CALL_VIDEO_TARGET_BITRATE_BPS = 600_000
export const CALL_VIDEO_MIN_BITRATE_BPS = 500_000
export const CALL_VIDEO_MAX_BITRATE_BPS = 700_000

/**
 * Mobile-friendly capture preset. Server `RtpEncoding`/`maxBitrate` ceiling stays
 * at desktop values (set in `FIXED_CALL_VIDEO_ENCODING`), but the camera capture
 * itself is allowed to deliver at most 640×360 / 15 fps so phones avoid running
 * the camera ISP and the encoder pipeline at full 854×480/20 fps. Constraints
 * use `ideal/max` (never `exact`) so devices that cannot match a value still
 * fall back gracefully instead of failing `getUserMedia`.
 */
export const CALL_VIDEO_MOBILE_WIDTH = 640
export const CALL_VIDEO_MOBILE_HEIGHT = 360
export const CALL_VIDEO_MOBILE_MAX_FRAMERATE = 15

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




export const VIDEO_PRESET_MAFIA: MediaTrackConstraints = {
  width: { exact: CALL_VIDEO_WIDTH },
  height: { exact: CALL_VIDEO_HEIGHT },
  frameRate: { max: CALL_VIDEO_MAX_FRAMERATE },
} as const




export const VIDEO_PRESET_FALLBACK: MediaTrackConstraints = {
  ...VIDEO_PRESET_MAFIA,
} as const




export const AUTO_LARGE_ROOM_VIDEO_CAPTURE = {
  WIDTH_IDEAL: CALL_VIDEO_WIDTH,
  HEIGHT_IDEAL: CALL_VIDEO_HEIGHT,
  WIDTH_MAX: CALL_VIDEO_WIDTH,
  HEIGHT_MAX: CALL_VIDEO_HEIGHT,
  FPS_IDEAL: CALL_VIDEO_MAX_FRAMERATE,
  FPS_MAX: CALL_VIDEO_MAX_FRAMERATE,
} as const


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
  
  manualExplicit: boolean
  
  allowManualQuality: boolean
  activeCameraPublishersAtWire: number
}





export function resolveOutgoingVideoPublishTier(input: ResolveOutgoingVideoPublishTierInput): VideoPublishTier {
  void input
  return 'auto_large_room'
}


export function resolveVideoPublishTier(preset: VideoQualityPreset, explicit: boolean): VideoPublishTier {
  void preset
  void explicit
  return 'auto_large_room'
}


export const VIDEO_PRESET_MOBILE: MediaTrackConstraints = {
  width: { ideal: CALL_VIDEO_MOBILE_WIDTH, max: CALL_VIDEO_WIDTH },
  height: { ideal: CALL_VIDEO_MOBILE_HEIGHT, max: CALL_VIDEO_HEIGHT },
  frameRate: { ideal: CALL_VIDEO_MOBILE_MAX_FRAMERATE, max: CALL_VIDEO_MAX_FRAMERATE },
} as const

export function getCallVideoConstraints(tier: VideoPublishTier): MediaTrackConstraints {
  void tier
  return { ...VIDEO_PRESET_MAFIA }
}

/**
 * Public selector: `useLocalMedia` calls this with a runtime "mobile?" boolean so
 * the call package itself stays UA-agnostic. Desktop continues to use the existing
 * `VIDEO_PRESET_MAFIA` preset (854×480 / 20 fps); mobile switches to the lighter
 * 640×360 / 15 fps preset.
 */
export function getCallVideoConstraintsForRuntime(
  tier: VideoPublishTier,
  isMobile: boolean,
): MediaTrackConstraints {
  if (isMobile) {
    return { ...VIDEO_PRESET_MOBILE }
  }
  return getCallVideoConstraints(tier)
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
