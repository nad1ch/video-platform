import { normalizePlayerSlotId } from '../utils/playerSlot.js'

/**
 * Гучність відеоклітинок LiveKit на overlay (окремий об’єкт у ref, щоб не роздувати OverlayPage).
 *
 * @param {import('vue').Ref<Record<string, number>>} lkVolumeByIdentity
 */
export function useOverlayLiveKitBindings(lkVolumeByIdentity) {
  function liveKitVolumeForPlayer(player) {
    const id = normalizePlayerSlotId(player.id)
    const v = lkVolumeByIdentity.value[id]
    return typeof v === 'number' ? v : 1
  }

  function setLiveKitVolumeForPlayer(player, vol) {
    const id = normalizePlayerSlotId(player.id)
    lkVolumeByIdentity.value = { ...lkVolumeByIdentity.value, [id]: vol }
  }

  return { liveKitVolumeForPlayer, setLiveKitVolumeForPlayer }
}
