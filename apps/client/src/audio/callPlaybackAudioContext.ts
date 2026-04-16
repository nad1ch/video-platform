/**
 * Shared AudioContext for remote call playback (gain > 100% via GainNode).
 * One context per page avoids hitting per-tab context limits with many peers.
 */
let shared: AudioContext | null = null

export function getSharedCallPlaybackContext(): AudioContext {
  if (typeof AudioContext === 'undefined') {
    throw new Error('AudioContext not supported')
  }
  if (!shared || shared.state === 'closed') {
    shared = new AudioContext({ latencyHint: 'interactive' })
  }
  return shared
}

export async function resumeSharedCallPlaybackContext(): Promise<void> {
  try {
    const ctx = getSharedCallPlaybackContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
  } catch {
    /* autoplay policy — caller may retry after gesture */
  }
}
