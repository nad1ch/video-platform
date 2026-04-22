/**
 * Stable per-`peerId` choice of elimination placeholder (skull / ghost / cross).
 */
const KINDS = ['skull', 'ghost', 'cross'] as const

export type MafiaEliminationAvatarKind = (typeof KINDS)[number]

function hashPeerIdToUint(peerId: string): number {
  let h = 0
  for (let i = 0; i < peerId.length; i += 1) {
    h = (Math.imul(31, h) + peerId.charCodeAt(i)) | 0
  }
  return h >>> 0
}

export function mafiaEliminationAvatarKindForPeerId(peerId: string): MafiaEliminationAvatarKind {
  if (typeof peerId !== 'string' || peerId.length < 1) {
    return 'skull'
  }
  return KINDS[hashPeerIdToUint(peerId) % KINDS.length]!
}
