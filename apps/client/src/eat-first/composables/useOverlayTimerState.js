import { computed } from 'vue'






export function useOverlayTimerState(gameRoomRef) {
  const speakingTimerSec = computed(() => Number(gameRoomRef.value?.speakingTimer) || 0)

  return {
    speakingTimerSec,
  }
}
