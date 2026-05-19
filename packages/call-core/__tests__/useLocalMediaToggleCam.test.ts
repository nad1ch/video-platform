import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useLocalMedia } from '../src/media/useLocalMedia'

/**
 * Privacy / device-lifecycle contract for `useLocalMedia.toggleCam`.
 *
 * Camera OFF must release the OS capture device (so the laptop LED turns off)
 * — not just flip `MediaStreamTrack.enabled`. Audio is left untouched.
 *
 * Camera ON re-acquires via `getUserMedia({ video })` only — the audio track
 * is reused so the mic does not flicker.
 *
 * Tests run in node + effectScope; no jsdom required. We mock the minimum of
 * `globalThis.navigator.mediaDevices`, `globalThis.MediaStream`, and the
 * `MediaStreamTrack` shape.
 */

interface FakeTrack extends MediaStreamTrack {
  __stopped: boolean
  __endedListeners: Array<() => void>
}

function makeTrack(kind: 'audio' | 'video', deviceId = 'dev-1'): FakeTrack {
  const t: Partial<FakeTrack> & Record<string, unknown> = {
    kind,
    id: `${kind}-${Math.random().toString(36).slice(2, 8)}`,
    label: kind === 'video' ? 'Camera A' : 'Mic A',
    enabled: true,
    muted: false,
    readyState: 'live',
    __stopped: false,
    __endedListeners: [],
    stop() {
      (t as FakeTrack).__stopped = true
      ;(t as { readyState: MediaStreamTrack['readyState'] }).readyState = 'ended'
    },
    getSettings() {
      return { deviceId } as MediaTrackSettings
    },
    addEventListener(name: string, cb: EventListenerOrEventListenerObject) {
      if (name === 'ended' && typeof cb === 'function') {
        ;(t as FakeTrack).__endedListeners.push(cb as () => void)
      }
    },
    removeEventListener() {
      /* no-op */
    },
    applyConstraints: () => Promise.resolve(),
    contentHint: '',
  }
  return t as FakeTrack
}

class FakeStream {
  private tracks: FakeTrack[]
  constructor(tracks: FakeTrack[]) {
    this.tracks = tracks
  }
  getTracks(): FakeTrack[] {
    return [...this.tracks]
  }
  getVideoTracks(): FakeTrack[] {
    return this.tracks.filter((t) => t.kind === 'video')
  }
  getAudioTracks(): FakeTrack[] {
    return this.tracks.filter((t) => t.kind === 'audio')
  }
  addTrack(t: FakeTrack): void {
    if (!this.tracks.includes(t)) this.tracks.push(t)
  }
  removeTrack(t: FakeTrack): void {
    this.tracks = this.tracks.filter((x) => x !== t)
  }
}

interface NavMocks {
  getUserMedia: ReturnType<typeof vi.fn>
  enumerateDevices: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

let navMocks: NavMocks

beforeEach(() => {
  // Minimal navigator + MediaStream shim.
  navMocks = {
    getUserMedia: vi.fn(),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  ;(globalThis as { navigator?: unknown }).navigator = {
    mediaDevices: navMocks,
  }
  ;(globalThis as { MediaStream?: unknown }).MediaStream = FakeStream
})

afterEach(() => {
  vi.clearAllMocks()
})

interface Harness {
  scope: ReturnType<typeof effectScope>
  api: ReturnType<typeof useLocalMedia>
  stop: () => void
}

function mount(): Harness {
  const scope = effectScope()
  const api = scope.run(() => useLocalMedia())!
  return { scope, api, stop: () => scope.stop() }
}

function seedAudioVideoStream(h: Harness): { audio: FakeTrack; video: FakeTrack; stream: FakeStream } {
  const audio = makeTrack('audio')
  const video = makeTrack('video', 'cam-1')
  const stream = new FakeStream([audio, video])
  ;(h.api.localStream as unknown as { value: unknown }).value = stream as unknown as MediaStream
  // Reflect into Vue refs as if startLocalMedia had run.
  ;(h.api.micEnabled as unknown as { value: boolean }).value = true
  ;(h.api.camEnabled as unknown as { value: boolean }).value = true
  return { audio, video, stream }
}

describe('useLocalMedia.toggleCam — privacy / device-lifecycle', () => {
  it('cam ON → toggle OFF stops AND removes the local video track', async () => {
    const h = mount()
    try {
      const { video, stream } = seedAudioVideoStream(h)
      const playRevBefore = h.api.localPlayRev.value
      await h.api.toggleCam()
      expect(video.__stopped).toBe(true)
      expect(stream.getVideoTracks()).toHaveLength(0)
      expect(h.api.camEnabled.value).toBe(false)
      expect(h.api.localPlayRev.value).toBeGreaterThan(playRevBefore)
    } finally {
      h.stop()
    }
  })

  it('mic ON + cam OFF: keeps audio track LIVE (mic does not flicker)', async () => {
    const h = mount()
    try {
      const { audio, stream } = seedAudioVideoStream(h)
      await h.api.toggleCam()
      expect(audio.__stopped).toBe(false)
      expect(audio.readyState).toBe('live')
      expect(stream.getAudioTracks()).toHaveLength(1)
      expect(stream.getAudioTracks()[0]).toBe(audio)
    } finally {
      h.stop()
    }
  })

  it('cam OFF → toggle ON reacquires camera via getUserMedia({ video })', async () => {
    const h = mount()
    try {
      // Start from a stream with audio only (cam was off / never on).
      const audio = makeTrack('audio')
      const stream = new FakeStream([audio])
      ;(h.api.localStream as unknown as { value: unknown }).value = stream as unknown as MediaStream
      ;(h.api.camEnabled as unknown as { value: boolean }).value = false

      const newVideo = makeTrack('video', 'cam-2')
      navMocks.getUserMedia.mockResolvedValueOnce(new FakeStream([newVideo]))

      await h.api.toggleCam()

      expect(navMocks.getUserMedia).toHaveBeenCalledTimes(1)
      const arg = navMocks.getUserMedia.mock.calls[0]?.[0] as MediaStreamConstraints
      expect(arg.video).toBeTruthy()
      expect(arg.audio).toBeUndefined() // do not re-prompt for mic
      expect(stream.getVideoTracks()).toContain(newVideo)
      expect(h.api.camEnabled.value).toBe(true)
    } finally {
      h.stop()
    }
  })

  it('toggle ON with getUserMedia rejected: camEnabled stays false, no track added', async () => {
    const h = mount()
    try {
      const audio = makeTrack('audio')
      const stream = new FakeStream([audio])
      ;(h.api.localStream as unknown as { value: unknown }).value = stream as unknown as MediaStream
      ;(h.api.camEnabled as unknown as { value: boolean }).value = false

      navMocks.getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'))
      await h.api.toggleCam()

      expect(h.api.camEnabled.value).toBe(false)
      expect(stream.getVideoTracks()).toHaveLength(0)
    } finally {
      h.stop()
    }
  })

  it('toggle OFF when there is no local stream is a no-op', async () => {
    const h = mount()
    try {
      // localStream stays null.
      await h.api.toggleCam()
      expect(navMocks.getUserMedia).not.toHaveBeenCalled()
      expect(h.api.camEnabled.value).toBe(false)
    } finally {
      h.stop()
    }
  })

  it('stopLocalMedia stops every track in the local stream', () => {
    const h = mount()
    try {
      const { audio, video } = seedAudioVideoStream(h)
      h.api.stopLocalMedia()
      expect(audio.__stopped).toBe(true)
      expect(video.__stopped).toBe(true)
      expect(h.api.localStream.value).toBe(null)
    } finally {
      h.stop()
    }
  })
})
