import type { RemoteProducerInfo } from '../signaling/useRoomConnection'

/**
 * Merge producer lists from room-state, missed `new-producer`, and `producer-sync` without duplicate producerIds.
 * Later lists override earlier ones for the same `producerId` (iteration order matters).
 *
 * Each rest argument is **one** `RemoteProducerInfo[]`. For a single list use `mergeProducerLists(list)` — not
 * `mergeProducerLists([list])`, which double-wraps and would iterate arrays as items.
 */
export function mergeProducerLists(...lists: RemoteProducerInfo[][]): RemoteProducerInfo[] {
  const map = new Map<string, RemoteProducerInfo>()
  for (const list of lists) {
    for (const item of list) {
      map.set(item.producerId, item)
    }
  }
  return [...map.values()]
}
