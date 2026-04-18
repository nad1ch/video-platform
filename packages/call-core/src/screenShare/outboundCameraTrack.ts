/**
 * Picks the webcam track to publish after screen share and for local preview alignment.
 *
 * Prefer `getVideoTracks()[0]` when it is still **live** — that is the canonical device track
 * for this stream. If the first slot is stale (ended) but another video track is live, use the
 * first live track. Avoids a mismatch where the producer uses one track and `<video>` / canvas
 * sample `getVideoTracks()[0]` on a different object (UUID label vs device label confusion).
 */
export function pickOutboundCameraVideoTrack(stream: MediaStream | null): MediaStreamTrack | undefined {
  if (!stream) {
    return undefined
  }
  const list = stream.getVideoTracks()
  if (list.length === 0) {
    return undefined
  }
  const first = list[0]
  if (first.readyState === 'live') {
    return first
  }
  return list.find((t) => t.readyState === 'live') ?? first
}
