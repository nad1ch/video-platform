import { computed } from 'vue'

/**
 * Стан голосування / номінацій з кімнати (ізольовано від решти gameRoom).
 *
 * @param {import('vue').Ref<Record<string, unknown>>} gameRoomRef
 */
export function useOverlayVotingState(gameRoomRef) {
  const votingActive = computed(() => gameRoomRef.value?.voting?.active === true)
  const votingTargetId = computed(() => String(gameRoomRef.value?.voting?.targetPlayer ?? '').trim())
  const nominatedPlayerId = computed(() => String(gameRoomRef.value?.nominatedPlayer ?? '').trim())
  const nominatedById = computed(() => String(gameRoomRef.value?.nominatedBy ?? '').trim())

  return {
    votingActive,
    votingTargetId,
    nominatedPlayerId,
    nominatedById,
  }
}
