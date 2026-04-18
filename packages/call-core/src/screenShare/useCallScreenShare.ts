import { computed, nextTick, type Ref, type ShallowRef, shallowRef, ref } from 'vue'

type GetDisplayMediaConstraints = Parameters<MediaDevices['getDisplayMedia']>[0]

/**
 * Display capture for outbound `replaceTrack` on the existing video producer.
 * Moderate fps range: lower ideal reduces encoder/CPU load for full-desktop capture.
 * No `exact` constraints — browsers may downscale further under load.
 */
export const SCREEN_SHARE_GET_DISPLAY_MEDIA: GetDisplayMediaConstraints = {
  audio: false,
  video: {
    frameRate: { ideal: 15, max: 30 },
  },
}

export type UseCallScreenShareDeps = {
  localStream: ShallowRef<MediaStream | null>
  localPlayRev: Ref<number>
  replaceOutboundVideoTrack: (track: MediaStreamTrack) => Promise<string>
  /** Must not throw if WS is closing — wrap sendJson in caller if needed. */
  notifyProducerVideoSource: (producerId: string, source: 'camera' | 'screen') => void
  /** Typically: participant role and in-call. */
  canShareScreen: () => boolean
}

/**
 * Isolated screen-share state + lifecycle for the call engine.
 * Outbound path reuses `replaceOutboundVideoTrack` (serialized in `useSendTransport`).
 *
 * Restore order: prefer the **current** live camera track on `localStream` (handles mid-share
 * device swap), then fall back to the snapshot taken before screen track replaced the producer.
 */
export function useCallScreenShare(deps: UseCallScreenShareDeps) {
  const screenSharing = ref(false)
  const screenShareStream = shallowRef<MediaStream | null>(null)
  /** Snapshot before `replaceTrack(screen)` — backup if `localStream` has no live camera track. */
  const lastCameraTrack = shallowRef<MediaStreamTrack | null>(null)

  let detachEndedListener: (() => void) | null = null
  /** True for the whole async `stopScreenShare` body (matches engine `set-outbound-video-paused` guard). */
  const stoppingScreenShare = ref(false)
  /** Prevents overlapping starts (getDisplayMedia) — stops are serialized via `opChain`. */
  let startInFlight = false

  /** Serialize start/stop/toggle + browser "ended" relative to each other. */
  let opChain: Promise<void> = Promise.resolve()

  const screenTrack = computed(() => screenShareStream.value?.getVideoTracks()[0] ?? null)
  const isReplacingCamera = computed(() => screenSharing.value)

  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const job = opChain.then(() => fn())
    opChain = job.then(
      () => undefined,
      () => undefined,
    )
    return job
  }

  function pickLiveCameraTrack(): MediaStreamTrack | undefined {
    return deps.localStream.value?.getVideoTracks().find((t) => t.readyState === 'live')
  }

  function stopDisplayTracks(stream: MediaStream | null): void {
    if (!stream) {
      return
    }
    for (const t of stream.getTracks()) {
      t.stop()
    }
  }

  async function stopScreenShareBody(): Promise<void> {
    if (stoppingScreenShare.value) {
      return
    }
    const dm = screenShareStream.value
    const wasSharing = screenSharing.value
    if (!dm && !wasSharing) {
      return
    }
    stoppingScreenShare.value = true
    detachEndedListener?.()
    detachEndedListener = null

    try {
      if (wasSharing) {
        screenSharing.value = false
        try {
          const currentCam = pickLiveCameraTrack()
          const snap = lastCameraTrack.value
          lastCameraTrack.value = null
          const cam =
            currentCam?.readyState === 'live'
              ? currentCam
              : snap && snap.readyState === 'live'
                ? snap
                : undefined
          if (cam) {
            const producerId = await deps.replaceOutboundVideoTrack(cam)
            await nextTick()
            deps.notifyProducerVideoSource(producerId, 'camera')
          }
        } catch {
          /* producer may already be torn down */
        }
      }

      if (dm) {
        stopDisplayTracks(dm)
      }
      screenShareStream.value = null
      deps.localPlayRev.value += 1
    } finally {
      stoppingScreenShare.value = false
    }
  }

  async function startScreenShareBody(): Promise<void> {
    if (!deps.canShareScreen() || startInFlight || screenSharing.value) {
      return
    }
    startInFlight = true
    lastCameraTrack.value = pickLiveCameraTrack() ?? null
    try {
      const dm = await navigator.mediaDevices.getDisplayMedia(SCREEN_SHARE_GET_DISPLAY_MEDIA)
      const vt = dm.getVideoTracks()[0]
      if (!vt) {
        stopDisplayTracks(dm)
        lastCameraTrack.value = null
        return
      }
      screenShareStream.value = dm
      detachEndedListener?.()
      const onEnded = () => {
        void enqueue(() => stopScreenShareBody())
      }
      vt.addEventListener('ended', onEnded, { once: true })
      detachEndedListener = () => {
        vt.removeEventListener('ended', onEnded)
      }
      if (import.meta.env.DEV) {
        console.log('[screen-share] display track acquired', {
          id: vt.id,
          readyState: vt.readyState,
          enabled: vt.enabled,
          muted: vt.muted,
        })
      }
      screenSharing.value = true
      deps.localPlayRev.value += 1
      await nextTick()

      const producerId = await deps.replaceOutboundVideoTrack(vt)
      if (import.meta.env.DEV) {
        console.log('[screen-share] replaceTrack done; notify source', { producerId, source: 'screen' as const })
      }
      await nextTick()
      deps.notifyProducerVideoSource(producerId, 'screen')
      deps.localPlayRev.value += 1
    } catch {
      const orphan = screenShareStream.value
      if (orphan) {
        stopDisplayTracks(orphan)
      }
      detachEndedListener?.()
      detachEndedListener = null
      screenShareStream.value = null
      screenSharing.value = false
      lastCameraTrack.value = null
    } finally {
      startInFlight = false
    }
  }

  function stopScreenShare(): Promise<void> {
    return enqueue(() => stopScreenShareBody())
  }

  function toggleScreenShare(): Promise<void> {
    if (!deps.canShareScreen()) {
      return Promise.resolve()
    }
    return enqueue(async () => {
      if (screenSharing.value) {
        await stopScreenShareBody()
      } else {
        await startScreenShareBody()
      }
    })
  }

  function teardownScreenShare(): void {
    detachEndedListener?.()
    detachEndedListener = null
    stopDisplayTracks(screenShareStream.value)
    screenShareStream.value = null
    screenSharing.value = false
    lastCameraTrack.value = null
    stoppingScreenShare.value = false
    startInFlight = false
    opChain = Promise.resolve()
  }

  return {
    screenSharing,
    stoppingScreenShare,
    screenShareStream,
    lastCameraTrack,
    screenTrack,
    isReplacingCamera,
    stopScreenShare,
    toggleScreenShare,
    teardownScreenShare,
  }
}

/** Same composable — alias for app-level `useScreenShare()` naming without `Call`. */
export { useCallScreenShare as useScreenShare }
