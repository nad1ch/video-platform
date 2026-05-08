<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { playAllPageAudio, useCallOrchestrator, type CallEngineRole } from 'call-core'
import { useAuth } from '@/composables/useAuth'
import { useLocalTileSpeakingVisual } from '@/composables/useLocalTileSpeakingVisual'
import { apiFetch, readJsonIfOk } from '@/utils/apiFetch'
import { readStorageJson, writeStorageJson } from '@/utils/storageJson.js'
import '@/components/call/CallPage.css'
import { generateCallRoomCode } from '@/utils/callRoomUi'
import NadleGlobalLeaderboardTable, {
  type NadleGlobalLbTab,
  type NadleGlobalLeaderboardRowVm,
} from '@/components/nadle/NadleGlobalLeaderboardTable.vue'
import {
  fetchLeaderboardRating,
  fetchLeaderboardStreak,
  fetchLeaderboardWins,
  type NadleGlobalRatingRow,
  type NadleGlobalStreakRow,
  type NadleGlobalWinsRow,
} from '@/nadle/nadleApi'
import StreamAudio from '@/components/StreamAudio.vue'
import TwitchRelayChatPanel from '@/components/twitch/TwitchRelayChatPanel.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppContainer from '@/components/ui/AppContainer.vue'
import '@/components/ui/gameTriptychLayout.css'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'
import { useNadleStatusBanners } from '@/composables/useNadleStatusBanners'
import { useNadleStreamerRoom } from '@/composables/useNadleStreamerRoom'
import { type Feedback } from '@/nadle/nadleLogic'
import { useNadleWs } from '@/nadle/ws'
import { createLogger } from '@/utils/logger'
import { getLegalMoves, getValidMove } from '../core/checkersEngine'
import type { CheckersPlayer, CheckersPosition } from '../core/types'
import {
  addCheckersFriendSlug,
  checkersFriendSlugSet,
  removeCheckersFriendSlug,
} from '../checkersFriendRoomSlugs'
import { useCheckersOrchestrator } from '../orchestrator/useCheckersOrchestrator'
import { readCheckersClientId, type CheckersBotDifficulty, type CheckersMode } from '../ws/checkersWs'
import CheckersBoard from '../ui/CheckersBoard.vue'
import CheckersEndGameOverlay from '../ui/CheckersEndGameOverlay.vue'
import { useI18n } from 'vue-i18n'
type CheckersUiMode = CheckersMode | 'rated'
type CheckersPlayerLabels = Record<CheckersPlayer, string>
const CHECKERS_GUEST_IDENTITY_KEY = 'checkers:guest-identity:v1'
const CHECKERS_LOCAL_NAMES_KEY = 'checkers:local-names:v1'

const CHECKERS_SIGNED_DISPLAY_BY_USER_KEY = 'checkers:signed-display-by-user:v1'

const CHECKERS_DEFAULT_MODE_QUERY_KEY = 'defaultMode'
const CHECKERS_DEFAULT_MODE_RATED_Q = 'rated'

const route = useRoute()
const router = useRouter()
const { locale, t } = useI18n()
const auth = useAuth()

const checkersNadleChatLog = createLogger('checkers-nadle-chat')

function normalizeTwitchLogin(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') {
    return null
  }
  const s = raw.trim().replace(/^#/, '').toLowerCase()
  if (s.length < 2 || s.length > 25) {
    return null
  }
  if (!/^[a-z0-9_]+$/.test(s)) {
    return null
  }
  return s
}


const effectiveCheckersRelaySlug = computed((): string | null => {
  const u = auth.user.value
  const fromAccount =
    u && typeof u.nadleStreamerName === 'string' ? normalizeTwitchLogin(u.nadleStreamerName) : null
  if (fromAccount) {
    return fromAccount
  }
  const q = route.query.streamer
  if (typeof q === 'string') {
    const fromQuery = normalizeTwitchLogin(q)
    if (fromQuery) {
      return fromQuery
    }
  }
  return STREAMER_NICK
})

const {
  nadlePublicConfig: checkersNadlePublicConfig,
  streamerProfile: checkersRelayStreamerProfile,
  streamerLoadError: checkersRelayStreamerLoadError,
  effectiveTwitchChannel: checkersEffectiveTwitchChannel,
  loadStreamerCard: loadCheckersRelayStreamerCard,
  fetchNadlePublicConfig: fetchCheckersRelayPublicConfig,
} = useNadleStreamerRoom({
  effectiveNadleSlug: effectiveCheckersRelaySlug,
  demoFallbackChannel: STREAMER_NICK,
})

const nadleChatLastError = ref<string | null>(null)
const checkersNadleChatPeerId =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `checkers-chat-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`

const chatPanelRef = ref<InstanceType<typeof TwitchRelayChatPanel> | null>(null)

const {
  chatLines: checkersNadleChatLines,
  wsStatus: checkersNadleWsStatus,
  ircRelayStatus: checkersNadleIrcRelayStatus,
  prepareNadleWsMount: prepareCheckersNadleChatWs,
  disposeNadleWs: disposeCheckersNadleChatWs,
} = useNadleWs({
  streamerProfile: checkersRelayStreamerProfile,
  lastError: nadleChatLastError,
  nadleTabPeerId: checkersNadleChatPeerId,
  log: checkersNadleChatLog,
  onNewGame: () => {},
  afterChatLineAppended: () => {
    void nextTick(() => chatPanelRef.value?.scrollToBottom())
  },
  isAuthenticated: computed(() => auth.isAuthenticated.value),
})

const { wsStatusLabel: checkersRelayWsStatusLabel, ircRelayBanner: checkersRelayIrcBanner } = useNadleStatusBanners({
  streamerLoadError: checkersRelayStreamerLoadError,
  lastError: nadleChatLastError,
  wsStatus: checkersNadleWsStatus,
  ircRelayStatus: checkersNadleIrcRelayStatus,
})

const checkersTwitchWatchUrl = computed(
  () => `https://www.twitch.tv/${encodeURIComponent(checkersEffectiveTwitchChannel.value)}`,
)

function formatCheckersChatCooldownHint(ms: number): string {
  const s = ms / 1000
  const label = Number.isInteger(s) ? String(s) : s.toFixed(1)
  return t('nadleUi.cooldownHint', { seconds: label })
}

function checkersChatFeedbackToEmojis(fb: Feedback[]): string {
  return fb.map((f) => (f === 'correct' ? '🟩' : f === 'present' ? '🟨' : '⬛')).join(' ')
}

let checkersRelayStreamerLoadSeq = 0
watch(
  () => effectiveCheckersRelaySlug.value,
  async () => {
    const seq = ++checkersRelayStreamerLoadSeq
    await loadCheckersRelayStreamerCard()
    if (seq !== checkersRelayStreamerLoadSeq) {
      return
    }
    void fetchCheckersRelayPublicConfig()
  },
  { immediate: true },
)

watch(
  checkersNadleChatLines,
  () => {
    void nextTick(() => chatPanelRef.value?.scrollToBottom())
  },
  { deep: true },
)

const roomId = computed(() => {
  const raw = route.params.roomId
  const value = Array.isArray(raw) ? raw[0] : raw
  return String(value ?? '').trim()
})

const botDifficulty = ref<CheckersBotDifficulty>('medium')
const leaderboardTab = ref<NadleGlobalLbTab>('wins')
const leaderboardWins = ref<Record<string, number>>(readCheckersLeaderboard())
const CHECKERS_LB_Q = '?game=checkers'
const checkersLbWinsRows = ref<NadleGlobalWinsRow[]>([])
const checkersLbStreakRows = ref<NadleGlobalStreakRow[]>([])
const checkersLbRatingRows = ref<NadleGlobalRatingRow[]>([])

const checkersLbViewerMaxStreak = ref<number | undefined>(undefined)
const checkersLbLoading = ref(false)
const checkersLbError = ref<string | null>(null)
const recordedWinnerRevision = ref<number | null>(null)
const copiedInvite = ref(false)
const roomCopyFlash = ref(false)
const displayNameDraft = ref(readGuestDisplayName())
const localPlayerDrafts = ref(readLocalPlayerNames())
const selectedUiMode = ref<CheckersUiMode>('bot')
/** After the player changes mode in the UI, do not snap tabs to stale server `mode` before `setMode` ACK. */
const userChoseCheckersUiMode = ref(false)
const remoteAudioUnlocked = ref(false)
const remoteListenVolume = ref(1)
const remoteListenMuted = ref(false)
const audioControlsOpen = ref(false)
const audioControlsRoot = ref<HTMLElement | null>(null)

const checkersGameStackRef = ref<InstanceType<typeof AppCard> | null>(null)

const checkersGameContentRef = ref<HTMLElement | null>(null)
let voiceDockAnchorFrame = 0
let voiceDockResizeObserver: ResizeObserver | null = null

const voiceDockCenterXPx = ref<number | undefined>(undefined)

function resolveCheckersGameStackEl(): HTMLElement | null {
  const inst = checkersGameStackRef.value as unknown as { $el?: unknown }
  const el = inst?.$el
  return el instanceof HTMLElement ? el : null
}

function resolveVoiceDockAnchorEl(): HTMLElement | null {
  const stack = resolveCheckersGameStackEl()
  if (stack) return stack
  const inner = checkersGameContentRef.value
  return inner instanceof HTMLElement ? inner : null
}

function applyVoiceDockCenterX(): void {
  voiceDockAnchorFrame = 0
  const el = resolveVoiceDockAnchorEl()
  if (!el) {
    voiceDockCenterXPx.value = undefined
    return
  }
  const rect = el.getBoundingClientRect()
  voiceDockCenterXPx.value = Math.round(rect.left + rect.width / 2)
}

function scheduleVoiceDockAnchorUpdate(): void {
  if (typeof window === 'undefined') return
  if (voiceDockAnchorFrame !== 0) return
  voiceDockAnchorFrame = window.requestAnimationFrame(applyVoiceDockCenterX)
}

function teardownVoiceDockAnchor(): void {
  if (typeof window !== 'undefined' && voiceDockAnchorFrame !== 0) {
    window.cancelAnimationFrame(voiceDockAnchorFrame)
    voiceDockAnchorFrame = 0
  }
  voiceDockResizeObserver?.disconnect()
  voiceDockResizeObserver = null
}

const voiceDockInlineStyle = computed(() => {
  const x = voiceDockCenterXPx.value
  if (typeof x !== 'number' || Number.isNaN(x)) {
    return { left: '50%', transform: 'translateX(-50%)' } as const
  }
  return { left: `${x}px`, transform: 'translateX(-50%)' } as const
})
const hasStartedCurrentGame = ref(false)
const pendingModeChange = ref<CheckersUiMode | null>(null)
const rematchCountdown = ref(5)
const ratingDelta = ref<number | null>(null)
type MatchmakingState = 'idle' | 'searching' | 'matched'
const matchmakingState = ref<MatchmakingState>('idle')
const matchmakingError = ref('')
const matchmakingSeconds = ref(0)
const TURN_SECONDS = 60

const TURN_TIMER_WARN_BELOW_SEC = 10
const turnSecondsLeft = ref(TURN_SECONDS)
const showYourTurn = ref(false)
let turnTimer: ReturnType<typeof setInterval> | null = null
let yourTurnTimer: ReturnType<typeof setTimeout> | null = null
let matchmakingAbort: AbortController | null = null
let matchmakingTimer: ReturnType<typeof setInterval> | null = null
let matchRedirectTimer: ReturnType<typeof setTimeout> | null = null
let rematchCountdownTimer: ReturnType<typeof setInterval> | null = null
let matchFoundFeedbackPlayed = false
let expectFriendRestartAfterRoute = false
let checkersRoomHandshakeGen = 0
const authDisplayName = computed(() => cleanDisplayName(auth.user.value?.displayName))
const guestDisplayName = computed(() => cleanDisplayName(displayNameDraft.value))
const effectiveDisplayName = computed(() => {
  if (auth.user.value) {
    const draft = guestDisplayName.value
    return draft || authDisplayName.value
  }
  return guestDisplayName.value
})
const needsGuestNickname = computed(() => auth.loaded.value && !auth.user.value && !guestDisplayName.value)
const canJoinCheckersRoom = computed(() => !auth.loaded.value || Boolean(effectiveDisplayName.value))
const checkers = useCheckersOrchestrator({
  roomId,
  botDifficulty,
  displayName: effectiveDisplayName,
  canJoin: canJoinCheckersRoom,
})
const isUkLocale = computed(() => String(locale.value || '').toLowerCase().startsWith('uk'))

const checkersUi = computed(() => {
  const uk = isUkLocale.value
  return {
    modeFriend: uk ? 'Гра з другом' : 'Play with friend',
    modeBot: uk ? 'Гра проти бота' : 'Play against bot',
    modeLocal: uk ? 'Гра на одному пристрої' : 'Same device',
    modeRated: uk ? 'Рейтинговий матч' : 'Rated match',
    ratedCta: uk ? '🏆 Рейтингові матчі' : '🏆 Rated Matches',
    metaTurn: uk ? 'Хід' : 'Turn',
    metaTimer: uk ? 'Таймер' : 'Timer',
    pieceWhite: uk ? 'Білі' : 'White',
    pieceBlack: uk ? 'Чорні' : 'Black',
    opponent: uk ? 'Суперник' : 'Opponent',
    botName: uk ? 'Бот' : 'Bot',
    guest: uk ? 'Гість' : 'Guest',
    spectator: uk ? 'Глядач' : 'Spectator',
    lbColPlayer: uk ? 'Гравець' : 'Player',
    lbYou: uk ? 'Ти' : 'You',
    overlayGuestTitle: uk ? 'Твій нікнейм' : 'Your nickname',
    overlayGuestCopy: uk
      ? 'Введи нікнейм, щоб приєднатись до кімнати або почати гру.'
      : 'Enter a nickname to join the room or start a game.',
    overlayMatched: uk ? 'Суперник знайдений. Переходимо до кімнати.' : 'Match found. Joining the room.',
    overlaySearching: uk
      ? 'Шукаємо суперника з близьким рейтингом. Час пошуку:'
      : 'Looking for an opponent with a similar rating. Time searching:',
    overlayRatedCopy: uk
      ? 'Пошук суперника впливає на рейтинг, перемоги, серії та статистику.'
      : 'Searching for an opponent affects your rating, wins, streaks, and statistics.',
    overlayFriendCopy: uk
      ? 'Поділись посиланням або кодом кімнати. Гра почнеться, коли обидва гравці натиснуть «Готовий».'
      : 'Share the link or room code. The game starts when both players press Ready.',
    overlayLocalCopy: uk
      ? 'Введіть ніки гравців. Хід показується за цими іменами.'
      : 'Enter each player’s nickname. Turns use these names.',
    overlayBotCopy: uk
      ? 'Швидка партія проти бота без посилання на кімнату та кроку готовності.'
      : 'Quick game against the bot — no room link or ready step.',
    roomCodeLabel: uk ? 'Код кімнати:' : 'Room code:',
    roomCodeField: uk ? 'Код кімнати' : 'Room code',
    linkLabel: uk ? 'Посилання:' : 'Link:',
    copyLink: uk ? 'Скопіювати посилання' : 'Copy link',
    copiedLink: uk ? 'Скопійовано' : 'Copied',
    readyOn: uk ? 'готовий' : 'ready',
    readyOff: uk ? 'очікує' : 'waiting',
    nicknameField: uk ? 'Нікнейм' : 'Nickname',
    localNickPlaceholder: uk ? 'Нікнейм' : 'Nickname',
    cancelSearch: uk ? 'Скасувати' : 'Cancel',
    applyFriendRoom: uk ? 'Перейти в цю кімнату' : 'Go to this room',
    modeConfirmTitle: uk ? 'Змінити режим гри?' : 'Change game mode?',
    modeConfirmStay: uk ? 'Залишитись' : 'Stay',
    modeConfirmChange: uk ? 'Змінити режим' : 'Switch mode',
    yourTurnBanner: uk ? 'Твій хід' : 'Your turn',
    rematchIn: uk ? 'Реванш через' : 'Rematch in',
    micSpectator: uk ? 'Глядачі лише слухають' : 'Spectators can only listen',
    micMute: uk ? 'Вимкнути мікрофон' : 'Mute microphone',
    micOn: uk ? 'Увімкнути мікрофон' : 'Turn microphone on',
    searchingSecondsSuffix: uk ? 'с.' : 's.',
  }
})

const friendRoomReady = computed(() => {
  if (checkers.isRatedMatch.value) return true
  if (checkers.mode.value !== 'friend') {
    
    if (selectedUiMode.value === 'friend') return false
    return true
  }
  const players = checkers.players.value
  return players.player1?.ready === true && players.player2?.ready === true
})
const myReady = computed(() => {
  if (checkers.myRole.value !== 'player1' && checkers.myRole.value !== 'player2') return false
  return checkers.players.value[checkers.myRole.value]?.ready === true
})
const whiteSeatReady = computed(() => checkers.players.value.player1?.ready === true)
const blackSeatReady = computed(() => checkers.players.value.player2?.ready === true)
const localWhiteName = computed(() => cleanDisplayName(localPlayerDrafts.value.white))
const localBlackName = computed(() => cleanDisplayName(localPlayerDrafts.value.black))
const hasLocalPlayerNames = computed(() => Boolean(localWhiteName.value && localBlackName.value))
const playerLabels = computed<CheckersPlayerLabels>(() => {
  const ui = checkersUi.value
  if (selectedUiMode.value === 'local' || checkers.mode.value === 'local') {
    return {
      player1: localWhiteName.value || '⚪',
      player2: localBlackName.value || '⚫',
    }
  }
  const players = checkers.players.value
  return {
    player1:
      cleanDisplayName(players.player1?.displayName) ||
      (checkers.myRole.value === 'player1' ? effectiveDisplayName.value : '') ||
      ui.pieceWhite,
    player2:
      cleanDisplayName(players.player2?.displayName) ||
      (checkers.mode.value === 'bot' ? ui.botName : '') ||
      (checkers.myRole.value === 'player2' ? effectiveDisplayName.value : '') ||
      ui.opponent,
  }
})
const roleLabel = computed(() => {
  const ui = checkersUi.value
  if (needsGuestNickname.value) return isUkLocale.value ? 'Введи нікнейм' : 'Enter a nickname'
  if (selectedUiMode.value === 'rated' && matchmakingState.value === 'idle') {
    return effectiveDisplayName.value || ui.guest
  }
  if (checkers.mode.value === 'local') return `${playerLabels.value.player1} / ${playerLabels.value.player2}`
  if (checkers.myRole.value === 'player1') return playerOneLabel.value
  if (checkers.myRole.value === 'player2') return playerTwoLabel.value
  return ui.spectator
})
const playerOneLabel = computed(() => playerLabels.value.player1)
const playerTwoLabel = computed(() => playerLabels.value.player2)
const turnLabel = computed(() => {
  const turn = checkers.displayState.value.turn
  return playerLabels.value[turn]
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
const isEndGameOverlayVisible = computed(() => Boolean(checkers.displayState.value.winner))
const isFriendInviteVisible = computed(() => {
  if (selectedUiMode.value !== 'friend' || checkers.isRatedMatch.value) return false
  if (friendRoomReady.value) return false
  if (!checkers.serverModeSynced.value) return true
  
  return checkers.mode.value === 'friend' || checkers.mode.value === 'bot'
})
const isStartOverlayVisible = computed(() =>
  !checkers.displayState.value.winner &&
    (
      matchmakingState.value !== 'idle' ||
      needsGuestNickname.value ||
      (selectedUiMode.value === 'rated' &&
        !checkers.isRatedMatch.value &&
        !hasStartedCurrentGame.value) ||
      (selectedUiMode.value === 'friend' && isFriendInviteVisible.value) ||
      (!hasStartedCurrentGame.value && (selectedUiMode.value === 'bot' || selectedUiMode.value === 'local'))
    ),
)
const startGameButtonLabel = computed(() => {
  const uk = isUkLocale.value
  if (needsGuestNickname.value) return uk ? 'Зберегти нікнейм' : 'Save nickname'
  if (selectedUiMode.value === 'rated') return uk ? 'Почати пошук' : 'Start search'
  if (selectedUiMode.value === 'friend') {
    return myReady.value ? (uk ? 'Скасувати готовність' : 'Undo ready') : uk ? 'Готовий' : 'Ready'
  }
  if (selectedUiMode.value === 'local') return uk ? 'Почати локальну гру' : 'Start local game'
  return uk ? 'Почати гру' : 'Start game'
})
const isActiveGame = computed(() => Boolean(hasStartedCurrentGame.value && !checkers.displayState.value.winner))
const isTurnTimerLow = computed(
  () =>
    isActiveGame.value &&
    turnSecondsLeft.value > 0 &&
    turnSecondsLeft.value <= TURN_TIMER_WARN_BELOW_SEC,
)
const pendingModeLabel = computed(() => {
  const uk = isUkLocale.value
  if (pendingModeChange.value === 'bot') return uk ? 'гру проти бота' : 'bot mode'
  if (pendingModeChange.value === 'friend') return uk ? 'гру з другом' : 'friend mode'
  if (pendingModeChange.value === 'local') return uk ? 'гру на одному пристрої' : 'same-device mode'
  if (pendingModeChange.value === 'rated') return uk ? 'рейтинговий матч' : 'rated match'
  return uk ? 'інший режим' : 'another mode'
})
const modeConfirmFullCopy = computed(() => {
  const uk = isUkLocale.value
  const target = pendingModeLabel.value
  if (uk) {
    return `Поточна партія буде скинута. Після переходу на ${target} білі знову ходитимуть першими.`
  }
  return `The current game will reset. After switching to ${target}, white moves first again.`
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
  const name = effectiveDisplayName.value
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
  const ui = checkersUi.value
  if (isCheckersSpectator.value) return ui.micSpectator
  return isMicActive.value ? ui.micMute : ui.micOn
})
const shouldShowAutoRematchCountdown = computed(() =>
  Boolean(
    checkers.displayState.value.winner &&
    checkers.mode.value === 'friend' &&
    !checkers.isRatedMatch.value &&
    isCheckersPlayer.value &&
    !checkers.rematchRequestedByMe.value,
  ),
)
const winningMove = computed(() => (checkers.displayState.value.winner ? checkers.lastMove.value : null))

function checkersLbIsSelfRow(entry: { userId: string }): boolean {
  const u = auth.user.value
  if (!u) {
    return false
  }
  if (u.dbUserId && entry.userId === u.dbUserId) {
    return true
  }
  if (entry.userId === u.id) {
    return true
  }
  if (u.twitchId && entry.userId === u.twitchId) {
    return true
  }
  return false
}

function checkersLbInitials(name: string): string {
  const s = String(name ?? '').trim()
  if (!s) {
    return '?'
  }
  return s[0]!.toUpperCase()
}

function checkersLbScoreFor(
  row: NadleGlobalWinsRow | NadleGlobalStreakRow | NadleGlobalRatingRow,
  tab: NadleGlobalLbTab,
): number {
  if (tab === 'wins') {
    return (row as NadleGlobalWinsRow).wins
  }
  if (tab === 'streak') {
    return (row as NadleGlobalStreakRow).streak
  }
  return (row as NadleGlobalRatingRow).rating
}

async function loadCheckersLbWins(): Promise<void> {
  checkersLbLoading.value = true
  checkersLbError.value = null
  try {
    checkersLbWinsRows.value = await fetchLeaderboardWins(CHECKERS_LB_Q)
  } catch {
    checkersLbError.value = t('nadleLeaderboard.loadError')
    checkersLbWinsRows.value = []
  } finally {
    checkersLbLoading.value = false
  }
}

async function loadCheckersLbStreak(): Promise<void> {
  checkersLbLoading.value = true
  checkersLbError.value = null
  checkersLbViewerMaxStreak.value = undefined
  try {
    const { entries, viewerMaxStreak } = await fetchLeaderboardStreak(CHECKERS_LB_Q)
    checkersLbStreakRows.value = entries
    checkersLbViewerMaxStreak.value = viewerMaxStreak
  } catch {
    checkersLbError.value = t('nadleLeaderboard.loadError')
    checkersLbStreakRows.value = []
    checkersLbViewerMaxStreak.value = undefined
  } finally {
    checkersLbLoading.value = false
  }
}

async function loadCheckersLbRating(): Promise<void> {
  checkersLbLoading.value = true
  checkersLbError.value = null
  try {
    checkersLbRatingRows.value = await fetchLeaderboardRating(CHECKERS_LB_Q)
  } catch {
    checkersLbError.value = t('nadleLeaderboard.loadError')
    checkersLbRatingRows.value = []
  } finally {
    checkersLbLoading.value = false
  }
}

async function loadCheckersLbActive(): Promise<void> {
  if (leaderboardTab.value === 'wins') {
    await loadCheckersLbWins()
  } else if (leaderboardTab.value === 'streak') {
    await loadCheckersLbStreak()
  } else {
    await loadCheckersLbRating()
  }
}

watch(leaderboardTab, () => {
  void loadCheckersLbActive()
})

const checkersLbDisplayRows = computed(
  (): readonly (NadleGlobalWinsRow | NadleGlobalStreakRow | NadleGlobalRatingRow)[] => {
    if (leaderboardTab.value === 'wins') {
      return checkersLbWinsRows.value
    }
    if (leaderboardTab.value === 'streak') {
      return checkersLbStreakRows.value
    }
    return checkersLbRatingRows.value
  },
)

const checkersLbTableRows = computed((): NadleGlobalLeaderboardRowVm[] => {
  const tab = leaderboardTab.value
  if (tab === 'wins' && checkersLbWinsRows.value.length === 0) {
    return Object.entries(leaderboardWins.value)
      .sort((a, b) => b[1] - a[1])
      .map(([displayName, wins], index) => ({
        rowKey: `local-${displayName}`,
        rank: index + 1,
        displayName,
        avatarUrl: null,
        score: wins,
        isSelf: displayName === effectiveDisplayName.value,
        initials: displayName.slice(0, 1).toUpperCase(),
      }))
  }
  return checkersLbDisplayRows.value.map((row) => ({
    rowKey: `${tab}-${row.userId}-${row.rank}`,
    rank: row.rank,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    score: checkersLbScoreFor(row, tab),
    isSelf: checkersLbIsSelfRow(row),
    initials: checkersLbInitials(row.displayName),
  }))
})

const checkersLbScoreLabel = computed(() => {
  void locale.value
  if (leaderboardTab.value === 'wins') {
    return t('nadleLeaderboard.scoreWins')
  }
  if (leaderboardTab.value === 'streak') {
    return t('nadleLeaderboard.scoreStreak')
  }
  return t('nadleLeaderboard.scoreRatingCheckers')
})

const checkersLbSelfStreakSummary = computed((): string | null => {
  void locale.value
  if (leaderboardTab.value !== 'streak' || !auth.user.value) {
    return null
  }
  const v = checkersLbViewerMaxStreak.value
  if (v === undefined) {
    return null
  }
  return t('nadleLeaderboard.selfBestStreak', { n: v })
})

function cleanDisplayName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 48) : ''
}

function readGuestDisplayName(): string {
  const storage = typeof localStorage !== 'undefined' ? localStorage : null
  const parsed = readStorageJson(storage, CHECKERS_GUEST_IDENTITY_KEY, {}) as { displayName?: unknown }
  return cleanDisplayName(parsed.displayName)
}

function saveGuestDisplayName(displayName: string): void {
  const storage = typeof localStorage !== 'undefined' ? localStorage : null
  writeStorageJson(storage, CHECKERS_GUEST_IDENTITY_KEY, { displayName: cleanDisplayName(displayName) })
}

function readSignedInCheckersDisplay(userId: string): string {
  if (!userId) {
    return ''
  }
  const storage = typeof localStorage !== 'undefined' ? localStorage : null
  const parsed = readStorageJson(storage, CHECKERS_SIGNED_DISPLAY_BY_USER_KEY, {}) as Record<string, unknown>
  return cleanDisplayName(parsed[userId])
}

function saveSignedInCheckersDisplay(userId: string, displayName: string): void {
  if (!userId) {
    return
  }
  const storage = typeof localStorage !== 'undefined' ? localStorage : null
  const parsed = readStorageJson(storage, CHECKERS_SIGNED_DISPLAY_BY_USER_KEY, {}) as Record<string, unknown>
  const next = { ...parsed, [userId]: cleanDisplayName(displayName) }
  writeStorageJson(storage, CHECKERS_SIGNED_DISPLAY_BY_USER_KEY, next)
}

function readLocalPlayerNames(): { white: string; black: string } {
  const storage = typeof localStorage !== 'undefined' ? localStorage : null
  const parsed = readStorageJson(storage, CHECKERS_LOCAL_NAMES_KEY, {}) as { white?: unknown; black?: unknown }
  return {
    white: cleanDisplayName(parsed.white),
    black: cleanDisplayName(parsed.black),
  }
}

function saveLocalPlayerNames(names: { white: string; black: string }): void {
  const storage = typeof localStorage !== 'undefined' ? localStorage : null
  writeStorageJson(storage, CHECKERS_LOCAL_NAMES_KEY, {
    white: cleanDisplayName(names.white),
    black: cleanDisplayName(names.black),
  })
}

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

function stopMatchmakingTimer(): void {
  if (matchmakingTimer) {
    clearInterval(matchmakingTimer)
    matchmakingTimer = null
  }
}

function startMatchmakingTimer(): void {
  stopMatchmakingTimer()
  matchmakingSeconds.value = 0
  matchmakingTimer = setInterval(() => {
    matchmakingSeconds.value += 1
  }, 1000)
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

function shouldAutoRandomizeFriendRoom(rid: string): boolean {
  const t = rid.trim()
  return !t || t === 'lobby'
}

function runCheckersModeReset(mode: CheckersUiMode): void {
  checkers.restartGame()
  if (mode !== 'rated') {
    checkers.setMode(mode)
  }
}

/** After `roomId` changes the WS reconnects; `restart` / `setMode` no-op until the socket is open. */
function scheduleRunCheckersModeReset(mode: CheckersUiMode): void {
  const gen = ++checkersRoomHandshakeGen
  const stopRef: { stop?: () => void } = {}
  stopRef.stop = watch(
    () => checkers.wsStatus.value,
    (status) => {
      if (gen !== checkersRoomHandshakeGen) {
        queueMicrotask(() => stopRef.stop?.())
        return
      }
      if (status !== 'open') {
        return
      }
      queueMicrotask(() => {
        stopRef.stop?.()
        runCheckersModeReset(mode)
      })
    },
    { immediate: true },
  )
}

function consumeCheckersEntryDefaultModeQuery(): void {
  const raw = route.query[CHECKERS_DEFAULT_MODE_QUERY_KEY]
  const val = Array.isArray(raw) ? raw[0] : raw
  if (val !== CHECKERS_DEFAULT_MODE_RATED_Q) {
    return
  }
  selectedUiMode.value = 'rated'
  userChoseCheckersUiMode.value = true
  const roomParam = route.params.roomId
  const roomIdParam = Array.isArray(roomParam) ? roomParam[0] : roomParam
  const nextQuery = { ...route.query }
  delete nextQuery[CHECKERS_DEFAULT_MODE_QUERY_KEY]
  void router.replace({
    name: 'checkers',
    params: { roomId: String(roomIdParam ?? 'lobby') },
    query: nextQuery,
  })
}

watch(
  () => route.query[CHECKERS_DEFAULT_MODE_QUERY_KEY],
  () => {
    consumeCheckersEntryDefaultModeQuery()
  },
  { immediate: true },
)

watch(
  roomId,
  (id) => {
    const slug = (id || '').trim()
    if (!slug || slug === 'lobby') {
      return
    }
    if (checkersFriendSlugSet().has(slug)) {
      selectedUiMode.value = 'friend'
      userChoseCheckersUiMode.value = true
    }
  },
  { immediate: true },
)

watch(roomId, () => {
  hasStartedCurrentGame.value = false
  if (expectFriendRestartAfterRoute) {
    expectFriendRestartAfterRoute = false
    scheduleRunCheckersModeReset('friend')
  }
})

watch([selectedUiMode, roomId], ([ui, rid]) => {
  if (ui !== 'friend' || rid !== 'lobby') {
    return
  }
  if (expectFriendRestartAfterRoute) {
    return
  }
  expectFriendRestartAfterRoute = true
  const next = generateCallRoomCode()
  addCheckersFriendSlug(next)
  void router.replace({ name: 'checkers', params: { roomId: next } })
})

watch(
  () => ({
    rid: roomId.value,
    ws: checkers.wsStatus.value,
    synced: checkers.serverModeSynced.value,
    mode: checkers.mode.value,
    rated: checkers.isRatedMatch.value,
  }),
  ({ rid, ws, synced, mode, rated }) => {
    if (!rid || ws !== 'open' || !synced) {
      return
    }
    if (rated) {
      removeCheckersFriendSlug(rid)
      return
    }
    if (mode === 'friend') {
      return
    }
    if (!checkersFriendSlugSet().has(rid)) {
      return
    }
    checkers.setMode('friend')
  },
)

watch(displayNameDraft, (displayName) => {
  const userId = auth.user.value?.dbUserId
  if (userId) {
    saveSignedInCheckersDisplay(userId, displayName)
    return
  }
  saveGuestDisplayName(displayName)
})

watch(
  () => [auth.loaded.value, auth.user.value?.dbUserId ?? ''] as const,
  ([loaded, userId], prev) => {
    if (!loaded) {
      return
    }
    const prevTuple = prev
    if (prevTuple && loaded === prevTuple[0] && userId === prevTuple[1]) {
      return
    }
    if (userId) {
      const fromProfile = cleanDisplayName(auth.user.value?.displayName)
      displayNameDraft.value = readSignedInCheckersDisplay(userId) || fromProfile
    } else {
      displayNameDraft.value = readGuestDisplayName()
    }
  },
  { immediate: true },
)

watch(localPlayerDrafts, (names) => {
  saveLocalPlayerNames(names)
}, { deep: true })

watch(friendRoomReady, (ready) => {
  if (selectedUiMode.value !== 'friend' || !ready) return
  hasStartedCurrentGame.value = true
  restartTurnTimer()
}, { immediate: true })

watch(
  () => ({
    mode: checkers.mode.value,
    rated: checkers.isRatedMatch.value,
    synced: checkers.serverModeSynced.value,
  }),
  ({ mode, rated, synced }) => {
    if (rated) {
      selectedUiMode.value = 'rated'
      return
    }
    if (selectedUiMode.value === 'rated') {
      return
    }
    if (!synced) {
      return
    }
    if (!userChoseCheckersUiMode.value) {
      selectedUiMode.value = mode
      return
    }
    
    if (
      (selectedUiMode.value === 'friend' && mode !== 'friend') ||
      (selectedUiMode.value === 'local' && mode !== 'local') ||
      (selectedUiMode.value === 'bot' && mode !== 'bot')
    ) {
      return
    }
    selectedUiMode.value = mode
  },
)

watch(
  () => checkers.isRatedMatch.value,
  (rated) => {
    if (rated) {
      hasStartedCurrentGame.value = true
    }
  },
  { immediate: true },
)

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

  if (audioControlsOpen.value && !audioControlsRoot.value?.contains(target)) {
    audioControlsOpen.value = false
  }
}

onMounted(() => {
  if (typeof window === 'undefined') return
  prepareCheckersNadleChatWs()
  void auth.ensureAuthLoaded()
  void loadCheckersLbActive()
  preloadMatchFoundSound()
  void refreshBotDifficulty()
  window.addEventListener('pointerdown', onAudioGesture, { capture: true })
  window.addEventListener('keydown', onAudioGesture, { capture: true })
  document.addEventListener('pointerdown', onDocumentPointerDown, true)

  scheduleVoiceDockAnchorUpdate()
  window.addEventListener('resize', scheduleVoiceDockAnchorUpdate)
  window.addEventListener('scroll', scheduleVoiceDockAnchorUpdate, true)
  void nextTick(() => {
    const el = resolveVoiceDockAnchorEl()
    if (typeof ResizeObserver !== 'undefined') {
      voiceDockResizeObserver = new ResizeObserver(() => scheduleVoiceDockAnchorUpdate())
      if (el) voiceDockResizeObserver.observe(el)
    }
    scheduleVoiceDockAnchorUpdate()
  })
})

onUnmounted(() => {
  teardownVoiceDockAnchor()
  disposeCheckersNadleChatWs()
  stopTurnTimer()
  stopRematchCountdown()
  stopMatchmakingTimer()
  if (yourTurnTimer) clearTimeout(yourTurnTimer)
  if (matchRedirectTimer) clearTimeout(matchRedirectTimer)
  cancelMatchmaking()
  teardownAudioGestureUnlock()
  checkersVoice.leaveCall()

  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', scheduleVoiceDockAnchorUpdate)
    window.removeEventListener('scroll', scheduleVoiceDockAnchorUpdate, true)
  }
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

function setGameMode(mode: CheckersUiMode): void {
  if (matchmakingState.value !== 'idle') return
  if (mode === selectedUiMode.value) return
  if (isActiveGame.value) {
    pendingModeChange.value = mode
    return
  }
  applyGameModeChange(mode)
}

function applyGameModeChange(mode: CheckersUiMode): void {
  pendingModeChange.value = null
  userChoseCheckersUiMode.value = true
  selectedUiMode.value = mode
  hasStartedCurrentGame.value = false
  showYourTurn.value = false
  matchmakingError.value = ''
  ratingDelta.value = null
  stopTurnTimer()
  stopMatchmakingTimer()
  cancelMatchmaking()

  if (mode === 'bot' || mode === 'local') {
    removeCheckersFriendSlug(roomId.value)
  }

  if (mode === 'friend' && shouldAutoRandomizeFriendRoom(roomId.value)) {
    const next = generateCallRoomCode()
    addCheckersFriendSlug(next)
    expectFriendRestartAfterRoute = true
    void router.replace({ name: 'checkers', params: { roomId: next } })
    return
  }

  if (mode === 'friend') {
    addCheckersFriendSlug(roomId.value)
  }

  scheduleRunCheckersModeReset(mode)
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
  if (needsGuestNickname.value) {
    saveGuestDisplayName(displayNameDraft.value)
    return
  }
  if (selectedUiMode.value === 'rated') {
    void findMatch()
    return
  }
  if (selectedUiMode.value === 'friend') {
    if (checkers.readyPending.value) return
    checkers.setReady(!myReady.value)
    return
  }
  if (selectedUiMode.value === 'local' && !hasLocalPlayerNames.value) {
    return
  }
  hasStartedCurrentGame.value = true
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
  stopMatchmakingTimer()
  matchmakingSeconds.value = 0
  matchmakingState.value = 'idle'
  if (selectedUiMode.value === 'rated') {
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
  startMatchmakingTimer()
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
        stopMatchmakingTimer()
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
      matchmakingError.value = isUkLocale.value
        ? 'Не вдалося знайти гру. Спробуй ще раз.'
        : 'Could not find a match. Try again.'
      if (selectedUiMode.value === 'rated') {
        hasStartedCurrentGame.value = false
      }
    }
  } finally {
    if (matchmakingAbort === abort) {
      matchmakingAbort = null
    }
    stopMatchmakingTimer()
    if (matchmakingState.value === 'searching') {
      matchmakingState.value = 'idle'
    }
  }
}

async function submitCheckersMatchResult(revision: number): Promise<void> {
  const room = checkers.roomId.value.trim()
  if (!room || !checkers.isRatedMatch.value) {
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

watch(checkersVoiceDisplayName, (displayName) => {
  checkersVoice.session.selfDisplayName = displayName
}, { immediate: true })

let checkersVoiceJoinSeq = 0
const checkersVoiceJoinKey = computed(
  () => `${checkers.state.value ? 1 : 0}|${checkersVoiceRole.value}|${checkersVoiceRoomId.value}`,
)
watch(
  checkersVoiceJoinKey,
  async () => {
    const ready = Boolean(checkers.state.value)
    const roomIdVoice = checkersVoiceRoomId.value
    const seq = ++checkersVoiceJoinSeq
    checkersVoice.leaveCall()
    remoteAudioUnlocked.value = false
    await nextTick()
    if (seq !== checkersVoiceJoinSeq || !ready || !roomIdVoice) {
      return
    }
    checkersVoice.session.roomId = roomIdVoice
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

function cleanCheckersRoomSlug(raw: string): string {
  return raw.trim().slice(0, 80)
}

const friendInviteRoomDraft = ref('')
watch(
  roomId,
  (id) => {
    friendInviteRoomDraft.value = id || ''
  },
  { immediate: true },
)

const friendInvitePreviewUrl = computed(() => {
  const code = cleanCheckersRoomSlug(friendInviteRoomDraft.value) || checkers.roomId.value || 'checkers'
  const path = `/app/checkers/${encodeURIComponent(code)}`
  if (typeof window === 'undefined') {
    return path
  }
  return new URL(path, window.location.origin).href
})

function applyFriendRoomFromOverlay(): void {
  const next = cleanCheckersRoomSlug(friendInviteRoomDraft.value)
  if (!next || next === roomId.value) {
    return
  }
  
  addCheckersFriendSlug(next)
  expectFriendRestartAfterRoute = true
  void router.push({ name: 'checkers', params: { roomId: next } })
}

function randomizeFriendRoomCode(): void {
  friendInviteRoomDraft.value = generateCallRoomCode()
}

function copyFriendInvitePreview(): void {
  void navigator.clipboard.writeText(friendInvitePreviewUrl.value).then(
    () => {
      copiedInvite.value = true
      roomCopyFlash.value = true
      window.setTimeout(() => {
        copiedInvite.value = false
        roomCopyFlash.value = false
      }, 1800)
    },
    () => {
      copiedInvite.value = false
      roomCopyFlash.value = false
    },
  )
}

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
    <div class="page-route__body">
    <AppContainer wide flush class="nadle-page nadle-page--len5 nadle-page--checkers sa-game-triptych">
      <div class="nadle-page__grid sa-game-triptych__grid h-full min-h-0">
        <AppCard class="nadle-page__stack nadle-page__stack--side nadle-page__stack--leader">
          <div class="nadle-page__leader-stack">
            <section class="checkers-room-meta" aria-label="Checkers room status">
              <div class="checkers-mode-icons" aria-label="Game mode">
                <button
                  type="button"
                  class="checkers-mode-icon"
                  :class="{ 'checkers-mode-icon--active': selectedUiMode === 'friend' }"
                  :disabled="matchmakingState !== 'idle'"
                  :title="checkersUi.modeFriend"
                  :aria-label="checkersUi.modeFriend"
                  @click="setGameMode('friend')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.7-3 2.5-5 4.5-5s3.8 2 4.5 5H3.5Zm8 0c.5-1.8 1.3-3.3 2.4-4.2.6-.5 1.3-.8 2.1-.8 2 0 3.8 2 4.5 5h-9Z" /></svg>
                </button>
                <button
                  type="button"
                  class="checkers-mode-icon"
                  :class="{ 'checkers-mode-icon--active': selectedUiMode === 'bot' }"
                  :disabled="matchmakingState !== 'idle'"
                  :title="checkersUi.modeBot"
                  :aria-label="checkersUi.modeBot"
                  @click="setGameMode('bot')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v3h3a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4h3V3Zm-3 5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H8Zm1.5 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" /></svg>
                </button>
                <button
                  type="button"
                  class="checkers-mode-icon"
                  :class="{ 'checkers-mode-icon--active': selectedUiMode === 'local' }"
                  :disabled="matchmakingState !== 'idle'"
                  :title="checkersUi.modeLocal"
                  :aria-label="checkersUi.modeLocal"
                  @click="setGameMode('local')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6v2h3v2H7v-2h3v-2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v9h16V7H4Z" /></svg>
                </button>
              </div>
              <button
                type="button"
                class="checkers-find-match"
                :disabled="matchmakingState !== 'idle'"
                @click="setGameMode('rated')"
              >
                {{ checkersUi.ratedCta }}
              </button>
              <label class="checkers-sidebar-nick checkers-start-game-field">
                <span>{{ checkersUi.nicknameField }}</span>
                <input
                  v-model="displayNameDraft"
                  type="text"
                  maxlength="48"
                  autocomplete="nickname"
                  :disabled="!auth.loaded"
                />
              </label>
              <p v-if="matchmakingError" class="checkers-room-meta__error">{{ matchmakingError }}</p>
            </section>
            <NadleGlobalLeaderboardTable
              v-model:tab="leaderboardTab"
              :loading="checkersLbLoading"
              :error="checkersLbError"
              :rows="checkersLbTableRows"
              :score-column-header="checkersLbScoreLabel"
              :self-streak-summary="checkersLbSelfStreakSummary"
              section-aria-label="Checkers leaderboard"
              :title="t('nadleLeaderboard.title')"
              :tabs-aria-label="t('nadleLeaderboard.tabsAria')"
              :tab-wins-label="t('nadleLeaderboard.tabWins')"
              :tab-streak-label="t('nadleLeaderboard.tabStreak')"
              :tab-rating-label="t('nadleLeaderboard.tabRating')"
              :loading-text="t('nadleLeaderboard.loading')"
              :empty-text="t('nadleLeaderboard.empty')"
              :col-rank="t('nadleLeaderboard.colRank')"
              :col-player="checkersUi.lbColPlayer"
              :you-label="checkersUi.lbYou"
            />
          </div>
        </AppCard>

        <AppCard ref="checkersGameStackRef" class="nadle-page__stack nadle-page__stack--game checkers-game-stack">
          <div
            v-if="isActiveGame"
            class="checkers-turn-hud"
            role="status"
            aria-live="polite"
            :aria-label="`${checkersUi.metaTurn}: ${turnLabel}. ${checkersUi.metaTimer}: ${turnTimerLabel}`"
          >
            <span class="checkers-turn-hud__item">
              <span class="checkers-turn-hud__value">{{ turnLabel }}</span>
            </span>
            <span class="checkers-turn-hud__divider" aria-hidden="true" />
            <span class="checkers-turn-hud__item">
              <span
                class="checkers-turn-hud__value checkers-turn-hud__value--mono"
                :class="{ 'checkers-turn-hud__timer--low': isTurnTimerLow }"
              >{{ turnTimerLabel }}</span>
            </span>
          </div>
          <div ref="checkersGameContentRef" class="nadle-page__game">
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
                  <div class="checkers-start-game-card">
                    <p id="checkers-start-game-title" class="checkers-start-game-title">
                      <template v-if="needsGuestNickname">{{ checkersUi.overlayGuestTitle }}</template>
                      <template v-else-if="selectedUiMode === 'rated'">{{ checkersUi.modeRated }}</template>
                      <template v-else-if="selectedUiMode === 'friend'">{{ checkersUi.modeFriend }}</template>
                      <template v-else-if="selectedUiMode === 'local'">{{ checkersUi.modeLocal }}</template>
                      <template v-else>{{ checkersUi.modeBot }}</template>
                    </p>
                    <p class="checkers-start-game-copy">
                      <template v-if="needsGuestNickname">{{ checkersUi.overlayGuestCopy }}</template>
                      <template v-else-if="matchmakingState === 'matched'">{{ checkersUi.overlayMatched }}</template>
                      <template v-else-if="matchmakingState === 'searching'">
                        {{ checkersUi.overlaySearching }} {{ matchmakingSeconds }} {{ checkersUi.searchingSecondsSuffix }}
                      </template>
                      <template v-else-if="selectedUiMode === 'rated'">{{ checkersUi.overlayRatedCopy }}</template>
                      <template v-else-if="selectedUiMode === 'friend'">{{ checkersUi.overlayFriendCopy }}</template>
                      <template v-else-if="selectedUiMode === 'local'">{{ checkersUi.overlayLocalCopy }}</template>
                      <template v-else>{{ checkersUi.overlayBotCopy }}</template>
                    </p>

                    <label v-if="needsGuestNickname" class="checkers-start-game-field">
                      {{ checkersUi.nicknameField }}
                      <input v-model="displayNameDraft" type="text" autocomplete="nickname" maxlength="48" />
                    </label>

                    <div v-else-if="selectedUiMode === 'friend'" class="checkers-friend-invite">
                      <div class="call-page__room-pop-code checkers-friend-invite__room-pop">
                        <span class="call-page__room-pop-label">{{ checkersUi.roomCodeField }}</span>
                        <div class="call-page__room-pop-code-row">
                          <input
                            v-model="friendInviteRoomDraft"
                            class="call-page__room-pop-code-input"
                            type="text"
                            maxlength="80"
                            autocomplete="off"
                            @keydown.enter.prevent="applyFriendRoomFromOverlay"
                          />
                          <div class="call-page__room-pop-code-tools">
                            <div class="call-page__room-pop-copy-wrap">
                              <button
                                type="button"
                                class="call-page__room-pop-ico-btn"
                                :title="roomCopyFlash ? t('callPage.roomCodeCopied') : t('callPage.roomCopy')"
                                :aria-label="roomCopyFlash ? t('callPage.roomCodeCopied') : t('callPage.roomCopy')"
                                @click="copyFriendInvitePreview"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18"
                                  height="18"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  aria-hidden="true"
                                >
                                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                </svg>
                              </button>
                              <span
                                v-show="roomCopyFlash"
                                role="status"
                                aria-live="polite"
                                class="call-page__room-pop-copy-tooltip"
                              >
                                {{ t('callPage.roomCodeCopied') }}
                              </span>
                            </div>
                            <button
                              type="button"
                              class="call-page__room-pop-ico-btn"
                              :title="t('callPage.roomGenerateNew')"
                              :aria-label="t('callPage.roomRegenerateAria')"
                              @click="randomizeFriendRoomCode"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true"
                              >
                                <rect width="16" height="16" x="4" y="4" rx="2.5" ry="2.5" />
                                <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
                                <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
                                <circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" />
                                <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      <p class="checkers-friend-invite__link-row">
                        <span>{{ checkersUi.linkLabel }}</span>
                        <strong class="checkers-friend-invite__url">{{ friendInvitePreviewUrl }}</strong>
                      </p>
                      <div class="checkers-friend-invite__actions checkers-friend-invite__actions--solo">
                        <button
                          type="button"
                          class="checkers-start-game-secondary checkers-friend-invite__apply"
                          :disabled="
                            !cleanCheckersRoomSlug(friendInviteRoomDraft) ||
                              cleanCheckersRoomSlug(friendInviteRoomDraft) === roomId
                          "
                          @click="applyFriendRoomFromOverlay"
                        >
                          {{ checkersUi.applyFriendRoom }}
                        </button>
                      </div>
                      <div class="checkers-ready-list">
                        <span :class="{ 'checkers-ready-list__item--ready': whiteSeatReady }">
                          {{ playerOneLabel }}: {{ whiteSeatReady ? checkersUi.readyOn : checkersUi.readyOff }}
                        </span>
                        <span :class="{ 'checkers-ready-list__item--ready': blackSeatReady }">
                          {{ playerTwoLabel }}: {{ blackSeatReady ? checkersUi.readyOn : checkersUi.readyOff }}
                        </span>
                      </div>
                    </div>

                    <div v-else-if="selectedUiMode === 'local'" class="checkers-local-names">
                      <div class="checkers-local-player-row">
                        <span class="checkers-local-piece checkers-local-piece--light" aria-hidden="true">
                          <svg class="checkers-local-piece__svg" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="8" fill="#f5f0ff" stroke="rgba(124,58,237,0.75)" stroke-width="1.4" />
                            <circle cx="12" cy="12" r="5.2" fill="#faf5ff" stroke="rgba(139,92,246,0.35)" stroke-width="0.7" />
                          </svg>
                        </span>
                        <input
                          v-model="localPlayerDrafts.white"
                          class="checkers-local-name-input"
                          type="text"
                          maxlength="48"
                          :placeholder="checkersUi.localNickPlaceholder"
                        />
                      </div>
                      <div class="checkers-local-player-row">
                        <span class="checkers-local-piece checkers-local-piece--dark" aria-hidden="true">
                          <svg class="checkers-local-piece__svg" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="8" fill="#141018" stroke="rgba(167,139,250,0.5)" stroke-width="1.4" />
                            <circle cx="12" cy="12" r="5.2" fill="#261933" stroke="rgba(139,92,246,0.3)" stroke-width="0.7" />
                          </svg>
                        </span>
                        <input
                          v-model="localPlayerDrafts.black"
                          class="checkers-local-name-input"
                          type="text"
                          maxlength="48"
                          :placeholder="checkersUi.localNickPlaceholder"
                        />
                      </div>
                    </div>

                    <button
                      v-if="matchmakingState !== 'matched'"
                      type="button"
                      class="checkers-start-game-button"
                      :disabled="
                        checkers.readyPending.value ||
                          matchmakingState === 'searching' ||
                          (selectedUiMode === 'local' && !hasLocalPlayerNames) ||
                          (needsGuestNickname && !guestDisplayName)
                      "
                      @click="startCurrentGame"
                    >
                      {{ startGameButtonLabel }}
                    </button>
                    <button
                      v-if="matchmakingState === 'searching'"
                      type="button"
                      class="checkers-start-game-secondary"
                      @click="cancelMatchmaking"
                    >
                      {{ checkersUi.cancelSearch }}
                    </button>
                  </div>
                </div>
              </Transition>
              <CheckersEndGameOverlay
                :winner="endGameWinner"
                :mode="checkers.mode.value"
                :player-labels="playerLabels"
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
                  {{ checkersUi.rematchIn }} <strong :key="rematchCountdown">{{ rematchCountdown }}</strong>...
                </span>
              </CheckersEndGameOverlay>
            </div>
            <div class="checkers-controls">
              <div class="checkers-controls__actions" aria-hidden="true" />
            </div>
          </div>
        </AppCard>

        <AppCard class="nadle-page__stack nadle-page__stack--side nadle-page__stack--chat">
          <TwitchRelayChatPanel
            ref="chatPanelRef"
            flex-rail
            :show-guess-hints="false"
            :ws-status="checkersNadleWsStatus"
            :ws-status-label="checkersRelayWsStatusLabel"
            :chat-title="t('nadleUi.chatTitle')"
            guess-len-hint=""
            :channel-display="checkersEffectiveTwitchChannel"
            :twitch-watch-url="checkersTwitchWatchUrl"
            :open-twitch-label="t('nadleUi.chatOpenTwitch')"
            :irc-relay-banner="checkersRelayIrcBanner"
            :relay-aria-label="t('nadleUi.chatRelayAria')"
            :chat-empty-text="t('nadleUi.chatEmpty', { channel: checkersEffectiveTwitchChannel })"
            :guess-badge-label="t('nadleUi.chatGuessBadge')"
            :lines="checkersNadleChatLines"
            :default-cooldown-ms="checkersNadlePublicConfig?.chatGuessCooldownMs ?? 1500"
            :format-cooldown-hint="formatCheckersChatCooldownHint"
            :feedback-to-emojis="checkersChatFeedbackToEmojis"
          />
        </AppCard>
      </div>
    </AppContainer>
    </div>
    <Transition name="checkers-your-turn">
      <div v-if="showYourTurn" class="checkers-your-turn" aria-live="polite">
        {{ checkersUi.yourTurnBanner }}
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
          <p id="checkers-mode-confirm-title" class="checkers-mode-confirm-title">{{ checkersUi.modeConfirmTitle }}</p>
          <p class="checkers-mode-confirm-copy">
            {{ modeConfirmFullCopy }}
          </p>
          <div class="checkers-mode-confirm-actions">
            <button type="button" class="checkers-mode-confirm-button" @click="cancelModeChange">
              {{ checkersUi.modeConfirmStay }}
            </button>
            <button
              type="button"
              class="checkers-mode-confirm-button checkers-mode-confirm-button--danger"
              @click="confirmModeChange"
            >
              {{ checkersUi.modeConfirmChange }}
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
      />
    </div>
    
    <Teleport to="body">
      <div class="checkers-voice-dock" :style="voiceDockInlineStyle">
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
    </div>
    </Teleport>
  </div>
</template>

<style scoped>
.page-route {
  height: 100vh;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: visible;
}

.page-route__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
  padding-inline: var(--sa-space-2);
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


.nadle-page--checkers.nadle-page {
  overflow-x: visible;
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

.nadle-page__game:has(.checkers-board-shell) {
  padding: clamp(4px, 0.85vw, 10px);
  gap: 9px;
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
  box-sizing: border-box;
  
  padding-inline: clamp(10px, 2.15cqmin, 22px);
  container-type: size;
}

.checkers-game-stack {
  position: relative;
  overflow: visible;
}

.checkers-turn-hud {
  position: absolute;
  left: 50%;
  top: 0;
  z-index: 12028;
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  max-width: min(92vw, 26rem);
  padding: 0.42rem 0.95rem 0.46rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(44, 39, 55, 0.88);
  color: rgba(237, 233, 255, 0.94);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 10px 28px rgba(0, 0, 0, 0.28);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  transform: translate(-50%, -50%);
  pointer-events: none;
  font-family: "Marmelad", var(--sa-font-main);
  font-size: clamp(0.72rem, 2vw, 0.82rem);
  line-height: 1.2;
}

.checkers-turn-hud__item {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
}

.checkers-turn-hud__value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
}

.checkers-turn-hud__value--mono {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.checkers-turn-hud__timer--low {
  color: #ffb24a;
  text-shadow:
    0 0 14px rgba(255, 140, 60, 0.85),
    0 0 24px rgba(255, 90, 40, 0.35);
  animation: checkers-turn-hud-timer-warn 0.75s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .checkers-turn-hud__timer--low {
    animation: none;
  }
}

@keyframes checkers-turn-hud-timer-warn {
  0%,
  100% {
    opacity: 1;
    filter: brightness(1);
  }

  50% {
    opacity: 0.45;
    filter: brightness(1.35);
  }
}

.checkers-turn-hud__divider {
  flex-shrink: 0;
  width: 1px;
  height: 0.95em;
  align-self: center;
  background: rgba(255, 255, 255, 0.22);
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

.checkers-sidebar-nick {
  margin-bottom: var(--sa-space-2);
}

.checkers-sidebar-nick input:read-only {
  opacity: 0.88;
  cursor: default;
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

.checkers-start-game-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  background: linear-gradient(165deg, rgba(46, 16, 86, 0.52) 0%, rgba(18, 6, 40, 0.62) 50%, rgba(28, 10, 58, 0.55) 100%);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

.checkers-start-game-card {
  display: grid;
  width: min(100% - 2rem, 25rem);
  gap: var(--sa-space-3);
  justify-items: center;
  padding: var(--sa-space-5);
  border: 1px solid rgba(192, 132, 252, 0.45);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(72, 28, 120, 0.94) 0%, rgba(36, 12, 68, 0.97) 100%);
  color: #fff;
  text-align: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 0 32px rgba(168, 85, 247, 0.35),
    0 20px 52px rgba(3, 1, 9, 0.45);
}

.checkers-start-game-title {
  margin: 0;
  font-family: "Climate Crisis", var(--sa-font-display);
  font-size: clamp(1.05rem, 3vw, 1.55rem);
}

.checkers-start-game-copy {
  margin: 0;
  color: rgba(237, 233, 255, 0.88);
  font-size: 0.88rem;
  line-height: 1.35;
}

.checkers-start-game-field {
  display: grid;
  width: 100%;
  gap: 0.35rem;
  color: rgba(245, 243, 255, 0.78);
  font-size: 0.8rem;
  text-align: left;
}

.checkers-start-game-field input {
  width: 100%;
  min-height: 2.35rem;
  border: 1px solid rgba(216, 180, 254, 0.34);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 0 var(--sa-space-3);
  font: inherit;
}

.checkers-friend-invite,
.checkers-local-names {
  display: grid;
  width: 100%;
  gap: var(--sa-space-2);
}

.checkers-friend-invite__link-row {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  color: rgba(230, 225, 255, 0.86);
  font-size: 0.76rem;
  text-align: left;
}

.checkers-friend-invite__url {
  overflow: hidden;
  color: #f5f0ff;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkers-friend-invite__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 100%;
  justify-content: center;
}

.checkers-friend-invite__actions--solo .checkers-friend-invite__apply {
  flex: 1 1 100%;
  max-width: 100%;
}

.checkers-friend-invite__room-pop {
  width: 100%;
  text-align: left;
}

.checkers-friend-invite__room-pop .call-page__room-pop-label {
  color: rgba(230, 225, 255, 0.88);
}

.checkers-local-player-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
}

.checkers-local-piece {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkers-local-piece__svg {
  width: 2rem;
  height: 2rem;
  display: block;
}

.checkers-local-name-input {
  flex: 1;
  min-height: 2.35rem;
  border: 1px solid rgba(216, 180, 254, 0.34);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 0 var(--sa-space-3);
  font: inherit;
}

.checkers-local-name-input::placeholder {
  color: rgba(245, 243, 255, 0.45);
}

.checkers-ready-list {
  display: grid;
  gap: 0.35rem;
  color: rgba(245, 243, 255, 0.74);
  font-size: 0.78rem;
  text-align: left;
}

.checkers-ready-list span {
  padding: 0.42rem 0.65rem;
  border: 1px solid rgba(192, 132, 252, 0.35);
  border-radius: 999px;
  background: rgba(88, 28, 135, 0.35);
}

.checkers-ready-list__item--ready {
  border-color: rgba(134, 239, 172, 0.42) !important;
  color: #bbf7d0;
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

.checkers-start-game-button:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}

.checkers-start-game-button:hover,
.checkers-start-game-button:focus-visible {
  border-color: rgba(255, 255, 255, 0.7);
  background: rgba(146, 82, 206, 0.94);
}

.checkers-start-game-secondary {
  min-height: 2.25rem;
  padding: 0 var(--sa-space-4);
  border: 1px solid rgba(216, 180, 254, 0.42);
  border-radius: 999px;
  background: rgba(126, 34, 206, 0.28);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
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


.checkers-voice-dock {
  position: fixed;
  bottom: clamp(3.35rem, 6vh, 4.5rem);
  z-index: 12031;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  pointer-events: none;
}

.checkers-voice-dock > .checkers-mic-button,
.checkers-voice-dock > .checkers-audio-controls {
  pointer-events: auto;
}

.checkers-audio-controls {
  position: relative;
  display: inline-block;
}

.checkers-headphones-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
  position: relative;
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
  flex-shrink: 0;
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
  transform: translateY(-1px) scale(1.03);
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

@media (min-width: 1200px) {
  .nadle-page__grid.sa-game-triptych__grid {
    grid-template-columns:
      minmax(max(var(--sa-game-sidebar-min), var(--sa-game-triptych-sidebar-min-lg)), 1fr)
      minmax(0, var(--sa-game-triptych-center-max))
      minmax(max(var(--sa-game-sidebar-min), var(--sa-game-triptych-sidebar-min-lg)), 1fr);
    gap: 13px;
  }

  .nadle-page--checkers.nadle-page {
    overflow-x: visible;
    overflow-y: hidden;
  }

  .page-route {
    height: 100%;
    max-height: 100%;
    overflow: visible;
    flex: 1 1 auto;
    min-height: 0;
  }

  .page-route__body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .nadle-page {
    padding-block: 18px 18px;
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

  .checkers-board-shell {
    padding-inline: clamp(8px, 1.65cqmin, 16px);
  }

  .nadle-page__grid :deep(.nadle-page__stack--chat) {
    min-height: 0;
    height: 100%;
  }
}

@media (min-width: 1200px) and (max-width: 1480px) {
  .nadle-page__grid.sa-game-triptych__grid {
    grid-template-columns:
      minmax(var(--sa-game-sidebar-min), 1fr)
      minmax(0, var(--sa-game-triptych-center-max))
      minmax(var(--sa-game-sidebar-min), 1fr);
  }
}

@media (max-width: 1199px) {
  .page-route,
  .page-route__body {
    overflow-x: clip;
  }

  /* Default checkers `.nadle-page` uses overflow-x visible for desktop glow bleed; narrow pages must not gain body scroll-x. */
  .nadle-page--checkers.nadle-page {
    overflow-x: clip;
    overflow-y: visible;
  }

  .page-route {
    height: auto;
    max-height: none;
    overflow-y: visible;
  }

  .page-route__body {
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: visible;
  }

  .nadle-page {
    flex: 0 1 auto;
    min-height: auto;
    height: auto;
    max-height: none;
    overflow-x: clip;
    overflow-y: visible;
    padding-block: var(--sa-space-2) var(--sa-space-4);
    padding-inline: clamp(0.45rem, 2vw, 0.65rem);
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

  
  .nadle-page__grid > .nadle-page__stack.checkers-game-stack.nadle-page__stack--game {
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

