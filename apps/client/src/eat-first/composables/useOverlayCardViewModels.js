import { computed, unref, reactive, shallowRef, watchEffect, triggerRef } from 'vue'
import { nominationsFromRoom } from '../services/gameService'

/**
 * Зведення похідних пропсів для OverlayPlayerCard (глобальна мозаїка + solo), щоб
 * OverlayPage не тягнув десятки дрібних функцій у шаблоні.
 *
 * Глобальна мозаїка (PR5): стабільний `Map(id → reactive row)` + `Object.assign(row.card, …)`
 * замість `computed(() => order.map(() => ({ … })))`, щоб не віддавати нові об’єкти рядків
 * на кожен тик таймера / speaking / голосів.
 *
 * @param {{
 *   gameId: import('vue').Ref<string> | import('vue').ComputedRef<string>,
 *   nominationsRoomSlice: import('vue').ComputedRef<Record<string, unknown>>,
 *   handsMap: import('vue').ComputedRef<Record<string, unknown>>,
 *   votes: import('vue').Ref<Array<Record<string, unknown>>>,
 *   roomRound: import('vue').ComputedRef<number>,
 *   singlePlayer: import('vue').Ref<Record<string, unknown> | null>,
 *   activeSpotlightId: import('vue').ComputedRef<string | null>,
 *   speakerForTimerId: import('vue').ComputedRef<string | null>,
 *   speakerTimeLeft: import('vue').Ref<number | undefined> | import('vue').ComputedRef<number | undefined>,
 *   speakerTimerTotal: import('vue').Ref<number> | import('vue').ComputedRef<number>,
 *   cinemaGrid: import('vue').ComputedRef<boolean>,
 *   cinemaHud: import('vue').ComputedRef<boolean>,
 *   dramaMode: import('vue').ComputedRef<boolean>,
 *   dramaPersonal: import('vue').ComputedRef<boolean>,
 *   votingActive: import('vue').ComputedRef<boolean>,
 *   votingTargetId: import('vue').ComputedRef<string>,
 *   nominatedPlayerId: import('vue').ComputedRef<string>,
 *   nominatedById: import('vue').ComputedRef<string>,
 *   personalHasVotedThisRound: import('vue').ComputedRef<boolean>,
 *   personalIsVoteTarget: import('vue').ComputedRef<boolean>,
 *   showIdleWaitingCue: import('vue').ComputedRef<boolean>,
 *   handsClusterMode: import('vue').ComputedRef<boolean>,
 *   isHandRaised: (p: object) => boolean,
 *   playersDisplayOrderedForGlobalMosaic?: import('vue').ComputedRef<Array<Record<string, unknown>>> | import('vue').Ref<Array<Record<string, unknown>>>,
 *   liveKitTileForPlayer?: (player: Record<string, unknown>) => unknown,
 *   liveKitVolumeForPlayer?: (player: Record<string, unknown>) => number,
 * }} ctx
 */
export function useOverlayCardViewModels(ctx) {
  const {
    gameId,
    nominationsRoomSlice,
    handsMap,
    votes,
    roomRound,
    singlePlayer,
    activeSpotlightId,
    speakerForTimerId,
    speakerTimeLeft,
    speakerTimerTotal,
    cinemaGrid,
    cinemaHud,
    dramaMode,
    dramaPersonal,
    votingActive,
    votingTargetId,
    nominatedPlayerId,
    nominatedById,
    personalHasVotedThisRound,
    personalIsVoteTarget,
    showIdleWaitingCue,
    handsClusterMode,
    isHandRaised,
    playersDisplayOrderedForGlobalMosaic: playersDisplayOrderedRef,
    liveKitTileForPlayer: lkTileFn,
    liveKitVolumeForPlayer: lkVolumeFn,
  } = ctx

  /** @type {import('vue').ShallowRef<Map<string, import('vue').UnwrapNestedRefs<{ player: Record<string, unknown>, tile: unknown, volume: number, card: Record<string, unknown> }>>>} */
  const mosaicRowById = shallowRef(new Map())
  /** Стабільний порядок id; не оновлюємо масив, якщо послідовність тих самих id не змінилась. */
  const mosaicOrderedIds = shallowRef([])

  function slotNumFromId(id) {
    const s = String(id ?? '')
    const m = s.match(/^p(\d+)$/i)
    if (m) return m[1]
    return s.replace(/^p/i, '') || s
  }

  function nominatorsLineFor(pid) {
    const id = String(pid ?? '')
    const slice = nominationsRoomSlice.value
    const list = nominationsFromRoom(slice)
    const nums = list.filter((x) => String(x.target) === id).map((x) => slotNumFromId(x.by))
    if (nums.length) return nums.join(', ')
    const n = String(slice?.nominatedPlayer ?? '').trim()
    const b = String(slice?.nominatedBy ?? '').trim()
    if (n === id && b) return slotNumFromId(b)
    return ''
  }

  function votesForTarget(playerId) {
    const pid = String(playerId ?? '')
    return votes.value.filter(
      (v) => Number(v.round) === roomRound.value && String(v.targetPlayer) === pid,
    )
  }

  function isSpotlightPlayer(p) {
    return activeSpotlightId.value != null && p.id === activeSpotlightId.value
  }

  function isTimerPlayer(p) {
    return speakerForTimerId.value != null && p.id === speakerForTimerId.value
  }

  function cardTimerProps(p) {
    if (!isTimerPlayer(p) || speakerTimeLeft.value === undefined) return {}
    return {
      speakerTimeLeft: speakerTimeLeft.value,
      speakerTimerTotal: speakerTimerTotal.value,
    }
  }

  function globalMosaicCardProps(p) {
    return {
      mosaicTile: true,
      solo: true,
      player: p,
      isSpotlight: isSpotlightPlayer(p),
      isTimerTarget: isTimerPlayer(p),
      cinema: cinemaGrid.value,
      drama: dramaMode.value,
      votingActive: votingActive.value,
      votingTargetId: votingTargetId.value,
      voteInteractive: false,
      hideVoteStrip: true,
      gameId: unref(gameId),
      nominatedPlayerId: nominatedPlayerId.value,
      nominatedById: nominatedById.value,
      nominatorsLine: nominatorsLineFor(p.id),
      roomRound: roomRound.value,
      votesReceived: votesForTarget(p.id),
      hasVotedThisRound: false,
      isVoteTargetSelf: false,
      handRaised: isHandRaised(p),
      suppressHandBadge: handsClusterMode.value,
      ...cardTimerProps(p),
    }
  }

  const soloCardViewModel = computed(() => {
    const p = singlePlayer.value
    if (!p) return null
    return {
      player: p,
      isSpotlight: isSpotlightPlayer(p),
      isTimerTarget: isTimerPlayer(p),
      cinema: cinemaHud.value,
      drama: dramaPersonal.value,
      votingActive: votingActive.value,
      votingTargetId: votingTargetId.value,
      voteInteractive: false,
      hideVoteStrip: true,
      gameId: unref(gameId),
      nominatedPlayerId: nominatedPlayerId.value,
      nominatedById: nominatedById.value,
      nominatorsLine: nominatorsLineFor(p.id),
      roomRound: roomRound.value,
      votesReceived: votesForTarget(p.id),
      hasVotedThisRound: personalHasVotedThisRound.value,
      isVoteTargetSelf: personalIsVoteTarget.value,
      handRaised: isHandRaised(p),
      idleWaiting: showIdleWaitingCue.value,
      solo: true,
      ...cardTimerProps(p),
    }
  })

  watchEffect(() => {
    if (!playersDisplayOrderedRef || !lkTileFn || !lkVolumeFn) {
      mosaicOrderedIds.value = []
      const map = mosaicRowById.value
      if (map.size > 0) {
        map.clear()
        triggerRef(mosaicRowById)
      }
      return
    }

    nominationsRoomSlice.value
    handsMap.value
    votes.value
    roomRound.value
    activeSpotlightId.value
    speakerForTimerId.value
    speakerTimeLeft.value
    speakerTimerTotal.value
    cinemaGrid.value
    dramaMode.value
    votingActive.value
    votingTargetId.value
    nominatedPlayerId.value
    nominatedById.value
    handsClusterMode.value
    unref(gameId)

    const order = playersDisplayOrderedRef.value
    const map = mosaicRowById.value

    if (!order?.length) {
      mosaicOrderedIds.value = []
      if (map.size > 0) {
        map.clear()
        triggerRef(mosaicRowById)
      }
      return
    }

    const nextIds = order.map((p) => p.id)
    const prevIds = mosaicOrderedIds.value
    const orderChanged =
      prevIds.length !== nextIds.length || nextIds.some((id, i) => id !== prevIds[i])
    if (orderChanged) {
      mosaicOrderedIds.value = nextIds
    }

    let mapMutated = false
    const idSet = new Set(nextIds)

    for (const p of order) {
      const id = p.id
      let row = map.get(id)
      if (!row) {
        row = reactive({
          player: p,
          tile: null,
          volume: 1,
          card: {},
        })
        map.set(id, row)
        mapMutated = true
      } else {
        row.player = p
      }
      row.tile = lkTileFn(p)
      row.volume = lkVolumeFn(p)
      const nextCard = globalMosaicCardProps(p)
      if (!('speakerTimeLeft' in nextCard)) {
        delete row.card.speakerTimeLeft
        delete row.card.speakerTimerTotal
      }
      Object.assign(row.card, nextCard)
    }

    for (const id of [...map.keys()]) {
      if (!idSet.has(id)) {
        map.delete(id)
        mapMutated = true
      }
    }

    if (mapMutated) {
      triggerRef(mosaicRowById)
    }
  })

  const globalMosaicCardViewModels = computed(() => {
    const ids = mosaicOrderedIds.value
    const map = mosaicRowById.value
    if (!ids.length) return []
    const out = []
    for (const id of ids) {
      const row = map.get(id)
      if (row) out.push(row)
    }
    return out
  })

  return {
    slotNumFromId,
    nominatorsLineFor,
    votesForTarget,
    soloCardViewModel,
    globalMosaicCardViewModels,
  }
}
