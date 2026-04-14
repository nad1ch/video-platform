import { computed } from 'vue'
import { normalizePlayerSlotId } from '../utils/playerSlot.js'

/**
 * Мапа тайлів для overlay (mediasoup / call-core).
 *
 * @param {import('vue').Ref<unknown[]>} tilesRef Список { identity, isSpeaking } для порядку «хто говорить».
 * @param {import('vue').ShallowRef<Map<string, unknown>>} tileMapRef
 * @param {import('vue').Ref<boolean> | import('vue').ComputedRef<boolean>} mediaEnabledRef
 */
export function useOverlayMediaTileMap(tilesRef, tileMapRef, mediaEnabledRef) {
  const speakingIdentities = computed(() => {
    const s = new Set()
    const list = tilesRef.value
    if (!Array.isArray(list)) return s
    for (const t of list) {
      if (t && t.isSpeaking) s.add(t.identity)
    }
    return s
  })

  function mediaTileForPlayer(player) {
    const enabled =
      mediaEnabledRef && typeof mediaEnabledRef === 'object' && 'value' in mediaEnabledRef
        ? mediaEnabledRef.value
        : true
    if (!enabled || !player || player.eliminated === true) return null
    const id = normalizePlayerSlotId(player.id)
    return tileMapRef.value.get(id) ?? null
  }

  return { speakingIdentities, mediaTileForPlayer }
}
