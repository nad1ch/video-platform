import { computed } from 'vue'

/**
 * Поля таймера мовлення з кімнати (узгоджені з useOverlaySpeakerCountdown / speakingTimer).
 *
 * @param {import('vue').Ref<Record<string, unknown>>} gameRoomRef
 */
export function useOverlayTimerState(gameRoomRef) {
  const speakingTimerSec = computed(() => Number(gameRoomRef.value?.speakingTimer) || 0)

  return {
    speakingTimerSec,
  }
}
