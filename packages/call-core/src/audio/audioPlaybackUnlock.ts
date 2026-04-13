/**
 * Chrome may leave <audio> at HAVE_ENOUGH_DATA with currentTime frozen until a user gesture
 * "unlocks" playback, even when play() resolves. One capture pointerdown unlocks the tab once.
 */
let unlocked = false
const unlockHooks = new Set<() => void>()
let listenerInstalled = false

export function isAudioPlaybackUnlocked(): boolean {
  return unlocked
}

export function registerAudioUnlockHook(fn: () => void): () => void {
  unlockHooks.add(fn)
  return () => {
    unlockHooks.delete(fn)
  }
}

export function playAllPageAudio(): void {
  const audios = Array.from(document.getElementsByTagName('audio'))
  for (const el of audios) {
    void el.play().catch(() => {})
  }
}

const PLAY_ALL_MIN_MS = 300
let lastPlayAllTs = 0

/** Same as playAllPageAudio but skips bursts (visibility, retries). */
export function playAllPageAudioThrottled(): void {
  const now = Date.now()
  if (now - lastPlayAllTs < PLAY_ALL_MIN_MS) {
    return
  }
  lastPlayAllTs = now
  playAllPageAudio()
}

function runUnlock(): void {
  if (unlocked) {
    return
  }
  unlocked = true
  for (const fn of unlockHooks) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
  playAllPageAudio()
  if (import.meta.env.DEV) {
    console.log('[audio] playback unlocked (user gesture)')
  }
}

export function initAudioPlaybackUnlock(): void {
  if (listenerInstalled || typeof document === 'undefined') {
    return
  }
  listenerInstalled = true
  const opts = { capture: true, once: true } as const
  document.addEventListener('pointerdown', runUnlock, opts)
  document.addEventListener('keydown', runUnlock, opts)
}
