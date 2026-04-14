import { computed } from 'vue'

/**
 * Похідний UI-стан оверлею (драма, рядок статусу), без широкого gameRoom у споживачів.
 *
 * @param {{
 *   isPersonal: import('vue').ComputedRef<boolean>,
 *   players: import('vue').Ref<unknown[]>,
 *   aliveForCinema: import('vue').Ref<number>,
 *   aliveInGame: import('vue').ComputedRef<number>,
 *   gamePhase: import('vue').ComputedRef<string>,
 *   roomRound: import('vue').ComputedRef<number>,
 *   t: (key: string, values?: Record<string, unknown>) => string,
 *   te: (key: string) => boolean,
 * }} ctx
 */
export function useOverlayUiState(ctx) {
  const { isPersonal, players, aliveForCinema, aliveInGame, gamePhase, roomRound, t, te } = ctx

  const dramaMode = computed(() => {
    if (isPersonal.value) return false
    return aliveInGame.value === 3
  })

  const dramaPersonal = computed(() => isPersonal.value && aliveForCinema.value === 3)

  /** Тільки глобальна сітка: на персональному оверлеї без vignette по центру вебки */
  const overlayDrama = computed(() => dramaMode.value)

  const globalStatusLine = computed(() => {
    const phRaw = gamePhase.value
    const pk = `gamePhase.${phRaw}`
    const ph = te(pk) ? t(pk) : phRaw
    const r = roomRound.value
    const n = players.value.length
    return t('overlayPage.phaseBanner', { phase: ph, round: r, n })
  })

  return {
    dramaMode,
    dramaPersonal,
    overlayDrama,
    globalStatusLine,
  }
}
