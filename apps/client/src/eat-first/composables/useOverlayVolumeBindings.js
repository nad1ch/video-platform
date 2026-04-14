import { normalizePlayerSlotId } from '../utils/playerSlot.js'

/**
 * Гучність відеоклітинок на overlay (окремий об’єкт у ref).
 *
 * @param {import('vue').Ref<Record<string, number>>} volumeByIdentity
 */
export function useOverlayVolumeBindings(volumeByIdentity) {
  function mediaVolumeForPlayer(player) {
    const id = normalizePlayerSlotId(player?.id)
    const v = volumeByIdentity.value[id]
    return typeof v === 'number' && Number.isFinite(v) ? v : 1
  }

  function setMediaVolumeForPlayer(player, vol) {
    const id = normalizePlayerSlotId(player?.id)
    if (!id) return
    volumeByIdentity.value = { ...volumeByIdentity.value, [id]: vol }
  }

  return { mediaVolumeForPlayer, setMediaVolumeForPlayer }
}
