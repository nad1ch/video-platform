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
export const CALL_VIDEO_TARGET_BITRATE_BPS = 1_150_000
export const CALL_VIDEO_MIN_BITRATE_BPS = 1_000_000
export const CALL_VIDEO_MAX_BITRATE_BPS = 1_250_000

/**
 * Small-room bitrate ceiling. Applies only when the wire-snapshot count of
 * distinct camera publishers is `<= ACTIVE_CAMERA_SMALL_ROOM_MAX`. Same
 * resolution (854×480) and frame-rate (20 fps) as the large-room preset —
 * the only delta is the encoder bitrate budget. With 1–4 publishers the
 * downstream aggregate (4 × 750 kbps ≈ 3 Mbps) stays well within typical
 * desktop bandwidth even on commodity broadband, so we trade a small uplink
 * bump per publisher for visibly sharper detail in the common 1-on-1 / 1-on-
 * few case.
 *
 * Mobile capture is independently constrained to 640×360 / 15 fps in
 * `VIDEO_PRESET_MOBILE`, so the higher cap does NOT push mobile encoders
 * to spend more CPU — the encoder will only use what the smaller frame
 * actually needs (typically 250–450 kbps), so the cap acts as a ceiling
 * for desktop/laptop publishers without hurting mobile uplink.
 *
 * Selected at safe wire points (initial publish / reconnect) only — never
 * mid-call — to preserve the existing "no flapping / no track restart loop"
 * invariant.
 */
export const CALL_VIDEO_TARGET_BITRATE_BPS_SMALL_ROOM = 1_250_000
export const CALL_VIDEO_MIN_BITRATE_BPS_SMALL_ROOM = 1_100_000
export const CALL_VIDEO_MAX_BITRATE_BPS_SMALL_ROOM = 1_350_000

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

export function clampCallVideoBitrateSmallRoom(bps: number): number {
  return Math.min(
    CALL_VIDEO_MAX_BITRATE_BPS_SMALL_ROOM,
    Math.max(CALL_VIDEO_MIN_BITRATE_BPS_SMALL_ROOM, Math.round(bps)),
  )
}

export const FIXED_CALL_VIDEO_ENCODING: RtpEncodingParameters = {
  maxBitrate: clampCallVideoBitrate(CALL_VIDEO_TARGET_BITRATE_BPS),
  maxFramerate: CALL_VIDEO_MAX_FRAMERATE,
  scaleResolutionDownBy: 1,
} as const

/**
 * Small-room variant of {@link FIXED_CALL_VIDEO_ENCODING}: same shape, only
 * `maxBitrate` is bumped. Resolution / FPS / scale are intentionally
 * identical so within a single room nobody is sharper than anybody else
 * (uniformity prevents the "one peer looks great, the rest look bad"
 * complaint the audit warned against). The room-wide tier is decided once
 * per wire snapshot in {@link resolveOutgoingVideoPublishTier}.
 */
export const FIXED_CALL_VIDEO_ENCODING_SMALL_ROOM: RtpEncodingParameters = {
  maxBitrate: clampCallVideoBitrateSmallRoom(CALL_VIDEO_TARGET_BITRATE_BPS_SMALL_ROOM),
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





/**
 * Pick the room-wide outgoing video tier for THIS wire snapshot.
 *
 * Decision is uniform across all publishers in the room — every peer reads
 * the same `existingProducers` list at the same wire point so the resolver
 * naturally picks the same tier on every client. This preserves the audit's
 * "no participant looks much better while others degrade" invariant.
 *
 * Manual presets (`economy`/`balanced`/`hd`) and the legacy
 * `manualExplicit`/`allowManualQuality` knobs are intentionally still
 * collapsed — uniformity is more important than per-user choice when the
 * cost is "one peer hogs the receiver budget at the expense of the others".
 *
 * `auto_small_room` only fires when the room has at most
 * `ACTIVE_CAMERA_SMALL_ROOM_MAX` (4) distinct camera publishers AT THIS
 * WIRE POINT. Any larger snapshot falls back to `auto_large_room` to keep
 * 8–12 camera rooms within the existing CPU/network envelope.
 */
export function resolveOutgoingVideoPublishTier(input: ResolveOutgoingVideoPublishTierInput): VideoPublishTier {
  if (input.activeCameraPublishersAtWire > 0 && input.activeCameraPublishersAtWire <= ACTIVE_CAMERA_SMALL_ROOM_MAX) {
    return 'auto_small_room'
  }
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
 * Outbound VP8 single encoding. All tiers use 854×480 @ 20 fps; only the
 * `maxBitrate` ceiling differs:
 *   - `auto_small_room` (≤4 publishers): 750 kbps target (cap 900 kbps).
 *   - everything else (`auto_large_room`, manual presets): 600 kbps
 *     target (cap 700 kbps), unchanged from the historical default.
 */
export function getSingleLayerEncodingsForPreset(tier: VideoPublishTier): RtpEncodingParameters[] {
  if (tier === 'auto_small_room') {
    return [{ ...FIXED_CALL_VIDEO_ENCODING_SMALL_ROOM, maxFramerate: clampCallVideoFramerate(CALL_VIDEO_MAX_FRAMERATE) }]
  }
  return [{ ...FIXED_CALL_VIDEO_ENCODING, maxFramerate: clampCallVideoFramerate(CALL_VIDEO_MAX_FRAMERATE) }]
}

/** Back-compat API: simulcast is disabled, so callers still receive exactly one fixed encoding. */
export function getSimulcastEncodingsForPreset(tier: VideoPublishTier): RtpEncodingParameters[] {
  return getSingleLayerEncodingsForPreset(tier)
}
