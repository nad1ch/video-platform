import { ref, computed, watch, onUnmounted } from 'vue'
import { millisFromFirestore } from '../utils/firestoreTime.js'
import { clearSpeakingTimer } from '../services/gameService.js'

const DEFAULT_TICK_MS = 500

/**
 * Локалізований тік лише коли активний speaking timer (не global 250ms завжди).
 * Зменшує зайві реактивні оновлення в решті оверлею.
 *
 * @param {import('vue').Ref<object>} gameRoomRef
 * @param {import('vue').Ref<string> | import('vue').ComputedRef<string>} gameIdRef
 * @param {{ tickMs?: number }} [options]
 */
export function useOverlaySpeakerCountdown(gameRoomRef, gameIdRef, options = {}) {
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS
  const tick = ref(Date.now())
  let intervalId = null

  const speakerTickActive = computed(() => {
    const gr = gameRoomRef.value
    if (gr?.timerPaused === true) return false
    const start = millisFromFirestore(gr?.timerStartedAt)
    const total = Number(gr?.speakingTimer) || 0
    return start != null && total > 0
  })

  function clearTickInterval() {
    if (intervalId != null) {
      window.clearInterval(intervalId)
      intervalId = null
    }
  }

  watch(
    speakerTickActive,
    (active) => {
      clearTickInterval()
      if (!active) return
      tick.value = Date.now()
      intervalId = window.setInterval(() => {
        tick.value = Date.now()
      }, tickMs)
    },
    { immediate: true },
  )

  const speakerTimeLeft = computed(() => {
    const gr = gameRoomRef.value
    if (gr?.timerPaused === true) {
      const f = Number(gr?.timerRemainingFrozen)
      if (Number.isFinite(f) && f >= 0) return f
      return undefined
    }
    const start = millisFromFirestore(gr?.timerStartedAt)
    const total = Number(gr?.speakingTimer) || 0
    if (start == null || total <= 0) return undefined
    const elapsed = Math.floor((tick.value - start) / 1000)
    return Math.max(0, total - elapsed)
  })

  const speakerTimerTotal = computed(() => Number(gameRoomRef.value?.speakingTimer) || 30)

  watch(speakerTimeLeft, async (left, prevLeft) => {
    if (gameRoomRef.value?.timerPaused === true) return
    if (left !== 0) return
    if (prevLeft === undefined || prevLeft === 0) return
    const gr = gameRoomRef.value
    if (!(Number(gr?.speakingTimer) > 0)) return
    try {
      await clearSpeakingTimer(gameIdRef.value)
    } catch (e) {
      console.error('[autoClearSpeaker]', e)
    }
  })

  onUnmounted(() => {
    clearTickInterval()
  })

  return {
    tick,
    speakerTickActive,
    speakerTimeLeft,
    speakerTimerTotal,
  }
}
