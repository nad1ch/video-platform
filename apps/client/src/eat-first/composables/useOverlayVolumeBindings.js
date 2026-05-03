import { normalizePlayerSlotId } from '../utils/playerSlot.js'






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
