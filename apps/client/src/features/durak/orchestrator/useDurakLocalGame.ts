import { computed, ref } from 'vue'
import type { DurakLocalSnapshot } from '../core/durakLocalGameTypes'
import type { DurakLocalResult } from '../core/durakLocalGameTypes'
import {
  applyChatAutoMove,
  cloneDurakLocalSnapshot,
  createInitialDurakLocalSnapshot,
  DURAK_LOCAL_CHAT_INDEX,
  DURAK_LOCAL_STREAMER_INDEX,
  endAttackPhase,
  resolveTrumpDisplayCard,
  tryBeatRound,
  tryPlayAttack,
  tryPlayDefend,
  tryTakeRound,
} from '../core/durakLocalTransitions'
import type { DurakRng } from '../core/durakRules'
import type { DurakCard, DurakDemoPhase, DurakTablePair } from '../core/cardTypes'

function applyResult(snapshot: { value: DurakLocalSnapshot }, selectedCardId: { value: string | null }, r: DurakLocalResult) {
  snapshot.value = r.snapshot
  if (r.ok) selectedCardId.value = null
}

export function useDurakLocalGame(rng?: DurakRng) {
  const snapshot = ref<DurakLocalSnapshot>(createInitialDurakLocalSnapshot(rng))
  const selectedCardId = ref<string | null>(null)

  const streamerHand = computed((): DurakCard[] => snapshot.value.hands[DURAK_LOCAL_STREAMER_INDEX]!)

  const chatHand = computed((): DurakCard[] => snapshot.value.hands[DURAK_LOCAL_CHAT_INDEX]!)

  const tableCards = computed((): DurakTablePair[] => snapshot.value.table)

  const uiPhase = computed((): DurakDemoPhase => snapshot.value.phase as DurakDemoPhase)

  const displayTrumpCard = computed(() => resolveTrumpDisplayCard(snapshot.value.stock, snapshot.value.trumpCard))

  const deckCount = computed(() => snapshot.value.stock.length)

  const isStreamerTurn = computed(() => snapshot.value.turnIndex === DURAK_LOCAL_STREAMER_INDEX)

  const isChatTurn = computed(() => snapshot.value.turnIndex === DURAK_LOCAL_CHAT_INDEX)

  const canEndAttack = computed(
    () =>
      snapshot.value.phase === 'attack' &&
      snapshot.value.table.length > 0 &&
      snapshot.value.turnIndex === snapshot.value.attackerIndex,
  )

  const canBeat = computed(
    () =>
      snapshot.value.phase === 'defend' &&
      snapshot.value.table.length > 0 &&
      snapshot.value.table.every((r) => r.defender != null),
  )

  const canTake = computed(
    () => snapshot.value.phase === 'defend' && snapshot.value.table.length > 0,
  )

  function dismissError() {
    if (!snapshot.value.lastErrorKey) return
    const s = cloneDurakLocalSnapshot(snapshot.value)
    s.lastErrorKey = null
    snapshot.value = s
  }

  function selectCard(id: string) {
    dismissError()
    selectedCardId.value = selectedCardId.value === id ? null : id
  }

  function playSelected() {
    const id = selectedCardId.value
    if (!id) return
    const s = snapshot.value
    if (s.turnIndex !== DURAK_LOCAL_STREAMER_INDEX) return
    if (s.phase === 'attack') {
      applyResult(snapshot, selectedCardId, tryPlayAttack(s, DURAK_LOCAL_STREAMER_INDEX, id))
      return
    }
    applyResult(snapshot, selectedCardId, tryPlayDefend(s, DURAK_LOCAL_STREAMER_INDEX, id))
  }

  function endAttack() {
    applyResult(snapshot, selectedCardId, endAttackPhase(snapshot.value))
  }

  function beatRound() {
    applyResult(snapshot, selectedCardId, tryBeatRound(snapshot.value))
  }

  function takeRound() {
    applyResult(snapshot, selectedCardId, tryTakeRound(snapshot.value))
  }

  function newGame() {
    snapshot.value = createInitialDurakLocalSnapshot(rng)
    selectedCardId.value = null
  }

  function chatPlay() {
    applyResult(snapshot, selectedCardId, applyChatAutoMove(snapshot.value))
  }

  return {
    snapshot,
    selectedCardId,
    streamerHand,
    chatHand,
    tableCards,
    uiPhase,
    displayTrumpCard,
    deckCount,
    isStreamerTurn,
    isChatTurn,
    canEndAttack,
    canBeat,
    canTake,
    selectCard,
    playSelected,
    endAttack,
    beatRound,
    takeRound,
    newGame,
    chatPlay,
  }
}
