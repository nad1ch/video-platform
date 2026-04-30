<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { playAllPageAudio, useCallOrchestrator, type CallEngineRole } from 'call-core'
import { useAuth } from '@/composables/useAuth'
import { useLocalTileSpeakingVisual } from '@/composables/useLocalTileSpeakingVisual'
import { apiFetch, readJsonIfOk } from '@/utils/apiFetch'
import CallRoomPopover from '@/components/call/CallRoomPopover.vue'
import '@/components/call/CallPage.css'
import NadleGlobalLeaderboardTable, {
  type NadleGlobalLbTab,
  type NadleGlobalLeaderboardRowVm,
} from '@/components/nadle/NadleGlobalLeaderboardTable.vue'
import StreamAudio from '@/components/StreamAudio.vue'
import TwitchRelayChatPanel from '@/components/twitch/TwitchRelayChatPanel.vue'
import type { TwitchRelayChatWsStatus } from '@/components/twitch/twitchRelayChatTypes'
import AppCard from '@/components/ui/AppCard.vue'
import AppContainer from '@/components/ui/AppContainer.vue'
import AppLandingFooter from '@/pages/app/components/AppFooter.vue'
import { persistLocale, LOCALE_OPTIONS } from '@/eat-first/i18n'
import { getLegalMoves, getValidMove } from '../core/checkersEngine'
import type { CheckersPlayer, CheckersPosition } from '../core/types'
import { useCheckersOrchestrator } from '../orchestrator/useCheckersOrchestrator'
import { readCheckersClientId, type CheckersBotDifficulty, type CheckersMode } from '../ws/checkersWs'
import CheckersBoard from '../ui/CheckersBoard.vue'
import CheckersEndGameOverlay from '../ui/CheckersEndGameOverlay.vue'
import { useI18n } from 'vue-i18n'
import {
  CALL_ROOM_DROPDOWN_HOST_ID,
  CALL_ROOM_POPOVER_PANEL_ID,
  useCallRoomHeaderJoinStore,
} from '@/stores/callRoomHeaderJoin'

const route = useRoute()
const router = useRouter()
const { locale } = useI18n()
const auth = useAuth()
const roomHeader = useCallRoomHeaderJoinStore()

const roomId = computed(() => {
  const raw = route.params.roomId
  const value = Array.isArray(raw) ? raw[0] : raw
  return String(value ?? '').trim()
})

const botDifficulty = ref<CheckersBotDifficulty>('medium')
const checkers = useCheckersOrchestrator({ roomId, botDifficulty })
const leaderboardTab = ref<NadleGlobalLbTab>('wins')
const leaderboardWins = ref<Record<string, number>>(readCheckersLeaderboard())
const recordedWinnerRevision = ref<number | null>(null)
const footerYear = new Date().getFullYear()
const feedbackHref = 'mailto:feedback@streamassist.net?subject=StreamAssist%20feedback'
const footerLocaleOptions = computed(() => LOCALE_OPTIONS.map((option) => ({ value: option.code, label: option.label })))
const copiedInvite = ref(false)
const roomJoinDraft = ref('')
const roomCopyFlash = ref(false)
const displayNameDraft = ref(auth.user.value?.displayName ?? '')
const videoQualityChoice = ref<'auto'>('auto')
const callDebugOverlay = ref(false)
const remoteAudioUnlocked = ref(false)
const remoteListenVolume = ref(1)
const remoteListenMuted = ref(false)
const audioControlsOpen = ref(false)
const audioControlsRoot = ref<HTMLElement | null>(null)
const hasStartedCurrentGame = ref(false)
const pendingModeChange = ref<CheckersMode | null>(null)
const rematchCountdown = ref(5)
const ratingDelta = ref<number | null>(null)
type MatchmakingState = 'idle' | 'searching' | 'matched'
const matchmakingState = ref<MatchmakingState>('idle')
const matchmakingError = ref('')
const TURN_SECONDS = 60
const turnSecondsLeft = ref(TURN_SECONDS)
const showYourTurn = ref(false)
let turnTimer: ReturnType<typeof setInterval> | null = null
let yourTurnTimer: ReturnType<typeof setTimeout> | null = null
let matchmakingAbort: AbortController | null = null
let matchRedirectTimer: ReturnType<typeof setTimeout> | null = null
let rematchCountdownTimer: ReturnType<typeof setInterval> | null = null
let matchFoundFeedbackPlayed = false
const chatWsStatus = computed<TwitchRelayChatWsStatus>(() =>
  checkers.wsStatus.value === 'reconnecting' ? 'closed' : checkers.wsStatus.value,
)
const chatWsStatusLabel = computed(() => (checkers.wsStatus.value === 'reconnecting' ? 'reconnecting' : checkers.wsStatus.value))
const inviteUrl = computed(() => {
  const path = `/app/checkers/${encodeURIComponent(checkers.roomId.value || 'checkers')}`
  if (typeof window === 'undefined') {
    return path
  }
  return new URL(path, window.location.origin).href
})
const modeLabel = computed(() => {
  if (checkers.mode.value === 'bot') return 'Гра проти бота'
  if (checkers.mode.value === 'local') return '2 гравці на одному екрані'
  return 'Гра з другом'
})
const roleLabel = computed(() => {
  if (checkers.mode.value === 'local') return 'Локальна гра'
  if (checkers.myRole.value === 'player1') return playerOneLabel.value
  if (checkers.myRole.value === 'player2') return playerTwoLabel.value
  return 'Spectator'
})
const playerOneLabel = computed(() =>
  checkers.myRole.value === 'player1' && auth.user.value?.displayName
    ? auth.user.value.displayName
    : 'Player 1',
)
const playerTwoLabel = computed(() =>
  checkers.myRole.value === 'player2' && auth.user.value?.displayName
    ? auth.user.value.displayName
    : 'Player 2',
)
const turnLabel = computed(() => {
  const turn = checkers.displayState.value.turn
  if (turn === checkers.myRole.value && auth.user.value?.displayName) {
    return auth.user.value.displayName
  }
  return turn === 'player1' ? playerOneLabel.value : playerTwoLabel.value
})
const turnTimerLabel = computed(() => {
  const m = Math.floor(turnSecondsLeft.value / 60).toString().padStart(2, '0')
  const s = Math.max(0, turnSecondsLeft.value % 60).toString().padStart(2, '0')
  return `${m}:${s}`
})
const boardFlipped = computed(() => checkers.myRole.value === 'player2')
const isCheckersPlayer = computed(() => checkers.myRole.value === 'player1' || checkers.myRole.value === 'player2')
const isCheckersSpectator = computed(() => !isCheckersPlayer.value)
type EndGameWinner = CheckersPlayer | 'you' | 'opponent'
const winnerLabel = computed(() => {
  const winner = checkers.displayState.value.winner
  if (!winner) return ''
  return winner === 'player1' ? 'Player 1 wins' : 'Player 2 wins'
})
const isEndGameOverlayVisible = computed(() => Boolean(checkers.displayState.value.winner))
const isStartOverlayVisible = computed(() =>
  matchmakingState.value === 'idle' &&
    !hasStartedCurrentGame.value &&
    !checkers.displayState.value.winner,
)
const startGameButtonLabel = computed(() =>
  checkers.mode.value === 'friend' ? 'Почати пошук противника' : 'Почати гру',
)
const isActiveGame = computed(() => Boolean(hasStartedCurrentGame.value && !checkers.displayState.value.winner))
const pendingModeLabel = computed(() => {
  if (pendingModeChange.value === 'bot') return 'гру проти бота'
  if (pendingModeChange.value === 'friend') return 'гру з противником'
  if (pendingModeChange.value === 'local') return '2 гравці на одному екрані'
  return 'інший режим'
})
const endGameWinner = computed<EndGameWinner | null>(() => {
  const winner = checkers.displayState.value.winner
  if (!winner) return null
  if (checkers.mode.value === 'local' || isCheckersSpectator.value) return winner
  return winner === checkers.myRole.value ? 'you' : 'opponent'
})
const checkersVoiceRoomId = computed(() => {
  const room = checkers.roomId.value.trim()
  return room ? `checkers:${room}` : ''
})
const checkersVoiceDisplayName = computed(() => {
  const name = auth.user.value?.displayName?.trim() || displayNameDraft.value.trim()
  return name || roleLabel.value
})
const checkersVoiceRole = computed<CallEngineRole>(() => (isCheckersPlayer.value ? 'participant' : 'viewer'))
const checkersVoiceMediaMode = computed(() => 'audio-only' as const)
const checkersVoiceJoinUserId = computed(() => {
  const id = auth.user.value?.id
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : undefined
})
const checkersVoice = useCallOrchestrator({
  role: checkersVoiceRole,
  mediaMode: checkersVoiceMediaMode,
  joinUserId: checkersVoiceJoinUserId,
})
const remoteVoiceTiles = computed(() =>
  checkersVoice.tiles.value.filter((tile) => !tile.isLocal && tile.stream?.getAudioTracks().length),
)
const isMicActive = computed(() => isCheckersPlayer.value && checkersVoice.micEnabled.value)
const localMicSpeaking = useLocalTileSpeakingVisual(
  () => checkersVoice.localAudioSourceStream.value,
  () => true,
  () => isMicActive.value,
)
const micButtonLabel = computed(() => {
  if (isCheckersSpectator.value) return 'Spectators can only listen'
  return isMicActive.value ? 'Mute microphone' : 'Turn microphone on'
})
const shouldShowAutoRematchCountdown = computed(() =>
  Boolean(
    checkers.displayState.value.winner &&
    checkers.mode.value === 'friend' &&
    isCheckersPlayer.value &&
    !checkers.rematchRequestedByMe.value,
  ),
)
const winningMove = computed(() => (checkers.displayState.value.winner ? checkers.lastMove.value : null))
const leaderboardRows = computed<NadleGlobalLeaderboardRowVm[]>(() =>
  Object.entries(leaderboardWins.value)
    .sort((a, b) => b[1] - a[1])
    .map(([displayName, wins], index) => ({
      rowKey: displayName,
      rank: index + 1,
      displayName,
      avatarUrl: null,
      score: wins,
      isSelf: displayName === roleLabel.value,
      initials: displayName.slice(0, 1).toUpperCase(),
    })),
)

function readCheckersLeaderboard(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem('checkers:leaderboard:v1') || '{}')
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {}
  } catch {
    return {}
  }
}

function saveCheckersLeaderboard(next: Record<string, number>): void {
  leaderboardWins.value = next
  try {
    localStorage.setItem('checkers:leaderboard:v1', JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

function emptyCooldownHint(): string {
  return ''
}

function emptyFeedbackEmojis(): string {
  return ''
}

function stopTurnTimer(): void {
  if (turnTimer) {
    clearInterval(turnTimer)
    turnTimer = null
  }
}

function stopRematchCountdown(): void {
  if (rematchCountdownTimer) {
    clearInterval(rematchCountdownTimer)
    rematchCountdownTimer = null
  }
}

function flashYourTurn(): void {
  if (isStartOverlayVisible.value) return
  if (!checkers.canMoveCurrentTurn.value) return
  showYourTurn.value = true
  if (yourTurnTimer) clearTimeout(yourTurnTimer)
  yourTurnTimer = setTimeout(() => {
    showYourTurn.value = false
    yourTurnTimer = null
  }, 2000)
}

function restartTurnTimer(): void {
  stopTurnTimer()
  turnSecondsLeft.value = TURN_SECONDS
  if (checkers.displayState.value.winner || isStartOverlayVisible.value) return
  turnTimer = setInterval(() => {
    turnSecondsLeft.value = Math.max(0, turnSecondsLeft.value - 1)
    if (turnSecondsLeft.value === 0) {
      stopTurnTimer()
      checkers.timeoutTurn()
    }
  }, 1000)
}

watch(
  () =>
    `${checkers.displayState.value.turn}:${checkers.displayState.value.revision}:${checkers.mode.value}:${checkers.myRole.value}:${isStartOverlayVisible.value}`,
  () => {
    restartTurnTimer()
    flashYourTurn()
  },
  { immediate: true },
)

watch(roomId, () => {
  hasStartedCurrentGame.value = false
})

onUnmounted(() => {
  stopTurnTimer()
  stopRematchCountdown()
  if (yourTurnTimer) clearTimeout(yourTurnTimer)
  if (matchRedirectTimer) clearTimeout(matchRedirectTimer)
  cancelMatchmaking()
  teardownAudioGestureUnlock()
  checkersVoice.leaveCall()
  roomHeader.reset()
})

function unlockRemoteAudio(): void {
  remoteAudioUnlocked.value = true
  playAllPageAudio()
}

function onAudioGesture(): void {
  unlockRemoteAudio()
}

function teardownAudioGestureUnlock(): void {
  if (typeof window === 'undefined') return
  window.removeEventListener('pointerdown', onAudioGesture, true)
  window.removeEventListener('keydown', onAudioGesture, true)
}

function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target
  if (!(target instanceof Node)) return

  const roomHost = document.getElementById(CALL_ROOM_DROPDOWN_HOST_ID)
  const roomPanel = document.getElementById(CALL_ROOM_POPOVER_PANEL_ID)
  if (roomHeader.roomPopoverOpen && !roomHost?.contains(target) && !roomPanel?.contains(target)) {
    roomHeader.closeRoomPopover()
  }

  if (audioControlsOpen.value && !audioControlsRoot.value?.contains(target)) {
    audioControlsOpen.value = false
  }
}

onMounted(() => {
  if (typeof window === 'undefined') return
  preloadMatchFoundSound()
  void refreshBotDifficulty()
  window.addEventListener('pointerdown', onAudioGesture, { capture: true })
  window.addEventListener('keydown', onAudioGesture, { capture: true })
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
})

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  }
})

watch(
  () => auth.user.value?.dbUserId,
  () => {
    void refreshBotDifficulty()
  },
)

watch(
  () => ({
    winner: checkers.displayState.value.winner,
    revision: checkers.displayState.value.revision,
  }),
  ({ winner, revision }) => {
    if (!winner) {
      ratingDelta.value = null
    }
    if (!winner || recordedWinnerRevision.value === revision) return
    recordedWinnerRevision.value = revision
    const label = winner === 'player1' ? playerOneLabel.value : playerTwoLabel.value
    saveCheckersLeaderboard({
      ...leaderboardWins.value,
      [label]: (leaderboardWins.value[label] ?? 0) + 1,
    })
    void submitCheckersMatchResult(revision)
  },
)

watch(
  shouldShowAutoRematchCountdown,
  (show) => {
    stopRematchCountdown()
    if (!show) return
    rematchCountdown.value = 5
    rematchCountdownTimer = setInterval(() => {
      rematchCountdown.value = Math.max(0, rematchCountdown.value - 1)
      if (rematchCountdown.value === 0) {
        stopRematchCountdown()
      }
    }, 1000)
  },
  { immediate: true },
)

function setGameMode(mode: CheckersMode): void {
  if (matchmakingState.value !== 'idle') return
  if (mode === checkers.mode.value) return
  if (isActiveGame.value) {
    pendingModeChange.value = mode
    return
  }
  applyGameModeChange(mode)
}

function applyGameModeChange(mode: CheckersMode): void {
  pendingModeChange.value = null
  hasStartedCurrentGame.value = false
  showYourTurn.value = false
  stopTurnTimer()
  checkers.restartGame()
  checkers.setMode(mode)
}

function confirmModeChange(): void {
  const mode = pendingModeChange.value
  if (!mode) return
  applyGameModeChange(mode)
}

function cancelModeChange(): void {
  pendingModeChange.value = null
}

function startCurrentGame(): void {
  hasStartedCurrentGame.value = true
  if (checkers.mode.value === 'friend') {
    void findMatch()
    return
  }
  restartTurnTimer()
  flashYourTurn()
}

function difficultyForRating(rating: number): CheckersBotDifficulty {
  if (rating < 1000) return 'easy'
  if (rating > 1400) return 'hard'
  return 'medium'
}

async function refreshBotDifficulty(): Promise<void> {
  const userId = auth.user.value?.dbUserId
  if (!userId) {
    botDifficulty.value = 'medium'
    return
  }
  const res = await apiFetch('/api/leaderboard/rating?game=checkers').catch(() => null)
  if (!res) return
  const data = await readJsonIfOk<{
    entries?: Array<{ userId?: string; rating?: number }>
  }>(res)
  const entry = data?.entries?.find((row) => row.userId === userId)
  botDifficulty.value = difficultyForRating(typeof entry?.rating === 'number' ? entry.rating : 1200)
}

function preloadMatchFoundSound(): void {
  if (typeof window === 'undefined') return
  const AudioContextCtor =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return
  audioContext ??= new AudioContextCtor()
}

function playMatchFoundSound(): void {
  if (matchFoundFeedbackPlayed || typeof window === 'undefined') return
  matchFoundFeedbackPlayed = true
  const AudioContextCtor =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return
  audioContext ??= new AudioContextCtor()
  const ctx = audioContext
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.24)
  gain.connect(ctx.destination)
  for (const [index, frequency] of [523, 784].entries()) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    osc.connect(gain)
    osc.start(ctx.currentTime + index * 0.055)
    osc.stop(ctx.currentTime + 0.24)
  }
}

function cancelMatchmaking(): void {
  if (matchmakingState.value !== 'searching') {
    return
  }
  matchmakingAbort?.abort()
  matchmakingAbort = null
  matchmakingState.value = 'idle'
  if (checkers.mode.value === 'friend') {
    hasStartedCurrentGame.value = false
  }
  void apiFetch('/api/matchmaking/leave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: readCheckersClientId() }),
  }).catch(() => {})
}

async function findMatch(): Promise<void> {
  if (matchmakingState.value !== 'idle') {
    return
  }
  matchmakingState.value = 'searching'
  matchmakingError.value = ''
  matchFoundFeedbackPlayed = false
  const clientId = readCheckersClientId()
  const abort = new AbortController()
  matchmakingAbort = abort

  try {
    while (!abort.signal.aborted) {
      const res = await apiFetch('/api/matchmaking/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
        signal: abort.signal,
      })
      const data = await readJsonIfOk<{ roomId?: string | null }>(res)
      const matchRoomId = typeof data?.roomId === 'string' ? data.roomId.trim() : ''
      if (matchRoomId) {
        matchmakingState.value = 'matched'
        matchmakingAbort = null
        playMatchFoundSound()
        matchRedirectTimer = setTimeout(() => {
          matchRedirectTimer = null
          void router.push({ name: 'checkers', params: { roomId: matchRoomId } }).finally(() => {
            hasStartedCurrentGame.value = true
            matchmakingState.value = 'idle'
          })
        }, 850)
        return
      }
      if (!res.ok && res.status !== 202 && res.status !== 409) {
        throw new Error('matchmaking_failed')
      }
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      matchmakingError.value = 'Не вдалося знайти гру. Спробуй ще раз.'
      if (checkers.mode.value === 'friend') {
        hasStartedCurrentGame.value = false
      }
    }
  } finally {
    if (matchmakingAbort === abort) {
      matchmakingAbort = null
    }
    if (matchmakingState.value === 'searching') {
      matchmakingState.value = 'idle'
    }
  }
}

async function submitCheckersMatchResult(revision: number): Promise<void> {
  const room = checkers.roomId.value.trim()
  if (!room || checkers.mode.value !== 'friend') {
    return
  }
  const res = await apiFetch('/api/matchmaking/result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: room, revision }),
  }).catch(() => {})
  if (!res) return
  const data = await readJsonIfOk<{ ratingDelta?: number }>(res)
  if (typeof data?.ratingDelta === 'number') {
    ratingDelta.value = Math.round(data.ratingDelta)
  }
  void refreshBotDifficulty()
}

function toggleCheckersMic(): void {
  unlockRemoteAudio()
  if (!isCheckersPlayer.value) {
    if (checkersVoice.micEnabled.value) {
      checkersVoice.toggleMic()
    }
    return
  }
  checkersVoice.toggleMic()
}

function toggleRemoteListenMuted(): void {
  remoteListenMuted.value = !remoteListenMuted.value
}

function remoteVoiceLevel(peerId: string): number {
  return checkersVoice.audioLevelsByPeerId.value[peerId] ?? 0
}

function isRemoteVoiceDucked(peerId: string): boolean {
  const dominant = checkersVoice.dominantSpeakerPeerId.value
  return dominant !== null && dominant !== peerId
}

watch(checkersVoiceDisplayName, (displayName) => {
  checkersVoice.session.selfDisplayName = displayName
}, { immediate: true })

let checkersVoiceJoinSeq = 0
watch(
  () => ({
    ready: Boolean(checkers.state.value),
    role: checkersVoiceRole.value,
    roomId: checkersVoiceRoomId.value,
  }),
  async ({ ready, roomId }) => {
    const seq = ++checkersVoiceJoinSeq
    checkersVoice.leaveCall()
    remoteAudioUnlocked.value = false
    await nextTick()
    if (seq !== checkersVoiceJoinSeq || !ready || !roomId) {
      return
    }
    checkersVoice.session.roomId = roomId
    checkersVoice.session.selfDisplayName = checkersVoiceDisplayName.value
    await checkersVoice.joinCall()
  },
  { immediate: true, flush: 'post' },
)

watch(isCheckersPlayer, (canSpeak) => {
  if (!canSpeak && checkersVoice.micEnabled.value) {
    checkersVoice.toggleMic()
  }
}, { immediate: true })

function createRoom(room = `room-${Date.now().toString(36)}`): void {
  void router.push({ name: 'checkers', params: { roomId: room } })
}

async function copyInviteLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(inviteUrl.value)
    copiedInvite.value = true
    roomCopyFlash.value = true
    window.setTimeout(() => {
      copiedInvite.value = false
      roomCopyFlash.value = false
    }, 1800)
  } catch {
    copiedInvite.value = false
    roomCopyFlash.value = false
  }
}

function submitRoomDraft(): void {
  const room = roomJoinDraft.value.trim()
  if (!room) return
  createRoom(room)
  roomHeader.closeRoomPopover()
}

watch(roomId, (room) => {
  roomJoinDraft.value = room || 'lobby'
}, { immediate: true })

let audioContext: AudioContext | null = null
let lastSoundAt = 0

function playUiTone(kind: 'select' | 'move' | 'capture'): void {
  if (typeof window === 'undefined') {
    return
  }
  const now = performance.now()
  if (now - lastSoundAt < 55) {
    return
  }
  lastSoundAt = now
  const AudioContextCtor =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) {
    return
  }
  audioContext ??= new AudioContextCtor()
  const ctx = audioContext
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const frequency = kind === 'capture' ? 180 : kind === 'move' ? 440 : 620
  osc.type = kind === 'capture' ? 'triangle' : 'sine'
  osc.frequency.setValueAtTime(frequency, ctx.currentTime)
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === 'capture' ? 0.16 : 0.09))
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + (kind === 'capture' ? 0.18 : 0.11))
}

function handleCellClick(pos: CheckersPosition): void {
  if (matchmakingState.value !== 'idle' || isStartOverlayVisible.value) {
    return
  }
  const current = checkers.state.value
  const selected = checkers.selected.value
  if (!checkers.canMoveCurrentTurn.value) {
    return
  }
  if (!current) {
    checkers.selectCell(pos)
    return
  }
  const validMove = selected ? getValidMove(current, selected, pos) : null
  const piece = current.board[pos.row]?.[pos.col]
  if (validMove) {
    playUiTone(validMove.captured ? 'capture' : 'move')
  } else if (piece?.player === current.turn && getLegalMoves(current, pos).length > 0) {
    playUiTone('select')
  }
  checkers.selectCell(pos)
}
</script>

<template>
  <div
    class="page-route"
    :class="{
      'page-route--matchmaking': matchmakingState === 'searching',
      'page-route--matched': matchmakingState === 'matched',
    }"
  >
    <CallRoomPopover
      v-model:display-name="displayNameDraft"
      v-model:room-join-draft="roomJoinDraft"
      v-model:video-quality-choice="videoQualityChoice"
      v-model:call-debug-overlay="callDebugOverlay"
      :open="roomHeader.roomPopoverOpen"
      :room-copy-flash="roomCopyFlash"
      :joining="false"
      :allow-manual-video-quality="false"
      :show-call-debug-controls="false"
      :is-admin="false"
      :ws-status="checkers.wsStatus.value"
      :quality-presets="[]"
      @submit-room="submitRoomDraft"
      @copy-room="copyInviteLink"
      @generate-room="createRoom()"
    />
    <AppContainer wide flush class="nadle-page nadle-page--len5">
      <div class="nadle-page__grid h-full min-h-0">
        <AppCard class="nadle-page__stack nadle-page__stack--side nadle-page__stack--leader">
          <div class="nadle-page__leader-stack">
            <section class="checkers-room-meta" aria-label="Checkers room status">
              <div class="checkers-mode-icons" aria-label="Game mode">
                <button
                  type="button"
                  class="checkers-mode-icon"
                  :class="{ 'checkers-mode-icon--active': checkers.mode.value === 'friend' }"
                  :disabled="matchmakingState !== 'idle'"
                  title="Грати з другом"
                  aria-label="Грати з другом"
                  @click="setGameMode('friend')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.7-3 2.5-5 4.5-5s3.8 2 4.5 5H3.5Zm8 0c.5-1.8 1.3-3.3 2.4-4.2.6-.5 1.3-.8 2.1-.8 2 0 3.8 2 4.5 5h-9Z" /></svg>
                </button>
                <button
                  type="button"
                  class="checkers-mode-icon"
                  :class="{ 'checkers-mode-icon--active': checkers.mode.value === 'bot' }"
                  :disabled="matchmakingState !== 'idle'"
                  title="Грати проти бота"
                  aria-label="Грати проти бота"
                  @click="setGameMode('bot')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v3h3a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4h3V3Zm-3 5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H8Zm1.5 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" /></svg>
                </button>
                <button
                  type="button"
                  class="checkers-mode-icon"
                  :class="{ 'checkers-mode-icon--active': checkers.mode.value === 'local' }"
                  :disabled="matchmakingState !== 'idle'"
                  title="2 гравці на одному екрані"
                  aria-label="2 гравці на одному екрані"
                  @click="setGameMode('local')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6v2h3v2H7v-2h3v-2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v9h16V7H4Z" /></svg>
                </button>
              </div>
              <button
                type="button"
                class="checkers-find-match"
                :disabled="matchmakingState !== 'idle'"
                @click="findMatch"
              >
                Знайти гру
              </button>
              <p v-if="matchmakingError" class="checkers-room-meta__error">{{ matchmakingError }}</p>
              <p><span>Mode:</span> {{ modeLabel }}</p>
              <p><span>You:</span> {{ roleLabel }}</p>
              <p class="checkers-room-meta__turn"><span>Turn:</span> {{ turnLabel }}</p>
              <p><span>Timer:</span> {{ turnTimerLabel }}</p>
            </section>
            <NadleGlobalLeaderboardTable
              v-model:tab="leaderboardTab"
              :loading="false"
              :error="null"
              :rows="leaderboardRows"
              score-column-header="Wins"
              :self-streak-summary="null"
              section-aria-label="Checkers leaderboard"
              title="Leaderboard"
              tabs-aria-label="Leaderboard tabs"
              tab-wins-label="Wins"
              tab-streak-label="Streak"
              tab-rating-label="Rating"
              loading-text="Loading leaderboard"
              empty-text="No data yet"
              col-rank="#"
              col-player="Player"
              you-label="You"
            />
          </div>
        </AppCard>

        <AppCard class="nadle-page__stack nadle-page__stack--game checkers-game-stack">
          <div class="nadle-page__game">
            <div class="nadle-page__guess-focus-anchor checkers-board-shell">
              <CheckersBoard
                :board="checkers.board.value"
                :selected="checkers.selected.value"
                :valid-destinations="checkers.validDestinations.value"
                :capture-destinations="checkers.captureDestinations.value"
                :winning-move="winningMove"
                :flipped="boardFlipped"
                @cell-click="handleCellClick"
              />
              <Transition name="checkers-start-game">
                <div
                  v-if="isStartOverlayVisible"
                  class="checkers-start-game-overlay"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="checkers-start-game-title"
                >
                  <button
                    id="checkers-start-game-title"
                    type="button"
                    class="checkers-start-game-button"
                    @click="startCurrentGame"
                  >
                    {{ startGameButtonLabel }}
                  </button>
                </div>
              </Transition>
              <CheckersEndGameOverlay
                :winner="endGameWinner"
                :mode="checkers.mode.value"
                :is-visible="isEndGameOverlayVisible"
                @rematch="checkers.restartGame()"
                @play-bot="setGameMode('bot')"
                @play-friend="setGameMode('friend')"
                @play-local="setGameMode('local')"
              >
                <span
                  v-if="ratingDelta !== null"
                  class="checkers-rating-delta"
                  :class="{ 'checkers-rating-delta--down': ratingDelta < 0 }"
                >
                  {{ ratingDelta > 0 ? `+${ratingDelta}` : ratingDelta }}
                </span>
                <span v-if="shouldShowAutoRematchCountdown" class="checkers-auto-rematch">
                  Реванш через <strong :key="rematchCountdown">{{ rematchCountdown }}</strong>...
                </span>
              </CheckersEndGameOverlay>
            </div>
            <div class="checkers-controls">
              <div class="checkers-controls__actions" aria-hidden="true" />
              <p v-if="winnerLabel" class="checkers-controls__meta">
                <span>{{ winnerLabel }}</span>
              </p>
            </div>
          </div>
        </AppCard>

        <AppCard class="nadle-page__stack nadle-page__stack--side nadle-page__stack--chat">
          <TwitchRelayChatPanel
            flex-rail
            :show-guess-hints="false"
            :ws-status="chatWsStatus"
            :ws-status-label="chatWsStatusLabel"
            chat-title="Chat"
            guess-len-hint=""
            :channel-display="checkers.roomId.value || 'checkers'"
            twitch-watch-url="https://www.twitch.tv/nad1ch"
            open-twitch-label="open"
            irc-relay-banner=""
            relay-aria-label="Checkers room chat"
            chat-empty-text="Room chat is not connected yet."
            guess-badge-label=""
            :lines="[]"
            :default-cooldown-ms="1500"
            :format-cooldown-hint="emptyCooldownHint"
            :feedback-to-emojis="emptyFeedbackEmojis"
          />
        </AppCard>
      </div>
    </AppContainer>
    <AppLandingFooter
      class="checkers-footer"
      brand-name="Nad1ch"
      :feedback-href="feedbackHref"
      :locale="locale"
      :locale-options="footerLocaleOptions"
      :year="footerYear"
      @update:locale="persistLocale"
    />
    <Transition name="checkers-your-turn">
      <div v-if="showYourTurn" class="checkers-your-turn" aria-live="polite">
        Твій хід
      </div>
    </Transition>
    <Transition name="checkers-matchmaking">
      <div
        v-if="matchmakingState !== 'idle'"
        class="checkers-matchmaking-overlay"
        :class="{ 'checkers-matchmaking-overlay--matched': matchmakingState === 'matched' }"
        role="status"
        aria-live="polite"
      >
        <div class="checkers-matchmaking-card">
          <p class="checkers-matchmaking-title">
            {{ matchmakingState === 'matched' ? 'Суперник знайдений!' : 'Пошук суперника' }}
            <span v-if="matchmakingState === 'searching'" class="checkers-matchmaking-dots" aria-hidden="true">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </p>
          <p class="checkers-matchmaking-hint">
            {{ matchmakingState === 'matched' ? 'Переходимо до кімнати' : 'Підбираємо гравця з близьким рейтингом' }}
          </p>
          <button
            v-if="matchmakingState === 'searching'"
            type="button"
            class="checkers-matchmaking-cancel"
            @click="cancelMatchmaking"
          >
            Скасувати
          </button>
        </div>
      </div>
    </Transition>
    <Transition name="checkers-mode-confirm">
      <div
        v-if="pendingModeChange"
        class="checkers-mode-confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkers-mode-confirm-title"
      >
        <div class="checkers-mode-confirm-card">
          <p id="checkers-mode-confirm-title" class="checkers-mode-confirm-title">Змінити режим гри?</p>
          <p class="checkers-mode-confirm-copy">
            Поточна партія буде скинута. Після переходу на {{ pendingModeLabel }} білі знову ходитимуть першими.
          </p>
          <div class="checkers-mode-confirm-actions">
            <button type="button" class="checkers-mode-confirm-button" @click="cancelModeChange">
              Залишитись
            </button>
            <button
              type="button"
              class="checkers-mode-confirm-button checkers-mode-confirm-button--danger"
              @click="confirmModeChange"
            >
              Змінити режим
            </button>
          </div>
        </div>
      </div>
    </Transition>
    <div class="checkers-voice-audio" aria-hidden="true">
      <StreamAudio
        v-for="tile in remoteVoiceTiles"
        :key="tile.peerId"
        :stream="tile.stream"
        :play-rev="tile.playRev"
        :listen-volume="remoteListenVolume"
        :listen-muted="!remoteAudioUnlocked || remoteListenMuted"
        :audio-level="remoteVoiceLevel(tile.peerId)"
        :voice-ducked="isRemoteVoiceDucked(tile.peerId)"
        audio-processing
      />
    </div>
    <div ref="audioControlsRoot" class="checkers-audio-controls">
      <button
        type="button"
        class="checkers-headphones-button"
        :class="{
          'checkers-headphones-button--active': audioControlsOpen,
          'checkers-headphones-button--muted': remoteListenMuted,
        }"
        aria-label="Audio controls"
        title="Audio controls"
        @click="audioControlsOpen = !audioControlsOpen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4a8 8 0 0 0-8 8v6a2 2 0 0 0 2 2h3v-8H6a6 6 0 0 1 12 0h-3v8h3a2 2 0 0 0 2-2v-6a8 8 0 0 0-8-8Z" />
          <path v-if="remoteListenMuted" d="M4.7 3.3 20.7 19.3 19.3 20.7 3.3 4.7 4.7 3.3Z" />
        </svg>
      </button>
      <div v-if="audioControlsOpen" class="checkers-audio-popover">
        <label class="checkers-audio-popover__label">
          Гучність
          <span>{{ Math.round(remoteListenVolume * 100) }}%</span>
        </label>
        <input
          v-model.number="remoteListenVolume"
          class="checkers-audio-popover__range"
          type="range"
          min="0"
          max="2"
          step="0.01"
        />
        <button type="button" class="checkers-audio-popover__mute" @click="toggleRemoteListenMuted">
          {{ remoteListenMuted ? 'Увімкнути суперника' : 'Вимкнути суперника' }}
        </button>
      </div>
    </div>
    <button
      type="button"
      class="checkers-mic-button"
      :class="{
        'checkers-mic-button--active': isMicActive,
        'checkers-mic-button--muted': !isMicActive,
        'checkers-mic-button--speaking': isMicActive && localMicSpeaking,
      }"
      :disabled="isCheckersSpectator"
      :aria-pressed="isMicActive"
      :aria-label="micButtonLabel"
      :title="micButtonLabel"
      @click="toggleCheckersMic"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
        <path d="M5 11h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h-2v-3.08A7 7 0 0 1 5 11Z" />
        <path v-if="!isMicActive" d="M4.7 3.3 20.7 19.3 19.3 20.7 3.3 4.7 4.7 3.3Z" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.page-route {
  height: 100vh;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.page-route--matched {
  animation: checkers-match-found-pulse 0.85s ease-out both;
}

@keyframes checkers-match-found-pulse {
  0%,
  100% {
    filter: none;
  }
  42% {
    filter: drop-shadow(0 0 22px rgba(168, 85, 247, 0.45));
  }
}

.nadle-page {
  --nadle-panel-radius: 29px;
  --nadle-panel-bg: linear-gradient(105deg, rgba(124, 77, 219, 0.173) 0%, rgba(60, 36, 99, 0.169) 73.21%);
  --nadle-panel-border: rgba(255, 255, 255, 0.22);
  --nadle-control-bg: rgba(102, 56, 143, 0.47);
  --nadle-control-bg-muted: rgba(102, 56, 143, 0.11);
  --nadle-control-bg-soft: rgba(102, 56, 143, 0.05);
  --nadle-tile-bg: rgba(102, 56, 143, 0.33);
  flex: 1 1 auto;
  padding-block: var(--sa-space-2) var(--sa-space-5);
  padding-inline: var(--sa-space-4);
  font-family: var(--sa-font-main);
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: var(--sa-space-2);
  width: 100%;
  max-width: min(56.25rem, 100%);
  margin-inline: auto;
  box-sizing: border-box;
  overflow: hidden;
}

.nadle-page__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--sa-space-4);
  align-items: stretch;
  grid-auto-rows: auto;
}

.nadle-page__stack {
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 0;
  border-radius: var(--nadle-panel-radius);
  border-color: var(--nadle-panel-border);
  background:
    radial-gradient(circle at 55% 8%, rgba(255, 255, 255, 0.2) 0 1px, transparent 1.7px),
    radial-gradient(circle at 28% 58%, rgba(102, 56, 143, 0.21), transparent 34%),
    var(--nadle-panel-bg);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -1px 0 rgba(255, 255, 255, 0.045),
    0 16px 44px rgba(3, 1, 9, 0.24);
  overflow: hidden;
  -webkit-backdrop-filter: blur(20px) saturate(1.18);
  backdrop-filter: blur(20px) saturate(1.18);
}

.nadle-page__stack--game {
  justify-content: flex-start;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.18) 0 1px, transparent 1.7px),
    radial-gradient(circle at 34% 58%, rgba(102, 56, 143, 0.23), transparent 30%),
    linear-gradient(124deg, rgba(124, 77, 219, 0.173) 0%, rgba(60, 36, 99, 0.169) 73.21%);
}

.nadle-page__stack--leader,
.nadle-page__stack--chat {
  background:
    radial-gradient(circle at 54% 3%, rgba(255, 255, 255, 0.2) 0 1px, transparent 1.7px),
    radial-gradient(circle at 32% 54%, rgba(102, 56, 143, 0.22), transparent 35%),
    var(--nadle-panel-bg);
}

.nadle-page__leader-stack {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
}

.nadle-page__card-title {
  margin: 0 0 var(--sa-space-2);
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--sa-color-text-main);
}

.nadle-page__game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 13px;
  flex: 1 1 auto;
  width: 100%;
  max-width: 100%;
  justify-content: center;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  padding: clamp(10px, 1.5vw, 16px);
  container-type: inline-size;
  container-name: nadle-game;
}

.nadle-page__guess-focus-anchor {
  position: relative;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
}

.checkers-board-shell {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  container-type: size;
}

.checkers-footer {
  flex-shrink: 0;
}

.checkers-room-meta {
  margin: 10px 10px 0;
  padding: var(--sa-space-2) var(--sa-space-3);
  border-radius: 15.535px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(102, 56, 143, 0.11);
  color: var(--sa-color-text-main);
  font-family: "Marmelad", var(--sa-font-main);
  font-size: 0.78rem;
}

.checkers-mode-icons {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
  margin-bottom: var(--sa-space-2);
}

.checkers-find-match {
  width: 100%;
  min-height: 1.95rem;
  margin: 0 0 var(--sa-space-2);
  border: 1px solid rgba(216, 180, 254, 0.36);
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(126, 34, 206, 0.82), rgba(168, 85, 247, 0.58));
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  letter-spacing: 0.01em;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 0 16px rgba(168, 85, 247, 0.24);
  transition:
    transform 0.15s ease,
    opacity 0.15s ease,
    box-shadow 0.15s ease;
}

.checkers-find-match:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 0 22px rgba(168, 85, 247, 0.36);
}

.checkers-find-match:disabled {
  cursor: wait;
  opacity: 0.7;
}

.checkers-room-meta__error {
  display: block;
  margin: 0 0 var(--sa-space-2);
  color: #fecdd3;
  font-size: 0.72rem;
  line-height: 1.25;
}

.checkers-mode-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.9rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: rgba(102, 56, 143, 0.47);
  color: #fff;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.checkers-mode-icon:hover {
  transform: translateY(-1px) scale(1.03);
  background: rgba(146, 82, 206, 0.78);
  box-shadow: 0 0 16px rgba(146, 82, 206, 0.24);
}

.checkers-mode-icon:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
}

.checkers-mode-icon--active {
  transform: scale(1.05);
  border-color: rgba(255, 255, 255, 0.38);
  background: rgba(146, 82, 206, 0.86);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 0 18px rgba(168, 85, 247, 0.38);
}

.checkers-mode-icon svg {
  width: 1.05rem;
  height: 1.05rem;
  fill: currentColor;
}

.checkers-room-meta p {
  display: flex;
  justify-content: space-between;
  gap: var(--sa-space-2);
  margin: 0;
}

.checkers-room-meta p + p {
  margin-top: 0.35rem;
}

.checkers-room-meta span {
  color: var(--sa-color-text-body);
}

.checkers-room-meta__turn {
  color: #ffffff;
  text-shadow: 0 0 12px rgba(255, 255, 255, 0.32);
}

.checkers-start-game-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  background: rgba(0, 0, 0, 0.28);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
}

.checkers-start-game-button {
  min-height: 3rem;
  padding: 0 var(--sa-space-5);
  border: 1px solid rgba(216, 180, 254, 0.58);
  border-radius: 999px;
  background: rgba(126, 34, 206, 0.9);
  color: #fff;
  cursor: pointer;
  font-family: "Marmelad", var(--sa-font-main);
  font-size: 1rem;
  font-weight: 800;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 0 24px rgba(168, 85, 247, 0.38);
}

.checkers-start-game-button:hover,
.checkers-start-game-button:focus-visible {
  border-color: rgba(255, 255, 255, 0.7);
  background: rgba(146, 82, 206, 0.94);
}

.checkers-start-game-enter-active,
.checkers-start-game-leave-active {
  transition: opacity 0.18s ease-out;
}

.checkers-start-game-enter-from,
.checkers-start-game-leave-to {
  opacity: 0;
}

.checkers-auto-rematch {
  color: rgba(245, 243, 255, 0.8);
  font-family: "Marmelad", var(--sa-font-main);
  font-size: 0.9rem;
}

.checkers-auto-rematch strong {
  display: inline-block;
  color: #fff;
  animation: checkers-count-pop 0.28s ease-out both;
}

@keyframes checkers-count-pop {
  from {
    opacity: 0;
    transform: translateY(0.25rem) scale(0.82);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.checkers-rating-delta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.1rem;
  padding: 0 var(--sa-space-3);
  border-radius: 999px;
  background: rgba(22, 163, 74, 0.18);
  color: #86efac;
  font-family: "Marmelad", var(--sa-font-main);
  font-size: 1.2rem;
  font-weight: 800;
  animation: checkers-rating-delta-pop 0.6s ease-out both;
}

.checkers-rating-delta--down {
  background: rgba(220, 38, 38, 0.18);
  color: #fca5a5;
}

@keyframes checkers-rating-delta-pop {
  0% {
    opacity: 0;
    transform: translateY(0.45rem) scale(0.78);
  }
  45% {
    opacity: 1;
    transform: translateY(-0.15rem) scale(1.08);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.checkers-side-panel {
  padding: var(--sa-space-4);
}

.checkers-side-panel__empty {
  margin: 0;
  padding: var(--sa-space-3);
  border-radius: var(--sa-radius-md);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-bg-card) 88%, transparent);
  color: var(--sa-color-text-body);
  font-size: 0.85rem;
}

.checkers-controls {
  width: 100%;
  max-width: 640px;
  margin-inline: auto;
  display: grid;
  gap: var(--sa-space-2);
}

.checkers-controls__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sa-space-2);
}

.checkers-voice-audio {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.checkers-audio-controls {
  position: fixed;
  left: calc(50% + 4.45rem);
  bottom: clamp(3.35rem, 6vh, 4.5rem);
  z-index: 12031;
  transform: translateX(-50%);
}

.checkers-headphones-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.65rem;
  height: 3.65rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(44, 39, 55, 0.88);
  color: rgba(226, 232, 240, 0.9);
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 12px 34px rgba(0, 0, 0, 0.32);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.checkers-headphones-button--active {
  border-color: rgba(216, 180, 254, 0.58);
  background: rgba(88, 28, 135, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 0 24px rgba(168, 85, 247, 0.38);
}

.checkers-headphones-button--muted {
  border-color: rgba(148, 163, 184, 0.26);
  background: rgba(39, 39, 42, 0.9);
  color: rgba(226, 232, 240, 0.68);
}

.checkers-headphones-button svg {
  width: 1.55rem;
  height: 1.55rem;
  fill: currentColor;
}

.checkers-audio-popover {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.65rem);
  width: min(16rem, 82vw);
  padding: var(--sa-space-3);
  border: 1px solid rgba(216, 180, 254, 0.32);
  border-radius: 16px;
  background: rgba(18, 8, 34, 0.94);
  color: #fff;
  transform: translateX(-50%);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.4);
}

.checkers-audio-popover__label {
  display: flex;
  justify-content: space-between;
  gap: var(--sa-space-2);
  font-size: 0.78rem;
}

.checkers-audio-popover__range {
  width: 100%;
  margin: var(--sa-space-2) 0;
  accent-color: #a855f7;
}

.checkers-audio-popover__mute {
  width: 100%;
  min-height: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
}

.checkers-mic-button {
  position: fixed;
  left: 50%;
  bottom: clamp(3.35rem, 6vh, 4.5rem);
  z-index: 12030;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.65rem;
  height: 3.65rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(44, 39, 55, 0.88);
  color: rgba(226, 232, 240, 0.88);
  cursor: pointer;
  transform: translateX(-50%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 12px 34px rgba(0, 0, 0, 0.36);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.checkers-mic-button::before,
.checkers-mic-button::after {
  position: absolute;
  inset: -0.35rem;
  z-index: -1;
  border: 1px solid rgba(216, 180, 254, 0.52);
  border-radius: inherit;
  opacity: 0;
  content: '';
  pointer-events: none;
}

.checkers-mic-button:hover:not(:disabled) {
  transform: translateX(-50%) translateY(-1px) scale(1.03);
}

.checkers-mic-button:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.checkers-mic-button--active {
  border-color: rgba(216, 180, 254, 0.64);
  background: rgba(126, 34, 206, 0.86);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 0 0 1px rgba(192, 132, 252, 0.22),
    0 0 30px rgba(168, 85, 247, 0.55);
}

.checkers-mic-button--speaking::before {
  animation: checkers-mic-speaking-ring 1.15s ease-out infinite;
}

.checkers-mic-button--speaking::after {
  animation: checkers-mic-speaking-ring 1.15s ease-out 0.35s infinite;
}

.checkers-mic-button--speaking svg {
  animation: checkers-mic-speaking-icon 0.7s ease-in-out infinite;
}

@keyframes checkers-mic-speaking-ring {
  0% {
    opacity: 0.58;
    transform: scale(0.82);
  }
  100% {
    opacity: 0;
    transform: scale(1.35);
  }
}

@keyframes checkers-mic-speaking-icon {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

.checkers-mic-button--muted {
  border-color: rgba(148, 163, 184, 0.22);
  background: rgba(39, 39, 42, 0.82);
}

.checkers-mic-button svg {
  width: 1.55rem;
  height: 1.55rem;
  fill: currentColor;
}

.checkers-your-turn {
  position: fixed;
  left: 50%;
  bottom: calc(clamp(3.35rem, 6vh, 4.5rem) + 4.2rem);
  z-index: 12020;
  pointer-events: none;
  transform: translateX(-50%);
  padding: 0.75rem 1.35rem;
  border: 1px solid rgba(192, 132, 252, 0.45);
  border-radius: 999px;
  background: rgba(14, 8, 24, 0.72);
  color: #fff;
  font-family: "Marmelad", var(--sa-font-main);
  font-size: clamp(1rem, 2vw, 1.25rem);
  font-weight: 700;
  box-shadow:
    0 0 0 1px rgba(168, 85, 247, 0.14),
    0 0 28px rgba(168, 85, 247, 0.38);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.checkers-your-turn-enter-active,
.checkers-your-turn-leave-active {
  transition:
    opacity 0.24s ease,
    transform 0.24s ease;
}

.checkers-your-turn-enter-from,
.checkers-your-turn-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(0.65rem) scale(0.92);
}

.checkers-matchmaking-overlay {
  position: fixed;
  inset: 0;
  z-index: 12040;
  display: grid;
  place-items: center;
  padding: var(--sa-space-4);
  background:
    radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.28), transparent 34%),
    rgba(8, 4, 18, 0.46);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

.checkers-matchmaking-overlay--matched {
  background:
    radial-gradient(circle at 50% 50%, rgba(216, 180, 254, 0.36), transparent 38%),
    rgba(8, 4, 18, 0.34);
}

.checkers-matchmaking-card {
  min-width: min(22rem, 92vw);
  padding: var(--sa-space-5);
  border: 1px solid rgba(216, 180, 254, 0.42);
  border-radius: 24px;
  background: rgba(22, 9, 38, 0.88);
  color: #fff;
  text-align: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 0 42px rgba(168, 85, 247, 0.34),
    0 20px 60px rgba(0, 0, 0, 0.44);
}

.checkers-matchmaking-title {
  margin: 0;
  font-family: "Climate Crisis", var(--sa-font-display);
  font-size: clamp(1.1rem, 3vw, 1.7rem);
}

.checkers-matchmaking-hint {
  margin: var(--sa-space-2) 0 0;
  color: rgba(245, 243, 255, 0.76);
  font-size: 0.85rem;
}

.checkers-matchmaking-dots span {
  animation: checkers-matchmaking-dot 1s infinite both;
}

.checkers-matchmaking-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.checkers-matchmaking-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes checkers-matchmaking-dot {
  0%,
  80%,
  100% {
    opacity: 0.25;
  }
  40% {
    opacity: 1;
  }
}

.checkers-matchmaking-cancel {
  margin-top: var(--sa-space-4);
  min-height: 2.3rem;
  min-width: 8rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.checkers-matchmaking-enter-active,
.checkers-matchmaking-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.checkers-matchmaking-enter-from,
.checkers-matchmaking-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.checkers-mode-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 12041;
  display: grid;
  place-items: center;
  padding: var(--sa-space-4);
  background: rgba(8, 4, 18, 0.54);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

.checkers-mode-confirm-card {
  width: min(24rem, 92vw);
  padding: var(--sa-space-5);
  border: 1px solid rgba(216, 180, 254, 0.42);
  border-radius: 24px;
  background: rgba(22, 9, 38, 0.92);
  color: #fff;
  text-align: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 20px 60px rgba(0, 0, 0, 0.44);
}

.checkers-mode-confirm-title {
  margin: 0;
  font-family: "Climate Crisis", var(--sa-font-display);
  font-size: clamp(1.05rem, 3vw, 1.55rem);
}

.checkers-mode-confirm-copy {
  margin: var(--sa-space-3) 0 0;
  color: rgba(245, 243, 255, 0.78);
  font-size: 0.9rem;
}

.checkers-mode-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sa-space-2);
  margin-top: var(--sa-space-4);
}

.checkers-mode-confirm-button {
  min-height: 2.35rem;
  min-width: 8rem;
  padding: 0 var(--sa-space-4);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.checkers-mode-confirm-button--danger {
  border-color: rgba(216, 180, 254, 0.58);
  background: rgba(126, 34, 206, 0.9);
}

.checkers-mode-confirm-enter-active,
.checkers-mode-confirm-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.checkers-mode-confirm-enter-from,
.checkers-mode-confirm-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.checkers-controls__meta {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sa-space-2);
  color: var(--sa-color-text-body);
  font-size: 0.78rem;
}

@media (min-width: 1201px) {
  .page-route {
    height: 100%;
    max-height: 100%;
    overflow: hidden;
    flex: 1 1 auto;
    min-height: 0;
  }

  .nadle-page {
    padding-block: 18px 18px;
    padding-inline: clamp(6px, 0.75vw, 12px);
    max-width: min(1577px, 100%);
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  .nadle-page__grid {
    align-items: stretch;
    justify-content: center;
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    max-height: 100%;
    grid-template-columns:
      minmax(278px, 336px)
      minmax(0, 845px)
      minmax(278px, 336px);
    gap: 13px;
  }

  .nadle-page__grid :deep(.nadle-page__stack--leader),
  .nadle-page__grid :deep(.nadle-page__stack--chat) {
    flex: 0 0 auto;
    width: 100%;
    max-width: 336px;
  }

  .nadle-page__grid :deep(.nadle-page__stack) {
    min-height: 0;
    height: 100%;
  }

  .nadle-page__grid :deep(.nadle-page__stack--game) {
    max-width: 100%;
    overflow: visible;
    min-height: 0;
  }

  .nadle-page__grid :deep(.nadle-page__stack--game > .nadle-page__game) {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    justify-content: center;
    padding: clamp(8px, 1vw, 14px);
  }

  .nadle-page__grid :deep(.nadle-page__stack--chat) {
    min-height: 0;
    height: 100%;
  }
}

@media (max-width: 1200px) {
  .page-route {
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .nadle-page {
    flex: 0 1 auto;
    min-height: auto;
    height: auto;
    max-height: none;
    overflow-x: clip;
    overflow-y: visible;
    padding-block: var(--sa-space-2) var(--sa-space-4);
    padding-inline: clamp(0.65rem, 2.8vw, var(--sa-space-3));
    max-width: min(68rem, 100%);
  }

  .nadle-page__grid {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
    gap: 16px;
  }

  .nadle-page__grid > .nadle-page__stack {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
    max-height: none;
    width: 100%;
    max-width: 100%;
    overflow-x: clip;
    overflow-y: visible;
  }

  .nadle-page__grid > .nadle-page__stack--leader {
    order: 1;
  }

  .nadle-page__grid > .nadle-page__stack--game {
    order: 2;
  }

  .nadle-page__grid > .nadle-page__stack--chat {
    order: 4;
  }

  .nadle-page__game {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
    justify-content: flex-start;
    max-width: 100%;
    overflow: visible;
    padding: clamp(12px, 3vw, 18px) clamp(10px, 4vw, 48px) clamp(12px, 3vw, 16px);
  }

  .nadle-page__guess-focus-anchor {
    flex: 0 0 auto;
  }

  .checkers-board-shell {
    height: auto;
    container-type: inline-size;
  }
}
</style>

