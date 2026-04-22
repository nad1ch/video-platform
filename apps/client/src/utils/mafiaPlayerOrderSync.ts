/**
 * Mafia player numbering: stable 1..N in **first-seen** order for the current call room.
 * Uses the engine `tiles` list order to decide when a peer was first seen (not the user’s grid drag order).
 * When the room key changes, order resets for the new room.
 */

export function syncMafiaJoinOrder(params: {
  roomKey: string
  previousRoomKey: string
  previousOrder: string[]
  /** Current participant ids in engine order (`tiles.map(t => t.peerId)`). */
  enginePeerOrder: string[]
}): { roomKey: string; joinOrder: string[] } {
  const { roomKey, previousRoomKey, previousOrder, enginePeerOrder } = params
  if (roomKey !== previousRoomKey) {
    return { roomKey, joinOrder: appendNewIdsUnique([], enginePeerOrder) }
  }
  const present = new Set<string>()
  for (const id of enginePeerOrder) {
    if (typeof id === 'string' && id.length > 0) {
      present.add(id)
    }
  }
  const filtered = previousOrder.filter((id) => present.has(id))
  return { roomKey, joinOrder: appendNewIdsUnique(filtered, enginePeerOrder) }
}

function appendNewIdsUnique(base: string[], enginePeerOrder: string[]): string[] {
  const out = [...base]
  const have = new Set(out)
  for (const id of enginePeerOrder) {
    if (typeof id !== 'string' || id.length === 0) {
      continue
    }
    if (have.has(id)) {
      continue
    }
    have.add(id)
    out.push(id)
  }
  return out
}
