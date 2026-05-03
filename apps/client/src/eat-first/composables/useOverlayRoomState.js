import { computed } from 'vue'
import { clampRoundForOverlay } from '../constants/gameRounds.js'

const EMPTY_HANDS = Object.freeze({})






export function useOverlayRoomState(gameRoomRef) {
  const gamePhase = computed(() => String(gameRoomRef.value?.gamePhase || 'intro'))

  const roomRound = computed(() => clampRoundForOverlay(gameRoomRef.value?.round))

  const activeSpotlightId = computed(() => {
    const a = gameRoomRef.value?.activePlayer
    if (a == null) return null
    const s = String(a).trim()
    return s.length ? s : null
  })

  
  const speakerForTimerId = computed(() => {
    const gr = gameRoomRef.value
    const cs = String(gr?.currentSpeaker ?? '').trim()
    if (cs) return cs
    const hasClock =
      (Number(gr?.speakingTimer) > 0 && gr?.timerStartedAt) ||
      (gr?.timerPaused === true && Number.isFinite(Number(gr?.timerRemainingFrozen)))
    if (hasClock) {
      const leg = String(gr?.activePlayer ?? '').trim()
      return leg || null
    }
    return null
  })

  const overlayPaused = computed(() => gameRoomRef.value?.timerPaused === true)

  const handsMap = computed(() => {
    const h = gameRoomRef.value?.hands
    return h && typeof h === 'object' ? h : EMPTY_HANDS
  })

  
  const nominationsRoomSlice = computed(() => {
    const gr = gameRoomRef.value
    return {
      nominations: gr?.nominations,
      nominatedPlayer: gr?.nominatedPlayer,
      nominatedBy: gr?.nominatedBy,
    }
  })

  return {
    gamePhase,
    roomRound,
    activeSpotlightId,
    speakerForTimerId,
    overlayPaused,
    handsMap,
    nominationsRoomSlice,
  }
}
