/**
 * Display-capture video must stay enabled: we use `track.enabled === false` on the webcam
 * for Meet-style "camera off", but the same flag on a display-capture track yields black
 * frames for remotes while `readyState` stays `live`.
 *
 * After {@link RTCRtpSender.replaceTrack}, browsers may mirror the previous camera track's
 * `enabled` state onto the new display-capture track; this helper re-asserts `enabled`
 * only when settings indicate display capture ({@link MediaTrackSettings.displaySurface}).
 */
export function ensureDisplayCaptureVideoTrackEnabled(track: MediaStreamTrack | null): void {
  if (!track || track.kind !== 'video') {
    return
  }
  const displaySurface = (track.getSettings?.() as { displaySurface?: string }).displaySurface
  if (typeof displaySurface === 'string' && displaySurface.length > 0) {
    track.enabled = true
  }
}
