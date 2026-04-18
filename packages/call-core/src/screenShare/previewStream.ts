import type { OutboundVideoSource } from './outboundVideoSource'
import { pickOutboundCameraVideoTrack } from './outboundCameraTrack'

/**
 * When the outbound camera track is not `getVideoTracks()[0]` (e.g. stale slot still in the
 * stream), wrap a stream with **primary video first** so local `<video>` (which uses `[0]`)
 * matches the track used for {@link replaceOutboundVideoTrack}.
 */
function localCameraPreviewStream(localStream: MediaStream | null): MediaStream | null {
  if (!localStream) {
    return null
  }
  const videos = localStream.getVideoTracks()
  const audios =
    typeof localStream.getAudioTracks === 'function' ? localStream.getAudioTracks() : []
  if (videos.length === 0) {
    return localStream
  }
  const primary = pickOutboundCameraVideoTrack(localStream)
  if (!primary) {
    return localStream
  }
  if (videos.length === 1 && videos[0] === primary) {
    return localStream
  }
  if (videos[0] === primary) {
    return localStream
  }
  const rest = videos.filter((t) => t !== primary)
  return new MediaStream([primary, ...rest, ...audios])
}

/**
 * Pure preview selection: **outbound source is authoritative**, not presence of display stream.
 */
export function localPreviewStreamForOutbound(
  outboundVideoSource: OutboundVideoSource,
  screenShareStream: MediaStream | null,
  localStream: MediaStream | null,
): MediaStream | null {
  if (outboundVideoSource === 'screen') {
    const dm = screenShareStream
    const vt = dm?.getVideoTracks()[0]
    return vt && vt.readyState === 'live' ? dm : null
  }
  if (outboundVideoSource === 'camera') {
    return localCameraPreviewStream(localStream)
  }
  return null
}
