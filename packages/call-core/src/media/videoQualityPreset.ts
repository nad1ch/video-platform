import type { RtpEncodingParameters } from 'mediasoup-client/types'

export type VideoQualityPreset = 'economy' | 'balanced' | 'hd'

export const VIDEO_QUALITY_PRESETS: VideoQualityPreset[] = ['economy', 'balanced', 'hd']

export function isVideoQualityPreset(v: string): v is VideoQualityPreset {
  return v === 'economy' || v === 'balanced' || v === 'hd'
}

/** Capture constraints per preset (keeps CPU/encode predictable). */
export function getCallVideoConstraints(preset: VideoQualityPreset): MediaTrackConstraints {
  switch (preset) {
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
export function getSingleLayerEncodingsForPreset(preset: VideoQualityPreset): RtpEncodingParameters[] {
  switch (preset) {
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
export function getSimulcastEncodingsForPreset(preset: VideoQualityPreset): RtpEncodingParameters[] {
  switch (preset) {
    case 'economy':
      return [
        { rid: 'r0', maxBitrate: 120_000, scaleResolutionDownBy: 4, maxFramerate: 24 },
        { rid: 'r1', maxBitrate: 320_000, scaleResolutionDownBy: 2, maxFramerate: 24 },
        { rid: 'r2', maxBitrate: 650_000, scaleResolutionDownBy: 1, maxFramerate: 24 },
      ]
    case 'hd':
      return [
        { rid: 'r0', maxBitrate: 350_000, scaleResolutionDownBy: 4, maxFramerate: 30 },
        { rid: 'r1', maxBitrate: 1_200_000, scaleResolutionDownBy: 2, maxFramerate: 30 },
        { rid: 'r2', maxBitrate: 4_500_000, scaleResolutionDownBy: 1, maxFramerate: 30 },
      ]
    case 'balanced':
    default:
      return [
        { rid: 'r0', maxBitrate: 280_000, scaleResolutionDownBy: 4, maxFramerate: 30 },
        { rid: 'r1', maxBitrate: 800_000, scaleResolutionDownBy: 2, maxFramerate: 30 },
        { rid: 'r2', maxBitrate: 3_200_000, scaleResolutionDownBy: 1, maxFramerate: 30 },
      ]
  }
}
