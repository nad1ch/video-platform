/**
 * Audit R9: per-peer serial chain for audio-mute state mutations.
 *
 * Before this helper, `handleSetAudioMuted` could race a `force-mute-all`
 * (or per-peer `force-peer-mic`) on the same peer:
 *   1. Player clicks "unmute" → sets `peer.audioMuted = false`, sees
 *      `forcedAudioMuted = false`, kicks off `await producer.resume()`.
 *   2. Host fires `force-mute-all` mid-await → sets `audioMuted = true`,
 *      pauses the producer (or sets `forcedAudioMuted = true`).
 *   3. The player's resume resolves last → producer is now playing even
 *      though the host's intent was "muted". The broadcast emitted by
 *      the earlier handler may also overwrite the later broadcast,
 *      leaving observers in a stale state.
 *
 * Serializing per peerId ensures every state mutation + producer
 * pause/resume + broadcast for a given peer happens atomically with
 * respect to other audio-mute operations on the same peer. Different
 * peers run in parallel.
 *
 * Chain entries are removed when their queue empties so the map never
 * grows beyond the set of peers currently being mutated.
 */
const peerAudioMuteChains = new Map<string, Promise<unknown>>()

export function runPeerAudioMuteOp<T>(peerId: string, fn: () => Promise<T>): Promise<T> {
  const prev = peerAudioMuteChains.get(peerId) ?? Promise.resolve()
  const job = prev.then(
    () => fn(),
    () => fn(),
  )
  const tracked = job.finally(() => {
    if (peerAudioMuteChains.get(peerId) === tracked) {
      peerAudioMuteChains.delete(peerId)
    }
  })
  peerAudioMuteChains.set(peerId, tracked)
  return job
}
