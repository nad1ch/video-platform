import { computed, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import {
  createInitialCheckersState,
  getLegalMoves,
  getValidMove,
  isSameCheckersPosition,
} from '../core/checkersEngine'
import type { CheckersMove, CheckersPosition, CheckersState } from '../core/types'
import {
  createCheckersWsClient,
  type CheckersBotDifficulty,
  type CheckersMode,
  type CheckersPlayerMeta,
  type CheckersRole,
} from '../ws/checkersWs'

function cleanRoomId(roomId: string): string {
  return roomId.trim().slice(0, 80)
}

export function useCheckersOrchestrator(options: {
  roomId: Ref<string>
  botDifficulty?: Ref<CheckersBotDifficulty>
  displayName?: Ref<string>
  canJoin?: Ref<boolean>
}) {
  const roomId = computed(() => cleanRoomId(options.roomId.value))
  const initialState = createInitialCheckersState()
  const state = shallowRef<CheckersState | null>(null)
  const selected = ref<CheckersPosition | null>(null)
  const lastError = ref<string | null>(null)
  const movePending = ref(false)
  const myRole = ref<CheckersRole>('spectator')
  const mode = ref<CheckersMode>('bot')
  /** After roomId / canJoin changes, false until first WS `state` for this room (avoids bot-mode UI flicker). */
  const serverModeSynced = ref(false)
  const isRatedMatch = ref(false)
  const players = ref<Partial<Record<'player1' | 'player2', CheckersPlayerMeta>>>({})
  const readyPending = ref(false)
  const rematchRequestedByMe = ref(false)
  const rematchRequestedByOpponent = ref(false)
  const lastMove = ref<Pick<CheckersMove, 'from' | 'to'> | null>(null)

  const displayState = computed(() => state.value ?? initialState)
  const board = computed(() => displayState.value.board)

  const ws = createCheckersWsClient({
    onState(payload) {
      if (payload.roomId !== roomId.value) {
        return
      }
      state.value = payload.state
      myRole.value = payload.myRole
      mode.value = payload.mode
      serverModeSynced.value = true
      isRatedMatch.value = payload.rated === true
      players.value = payload.players ?? {}
      readyPending.value = false
      rematchRequestedByMe.value = Boolean(payload.rematch?.requestedByMe)
      rematchRequestedByOpponent.value = Boolean(payload.rematch?.requestedByOpponent)
      lastMove.value = payload.lastMove ?? null
      movePending.value = false
      lastError.value = null
      if (payload.state.forcedFrom) {
        selected.value = payload.state.forcedFrom
        return
      }
      selected.value = null
    },
    onError(message) {
      lastError.value = message
      movePending.value = false
    },
    getBotDifficulty: () => options.botDifficulty?.value ?? 'medium',
    getDisplayName: () => options.displayName?.value ?? '',
  })

  const legalMoves = computed<CheckersMove[]>(() => {
    const current = state.value
    if (!current || !selected.value) {
      return []
    }
    return getLegalMoves(current, selected.value)
  })

  const validDestinations = computed(() => legalMoves.value.map((move) => move.to))
  const captureDestinations = computed(() => legalMoves.value.filter((move) => move.captured).map((move) => move.to))

  const canMoveCurrentTurn = computed(() => {
    const current = state.value
    if (!current || current.winner) {
      return false
    }
    if (mode.value === 'local') {
      return true
    }
    if (mode.value === 'bot') {
      return myRole.value === 'player1' && current.turn === 'player1'
    }
    return myRole.value === current.turn
  })

  function connect(): void {
    if (!roomId.value || options.canJoin?.value === false) {
      return
    }
    ws.connect(roomId.value)
  }

  function dispose(): void {
    ws.dispose()
  }

  function selectOwnPiece(pos: CheckersPosition, current: CheckersState): boolean {
    if (!canMoveCurrentTurn.value) {
      return false
    }
    if (current.forcedFrom && !isSameCheckersPosition(pos, current.forcedFrom)) {
      return false
    }
    const piece = current.board[pos.row]?.[pos.col]
    if (piece?.player !== current.turn) {
      return false
    }
    if (getLegalMoves(current, pos).length === 0) {
      return false
    }
    selected.value = { row: pos.row, col: pos.col }
    return true
  }

  function selectCell(pos: CheckersPosition): void {
    const current = state.value
    if (!current || current.winner || movePending.value || !canMoveCurrentTurn.value) {
      return
    }

    if (selected.value) {
      if (isSameCheckersPosition(selected.value, pos)) {
        if (!current.forcedFrom) {
          selected.value = null
        }
        return
      }

      const valid = getValidMove(current, selected.value, pos)
      if (valid) {
        movePending.value = true
        ws.sendMove({ from: valid.from, to: valid.to }, current.revision)
        return
      }
    }

    if (!selectOwnPiece(pos, current) && !current.forcedFrom) {
      selected.value = null
    }
  }

  function isSelected(pos: CheckersPosition): boolean {
    return selected.value ? isSameCheckersPosition(selected.value, pos) : false
  }

  function isValidDestination(pos: CheckersPosition): boolean {
    return validDestinations.value.some((moveTo) => isSameCheckersPosition(moveTo, pos))
  }

  function restartGame(): void {
    selected.value = null
    movePending.value = false
    ws.restart()
  }

  function requestRematch(): void {
    ws.requestRematch()
  }

  function setMode(nextMode: CheckersMode): void {
    selected.value = null
    movePending.value = false
    readyPending.value = false
    ws.setMode(nextMode)
  }

  function setReady(ready: boolean): void {
    if (readyPending.value) {
      return
    }
    if (ws.setReady(ready)) {
      readyPending.value = true
    }
  }

  function updateDisplayName(displayName: string): void {
    ws.setIdentity(displayName)
  }

  function timeoutTurn(): void {
    const current = state.value
    if (!current || current.winner || !canMoveCurrentTurn.value) {
      return
    }
    selected.value = null
    movePending.value = false
    ws.timeoutTurn(current.revision)
  }

  watch([roomId, () => options.canJoin?.value ?? true], () => {
    serverModeSynced.value = false
    state.value = null
    selected.value = null
    lastError.value = null
    movePending.value = false
    myRole.value = 'spectator'
    mode.value = 'bot'
    isRatedMatch.value = false
    players.value = {}
    readyPending.value = false
    rematchRequestedByMe.value = false
    rematchRequestedByOpponent.value = false
    lastMove.value = null
    connect()
  }, { immediate: true })

  watch(
    () => options.displayName?.value ?? '',
    (displayName) => {
      updateDisplayName(displayName)
    },
  )

  onUnmounted(dispose)

  return {
    roomId,
    state,
    displayState,
    board,
    selected,
    legalMoves,
    validDestinations,
    captureDestinations,
    wsStatus: ws.status,
    lastError,
    movePending,
    myRole,
    mode,
    serverModeSynced,
    isRatedMatch,
    players,
    readyPending,
    rematchRequestedByMe,
    rematchRequestedByOpponent,
    lastMove,
    canMoveCurrentTurn,
    selectCell,
    restartGame,
    requestRematch,
    setMode,
    setReady,
    updateDisplayName,
    timeoutTurn,
    isSelected,
    isValidDestination,
    connect,
    dispose,
  }
}
