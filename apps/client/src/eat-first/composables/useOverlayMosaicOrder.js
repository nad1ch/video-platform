import { computed, shallowRef, watch } from 'vue'
import { normalizePlayerSlotId, playerSlotOrderIndex } from '../utils/playerSlot.js'

/**
 * Мозаїка глобального overlay: порядок гравців (Discord-like) без computed, що кожен раз
 * копіює/сортує players при будь-якому реактивному оновленні сторінки.
 *
 * Перерахунок лише коли змінюється відбиток складу/елімінацій або множина speaking.
 *
 * @param {import('vue').Ref<Array<Record<string, unknown>>>} playersRef
 * @param {import('vue').ComputedRef<Set<string>> | import('vue').Ref<Set<string>>} speakingIdentitiesRef
 */
export function useOverlayMosaicOrder(playersRef, speakingIdentitiesRef) {
  const playersOrderedForGlobalMosaic = shallowRef([])

  function playersStructureFingerprint() {
    const list = playersRef.value
    if (!list.length) return ''
    return list
      .map((p) => `${normalizePlayerSlotId(p.id)}:${p.eliminated === true ? 1 : 0}`)
      .join('|')
  }

  function speakingFingerprint() {
    const s = speakingIdentitiesRef.value
    if (!s || s.size === 0) return ''
    return [...s].sort().join('\0')
  }

  function recomputeMosaicOrder() {
    const list = playersRef.value
    const speaking = speakingIdentitiesRef.value
    const next =
      list.length === 0
        ? []
        : [...list].sort((a, b) => {
            const ida = normalizePlayerSlotId(a.id)
            const idb = normalizePlayerSlotId(b.id)
            const sa = speaking.has(ida) ? 0 : 1
            const sb = speaking.has(idb) ? 0 : 1
            if (sa !== sb) return sa - sb
            return playerSlotOrderIndex(a.id) - playerSlotOrderIndex(b.id)
          })

    const cur = playersOrderedForGlobalMosaic.value
    if (
      cur.length === next.length &&
      next.every((p, i) => cur[i] === p)
    ) {
      return
    }
    playersOrderedForGlobalMosaic.value = next
  }

  watch(
    () => [playersStructureFingerprint(), speakingFingerprint()],
    () => recomputeMosaicOrder(),
    { flush: 'post' },
  )

  recomputeMosaicOrder()

  /** Для useMosaicPlayerOrder: стабільне посилання, поки порядок не змінився. */
  const defaultOrderedPlayers = computed(() => playersOrderedForGlobalMosaic.value)

  return {
    playersOrderedForGlobalMosaic,
    defaultOrderedPlayers,
  }
}
