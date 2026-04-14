import { computed } from 'vue'
import { normalizePlayerSlotId } from '../utils/playerSlot.js'
import { liveKitConfigured } from '../config/livekit.js'

/**
 * Доступ до тайлів без побудови другої Map з масиву — використовує tileMapRef з useMediaTracks.
 *
 * @param {import('vue').Ref<unknown[]>} tilesRef Порядковий список для speakingIdentities (стабільна ітерація).
 * @param {import('vue').ShallowRef<Map<string, {
 *   identity: string,
 *   isSpeaking?: boolean,
 *   participant: import('livekit-client').Participant,
 *   isLocal: boolean,
 *   showVideo: boolean,
 *   isMuted: boolean,
 *   label: string,
 * }>>} tileMapRef
 */
export function useLiveKitTileMap(tilesRef, tileMapRef) {
  const speakingIdentities = computed(() => {
    const s = new Set()
    for (const t of tilesRef.value) {
      if (t.isSpeaking) s.add(t.identity)
    }
    return s
  })

  function liveKitTileForPlayer(player) {
    if (!liveKitConfigured() || !player || player.eliminated === true) return null
    const id = normalizePlayerSlotId(player.id)
    return tileMapRef.value.get(id) ?? null
  }

  return { tileMap: tileMapRef, speakingIdentities, liveKitTileForPlayer }
}
