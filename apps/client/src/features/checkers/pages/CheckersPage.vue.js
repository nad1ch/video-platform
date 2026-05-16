/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { playAllPageAudio, useCallOrchestrator } from 'call-core';
import { useAuth } from '@/composables/useAuth';
import { useLocalTileSpeakingVisual } from '@/composables/useLocalTileSpeakingVisual';
import { apiFetch, readJsonIfOk } from '@/utils/apiFetch';
import { readStorageJson, writeStorageJson } from '@/utils/storageJson.js';
import '@/components/call/CallPage.css';
import { generateCallRoomCode } from '@/utils/callRoomUi';
import NadleGlobalLeaderboardTable from '@/components/nadle/NadleGlobalLeaderboardTable.vue';
import { fetchLeaderboardRating, fetchLeaderboardStreak, fetchLeaderboardWins, } from '@/nadle/nadleApi';
import StreamAudio from '@/components/StreamAudio.vue';
import TwitchRelayChatPanel from '@/components/twitch/TwitchRelayChatPanel.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppContainer from '@/components/ui/AppContainer.vue';
import '@/components/ui/gameTriptychLayout.css';
import { STREAMER_NICK } from '@/eat-first/constants/brand.js';
import { useNadleStatusBanners } from '@/composables/useNadleStatusBanners';
import { useNadleStreamerRoom } from '@/composables/useNadleStreamerRoom';
import { useNadleWs } from '@/nadle/ws';
import { createLogger } from '@/utils/logger';
import { getLegalMoves, getValidMove } from '../core/checkersEngine';
import { addCheckersFriendSlug, checkersFriendSlugSet, removeCheckersFriendSlug, } from '../checkersFriendRoomSlugs';
import { useCheckersOrchestrator } from '../orchestrator/useCheckersOrchestrator';
import { readCheckersClientId } from '../ws/checkersWs';
import CheckersBoard from '../ui/CheckersBoard.vue';
import CheckersEndGameOverlay from '../ui/CheckersEndGameOverlay.vue';
import { useI18n } from 'vue-i18n';
const CHECKERS_GUEST_IDENTITY_KEY = 'checkers:guest-identity:v1';
const CHECKERS_LOCAL_NAMES_KEY = 'checkers:local-names:v1';
const CHECKERS_SIGNED_DISPLAY_BY_USER_KEY = 'checkers:signed-display-by-user:v1';
const CHECKERS_DEFAULT_MODE_QUERY_KEY = 'defaultMode';
const CHECKERS_DEFAULT_MODE_RATED_Q = 'rated';
const route = useRoute();
const router = useRouter();
const { locale, t } = useI18n();
const auth = useAuth();
const checkersNadleChatLog = createLogger('checkers-nadle-chat');
function normalizeTwitchLogin(raw) {
    if (raw == null || typeof raw !== 'string') {
        return null;
    }
    const s = raw.trim().replace(/^#/, '').toLowerCase();
    if (s.length < 2 || s.length > 25) {
        return null;
    }
    if (!/^[a-z0-9_]+$/.test(s)) {
        return null;
    }
    return s;
}
const effectiveCheckersRelaySlug = computed(() => {
    const u = auth.user.value;
    const fromAccount = u && typeof u.nadleStreamerName === 'string' ? normalizeTwitchLogin(u.nadleStreamerName) : null;
    if (fromAccount) {
        return fromAccount;
    }
    const q = route.query.streamer;
    if (typeof q === 'string') {
        const fromQuery = normalizeTwitchLogin(q);
        if (fromQuery) {
            return fromQuery;
        }
    }
    return STREAMER_NICK;
});
const { nadlePublicConfig: checkersNadlePublicConfig, streamerProfile: checkersRelayStreamerProfile, streamerLoadError: checkersRelayStreamerLoadError, effectiveTwitchChannel: checkersEffectiveTwitchChannel, loadStreamerCard: loadCheckersRelayStreamerCard, fetchNadlePublicConfig: fetchCheckersRelayPublicConfig, } = useNadleStreamerRoom({
    effectiveNadleSlug: effectiveCheckersRelaySlug,
    demoFallbackChannel: STREAMER_NICK,
});
const nadleChatLastError = ref(null);
const checkersNadleChatPeerId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `checkers-chat-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
const chatPanelRef = ref(null);
const { chatLines: checkersNadleChatLines, wsStatus: checkersNadleWsStatus, ircRelayStatus: checkersNadleIrcRelayStatus, prepareNadleWsMount: prepareCheckersNadleChatWs, disposeNadleWs: disposeCheckersNadleChatWs, } = useNadleWs({
    streamerProfile: checkersRelayStreamerProfile,
    lastError: nadleChatLastError,
    nadleTabPeerId: checkersNadleChatPeerId,
    log: checkersNadleChatLog,
    onNewGame: () => { },
    afterChatLineAppended: () => {
        void nextTick(() => chatPanelRef.value?.scrollToBottom());
    },
    isAuthenticated: computed(() => auth.isAuthenticated.value),
});
const { wsStatusLabel: checkersRelayWsStatusLabel, ircRelayBanner: checkersRelayIrcBanner } = useNadleStatusBanners({
    streamerLoadError: checkersRelayStreamerLoadError,
    lastError: nadleChatLastError,
    wsStatus: checkersNadleWsStatus,
    ircRelayStatus: checkersNadleIrcRelayStatus,
});
const checkersTwitchWatchUrl = computed(() => `https://www.twitch.tv/${encodeURIComponent(checkersEffectiveTwitchChannel.value)}`);
function formatCheckersChatCooldownHint(ms) {
    const s = ms / 1000;
    const label = Number.isInteger(s) ? String(s) : s.toFixed(1);
    return t('nadleUi.cooldownHint', { seconds: label });
}
function checkersChatFeedbackToEmojis(fb) {
    return fb.map((f) => (f === 'correct' ? '🟩' : f === 'present' ? '🟨' : '⬛')).join(' ');
}
let checkersRelayStreamerLoadSeq = 0;
watch(() => effectiveCheckersRelaySlug.value, async () => {
    const seq = ++checkersRelayStreamerLoadSeq;
    await loadCheckersRelayStreamerCard();
    if (seq !== checkersRelayStreamerLoadSeq) {
        return;
    }
    void fetchCheckersRelayPublicConfig();
}, { immediate: true });
watch(checkersNadleChatLines, () => {
    void nextTick(() => chatPanelRef.value?.scrollToBottom());
}, { deep: true });
const roomId = computed(() => {
    const raw = route.params.roomId;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value ?? '').trim();
});
const botDifficulty = ref('medium');
const leaderboardTab = ref('wins');
const leaderboardWins = ref(readCheckersLeaderboard());
const CHECKERS_LB_Q = '?game=checkers';
const checkersLbWinsRows = ref([]);
const checkersLbStreakRows = ref([]);
const checkersLbRatingRows = ref([]);
const checkersLbViewerMaxStreak = ref(undefined);
const checkersLbLoading = ref(false);
const checkersLbError = ref(null);
const recordedWinnerRevision = ref(null);
const copiedInvite = ref(false);
const roomCopyFlash = ref(false);
const displayNameDraft = ref(readGuestDisplayName());
const localPlayerDrafts = ref(readLocalPlayerNames());
const selectedUiMode = ref('bot');
/** After the player changes mode in the UI, do not snap tabs to stale server `mode` before `setMode` ACK. */
const userChoseCheckersUiMode = ref(false);
const remoteAudioUnlocked = ref(false);
const remoteListenVolume = ref(1);
const remoteListenMuted = ref(false);
const audioControlsOpen = ref(false);
const audioControlsRoot = ref(null);
const checkersGameStackRef = ref(null);
const checkersGameContentRef = ref(null);
let voiceDockAnchorFrame = 0;
let voiceDockResizeObserver = null;
const voiceDockCenterXPx = ref(undefined);
function resolveCheckersGameStackEl() {
    const inst = checkersGameStackRef.value;
    const el = inst?.$el;
    return el instanceof HTMLElement ? el : null;
}
function resolveVoiceDockAnchorEl() {
    const stack = resolveCheckersGameStackEl();
    if (stack)
        return stack;
    const inner = checkersGameContentRef.value;
    return inner instanceof HTMLElement ? inner : null;
}
function applyVoiceDockCenterX() {
    voiceDockAnchorFrame = 0;
    const el = resolveVoiceDockAnchorEl();
    if (!el) {
        voiceDockCenterXPx.value = undefined;
        return;
    }
    const rect = el.getBoundingClientRect();
    voiceDockCenterXPx.value = Math.round(rect.left + rect.width / 2);
}
function scheduleVoiceDockAnchorUpdate() {
    if (typeof window === 'undefined')
        return;
    if (voiceDockAnchorFrame !== 0)
        return;
    voiceDockAnchorFrame = window.requestAnimationFrame(applyVoiceDockCenterX);
}
function teardownVoiceDockAnchor() {
    if (typeof window !== 'undefined' && voiceDockAnchorFrame !== 0) {
        window.cancelAnimationFrame(voiceDockAnchorFrame);
        voiceDockAnchorFrame = 0;
    }
    voiceDockResizeObserver?.disconnect();
    voiceDockResizeObserver = null;
}
const voiceDockInlineStyle = computed(() => {
    const x = voiceDockCenterXPx.value;
    if (typeof x !== 'number' || Number.isNaN(x)) {
        return { left: '50%', transform: 'translateX(-50%)' };
    }
    return { left: `${x}px`, transform: 'translateX(-50%)' };
});
const hasStartedCurrentGame = ref(false);
const pendingModeChange = ref(null);
const rematchCountdown = ref(5);
const ratingDelta = ref(null);
const matchmakingState = ref('idle');
const matchmakingError = ref('');
const matchmakingSeconds = ref(0);
const TURN_SECONDS = 60;
const TURN_TIMER_WARN_BELOW_SEC = 10;
const turnSecondsLeft = ref(TURN_SECONDS);
const showYourTurn = ref(false);
let turnTimer = null;
let yourTurnTimer = null;
let matchmakingAbort = null;
let matchmakingTimer = null;
let matchRedirectTimer = null;
let rematchCountdownTimer = null;
let matchFoundFeedbackPlayed = false;
let expectFriendRestartAfterRoute = false;
let checkersRoomHandshakeGen = 0;
const authDisplayName = computed(() => cleanDisplayName(auth.user.value?.displayName));
const guestDisplayName = computed(() => cleanDisplayName(displayNameDraft.value));
const effectiveDisplayName = computed(() => {
    if (auth.user.value) {
        const draft = guestDisplayName.value;
        return draft || authDisplayName.value;
    }
    return guestDisplayName.value;
});
const needsGuestNickname = computed(() => auth.loaded.value && !auth.user.value && !guestDisplayName.value);
const canJoinCheckersRoom = computed(() => !auth.loaded.value || Boolean(effectiveDisplayName.value));
const checkers = useCheckersOrchestrator({
    roomId,
    botDifficulty,
    displayName: effectiveDisplayName,
    canJoin: canJoinCheckersRoom,
});
const isUkLocale = computed(() => String(locale.value || '').toLowerCase().startsWith('uk'));
const checkersUi = computed(() => {
    const uk = isUkLocale.value;
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
    };
});
const friendRoomReady = computed(() => {
    if (checkers.isRatedMatch.value)
        return true;
    if (checkers.mode.value !== 'friend') {
        if (selectedUiMode.value === 'friend')
            return false;
        return true;
    }
    const players = checkers.players.value;
    return players.player1?.ready === true && players.player2?.ready === true;
});
const myReady = computed(() => {
    if (checkers.myRole.value !== 'player1' && checkers.myRole.value !== 'player2')
        return false;
    return checkers.players.value[checkers.myRole.value]?.ready === true;
});
const whiteSeatReady = computed(() => checkers.players.value.player1?.ready === true);
const blackSeatReady = computed(() => checkers.players.value.player2?.ready === true);
const localWhiteName = computed(() => cleanDisplayName(localPlayerDrafts.value.white));
const localBlackName = computed(() => cleanDisplayName(localPlayerDrafts.value.black));
const hasLocalPlayerNames = computed(() => Boolean(localWhiteName.value && localBlackName.value));
const playerLabels = computed(() => {
    const ui = checkersUi.value;
    if (selectedUiMode.value === 'local' || checkers.mode.value === 'local') {
        return {
            player1: localWhiteName.value || '⚪',
            player2: localBlackName.value || '⚫',
        };
    }
    const players = checkers.players.value;
    return {
        player1: cleanDisplayName(players.player1?.displayName) ||
            (checkers.myRole.value === 'player1' ? effectiveDisplayName.value : '') ||
            ui.pieceWhite,
        player2: cleanDisplayName(players.player2?.displayName) ||
            (checkers.mode.value === 'bot' ? ui.botName : '') ||
            (checkers.myRole.value === 'player2' ? effectiveDisplayName.value : '') ||
            ui.opponent,
    };
});
const roleLabel = computed(() => {
    const ui = checkersUi.value;
    if (needsGuestNickname.value)
        return isUkLocale.value ? 'Введи нікнейм' : 'Enter a nickname';
    if (selectedUiMode.value === 'rated' && matchmakingState.value === 'idle') {
        return effectiveDisplayName.value || ui.guest;
    }
    if (checkers.mode.value === 'local')
        return `${playerLabels.value.player1} / ${playerLabels.value.player2}`;
    if (checkers.myRole.value === 'player1')
        return playerOneLabel.value;
    if (checkers.myRole.value === 'player2')
        return playerTwoLabel.value;
    return ui.spectator;
});
const playerOneLabel = computed(() => playerLabels.value.player1);
const playerTwoLabel = computed(() => playerLabels.value.player2);
const turnLabel = computed(() => {
    const turn = checkers.displayState.value.turn;
    return playerLabels.value[turn];
});
const turnTimerLabel = computed(() => {
    const m = Math.floor(turnSecondsLeft.value / 60).toString().padStart(2, '0');
    const s = Math.max(0, turnSecondsLeft.value % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
});
const boardFlipped = computed(() => checkers.myRole.value === 'player2');
const isCheckersPlayer = computed(() => checkers.myRole.value === 'player1' || checkers.myRole.value === 'player2');
const isCheckersSpectator = computed(() => !isCheckersPlayer.value);
const isEndGameOverlayVisible = computed(() => Boolean(checkers.displayState.value.winner));
const isFriendInviteVisible = computed(() => {
    if (selectedUiMode.value !== 'friend' || checkers.isRatedMatch.value)
        return false;
    if (friendRoomReady.value)
        return false;
    if (!checkers.serverModeSynced.value)
        return true;
    return checkers.mode.value === 'friend' || checkers.mode.value === 'bot';
});
const isStartOverlayVisible = computed(() => !checkers.displayState.value.winner &&
    (matchmakingState.value !== 'idle' ||
        needsGuestNickname.value ||
        (selectedUiMode.value === 'rated' &&
            !checkers.isRatedMatch.value &&
            !hasStartedCurrentGame.value) ||
        (selectedUiMode.value === 'friend' && isFriendInviteVisible.value) ||
        (!hasStartedCurrentGame.value && (selectedUiMode.value === 'bot' || selectedUiMode.value === 'local'))));
const startGameButtonLabel = computed(() => {
    const uk = isUkLocale.value;
    if (needsGuestNickname.value)
        return uk ? 'Зберегти нікнейм' : 'Save nickname';
    if (selectedUiMode.value === 'rated')
        return uk ? 'Почати пошук' : 'Start search';
    if (selectedUiMode.value === 'friend') {
        return myReady.value ? (uk ? 'Скасувати готовність' : 'Undo ready') : uk ? 'Готовий' : 'Ready';
    }
    if (selectedUiMode.value === 'local')
        return uk ? 'Почати локальну гру' : 'Start local game';
    return uk ? 'Почати гру' : 'Start game';
});
const isActiveGame = computed(() => Boolean(hasStartedCurrentGame.value && !checkers.displayState.value.winner));
const isTurnTimerLow = computed(() => isActiveGame.value &&
    turnSecondsLeft.value > 0 &&
    turnSecondsLeft.value <= TURN_TIMER_WARN_BELOW_SEC);
const pendingModeLabel = computed(() => {
    const uk = isUkLocale.value;
    if (pendingModeChange.value === 'bot')
        return uk ? 'гру проти бота' : 'bot mode';
    if (pendingModeChange.value === 'friend')
        return uk ? 'гру з другом' : 'friend mode';
    if (pendingModeChange.value === 'local')
        return uk ? 'гру на одному пристрої' : 'same-device mode';
    if (pendingModeChange.value === 'rated')
        return uk ? 'рейтинговий матч' : 'rated match';
    return uk ? 'інший режим' : 'another mode';
});
const modeConfirmFullCopy = computed(() => {
    const uk = isUkLocale.value;
    const target = pendingModeLabel.value;
    if (uk) {
        return `Поточна партія буде скинута. Після переходу на ${target} білі знову ходитимуть першими.`;
    }
    return `The current game will reset. After switching to ${target}, white moves first again.`;
});
const endGameWinner = computed(() => {
    const winner = checkers.displayState.value.winner;
    if (!winner)
        return null;
    if (checkers.mode.value === 'local' || isCheckersSpectator.value)
        return winner;
    return winner === checkers.myRole.value ? 'you' : 'opponent';
});
const checkersVoiceRoomId = computed(() => {
    const room = checkers.roomId.value.trim();
    return room ? `checkers:${room}` : '';
});
const checkersVoiceDisplayName = computed(() => {
    const name = effectiveDisplayName.value;
    return name || roleLabel.value;
});
const checkersVoiceRole = computed(() => (isCheckersPlayer.value ? 'participant' : 'viewer'));
const checkersVoiceMediaMode = computed(() => 'audio-only');
const checkersVoiceJoinUserId = computed(() => {
    const id = auth.user.value?.id;
    return typeof id === 'string' && id.trim().length > 0 ? id.trim() : undefined;
});
const checkersVoice = useCallOrchestrator({
    role: checkersVoiceRole,
    mediaMode: checkersVoiceMediaMode,
    joinUserId: checkersVoiceJoinUserId,
});
const remoteVoiceTiles = computed(() => checkersVoice.tiles.value.filter((tile) => !tile.isLocal && tile.stream?.getAudioTracks().length));
const isMicActive = computed(() => isCheckersPlayer.value && checkersVoice.micEnabled.value);
const localMicSpeaking = useLocalTileSpeakingVisual(() => checkersVoice.localAudioSourceStream.value, () => true, () => isMicActive.value);
const micButtonLabel = computed(() => {
    const ui = checkersUi.value;
    if (isCheckersSpectator.value)
        return ui.micSpectator;
    return isMicActive.value ? ui.micMute : ui.micOn;
});
const shouldShowAutoRematchCountdown = computed(() => Boolean(checkers.displayState.value.winner &&
    checkers.mode.value === 'friend' &&
    !checkers.isRatedMatch.value &&
    isCheckersPlayer.value &&
    !checkers.rematchRequestedByMe.value));
const winningMove = computed(() => (checkers.displayState.value.winner ? checkers.lastMove.value : null));
function checkersLbIsSelfRow(entry) {
    const u = auth.user.value;
    if (!u) {
        return false;
    }
    if (u.dbUserId && entry.userId === u.dbUserId) {
        return true;
    }
    if (entry.userId === u.id) {
        return true;
    }
    if (u.twitchId && entry.userId === u.twitchId) {
        return true;
    }
    return false;
}
function checkersLbInitials(name) {
    const s = String(name ?? '').trim();
    if (!s) {
        return '?';
    }
    return s[0].toUpperCase();
}
function checkersLbScoreFor(row, tab) {
    if (tab === 'wins') {
        return row.wins;
    }
    if (tab === 'streak') {
        return row.streak;
    }
    return row.rating;
}
async function loadCheckersLbWins() {
    checkersLbLoading.value = true;
    checkersLbError.value = null;
    try {
        checkersLbWinsRows.value = await fetchLeaderboardWins(CHECKERS_LB_Q);
    }
    catch {
        checkersLbError.value = t('nadleLeaderboard.loadError');
        checkersLbWinsRows.value = [];
    }
    finally {
        checkersLbLoading.value = false;
    }
}
async function loadCheckersLbStreak() {
    checkersLbLoading.value = true;
    checkersLbError.value = null;
    checkersLbViewerMaxStreak.value = undefined;
    try {
        const { entries, viewerMaxStreak } = await fetchLeaderboardStreak(CHECKERS_LB_Q);
        checkersLbStreakRows.value = entries;
        checkersLbViewerMaxStreak.value = viewerMaxStreak;
    }
    catch {
        checkersLbError.value = t('nadleLeaderboard.loadError');
        checkersLbStreakRows.value = [];
        checkersLbViewerMaxStreak.value = undefined;
    }
    finally {
        checkersLbLoading.value = false;
    }
}
async function loadCheckersLbRating() {
    checkersLbLoading.value = true;
    checkersLbError.value = null;
    try {
        checkersLbRatingRows.value = await fetchLeaderboardRating(CHECKERS_LB_Q);
    }
    catch {
        checkersLbError.value = t('nadleLeaderboard.loadError');
        checkersLbRatingRows.value = [];
    }
    finally {
        checkersLbLoading.value = false;
    }
}
async function loadCheckersLbActive() {
    if (leaderboardTab.value === 'wins') {
        await loadCheckersLbWins();
    }
    else if (leaderboardTab.value === 'streak') {
        await loadCheckersLbStreak();
    }
    else {
        await loadCheckersLbRating();
    }
}
watch(leaderboardTab, () => {
    void loadCheckersLbActive();
});
const checkersLbDisplayRows = computed(() => {
    if (leaderboardTab.value === 'wins') {
        return checkersLbWinsRows.value;
    }
    if (leaderboardTab.value === 'streak') {
        return checkersLbStreakRows.value;
    }
    return checkersLbRatingRows.value;
});
const checkersLbTableRows = computed(() => {
    const tab = leaderboardTab.value;
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
        }));
    }
    return checkersLbDisplayRows.value.map((row) => ({
        rowKey: `${tab}-${row.userId}-${row.rank}`,
        rank: row.rank,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        score: checkersLbScoreFor(row, tab),
        isSelf: checkersLbIsSelfRow(row),
        initials: checkersLbInitials(row.displayName),
    }));
});
const checkersLbScoreLabel = computed(() => {
    void locale.value;
    if (leaderboardTab.value === 'wins') {
        return t('nadleLeaderboard.scoreWins');
    }
    if (leaderboardTab.value === 'streak') {
        return t('nadleLeaderboard.scoreStreak');
    }
    return t('nadleLeaderboard.scoreRatingCheckers');
});
const checkersLbSelfStreakSummary = computed(() => {
    void locale.value;
    if (leaderboardTab.value !== 'streak' || !auth.user.value) {
        return null;
    }
    const v = checkersLbViewerMaxStreak.value;
    if (v === undefined) {
        return null;
    }
    return t('nadleLeaderboard.selfBestStreak', { n: v });
});
function cleanDisplayName(value) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 48) : '';
}
function readGuestDisplayName() {
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    const parsed = readStorageJson(storage, CHECKERS_GUEST_IDENTITY_KEY, {});
    return cleanDisplayName(parsed.displayName);
}
function saveGuestDisplayName(displayName) {
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    writeStorageJson(storage, CHECKERS_GUEST_IDENTITY_KEY, { displayName: cleanDisplayName(displayName) });
}
function readSignedInCheckersDisplay(userId) {
    if (!userId) {
        return '';
    }
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    const parsed = readStorageJson(storage, CHECKERS_SIGNED_DISPLAY_BY_USER_KEY, {});
    return cleanDisplayName(parsed[userId]);
}
function saveSignedInCheckersDisplay(userId, displayName) {
    if (!userId) {
        return;
    }
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    const parsed = readStorageJson(storage, CHECKERS_SIGNED_DISPLAY_BY_USER_KEY, {});
    const next = { ...parsed, [userId]: cleanDisplayName(displayName) };
    writeStorageJson(storage, CHECKERS_SIGNED_DISPLAY_BY_USER_KEY, next);
}
function readLocalPlayerNames() {
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    const parsed = readStorageJson(storage, CHECKERS_LOCAL_NAMES_KEY, {});
    return {
        white: cleanDisplayName(parsed.white),
        black: cleanDisplayName(parsed.black),
    };
}
function saveLocalPlayerNames(names) {
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    writeStorageJson(storage, CHECKERS_LOCAL_NAMES_KEY, {
        white: cleanDisplayName(names.white),
        black: cleanDisplayName(names.black),
    });
}
function readCheckersLeaderboard() {
    if (typeof localStorage === 'undefined')
        return {};
    try {
        const parsed = JSON.parse(localStorage.getItem('checkers:leaderboard:v1') || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch {
        return {};
    }
}
function saveCheckersLeaderboard(next) {
    leaderboardWins.value = next;
    try {
        localStorage.setItem('checkers:leaderboard:v1', JSON.stringify(next));
    }
    catch {
        /* ignore */
    }
}
function stopTurnTimer() {
    if (turnTimer) {
        clearInterval(turnTimer);
        turnTimer = null;
    }
}
function stopRematchCountdown() {
    if (rematchCountdownTimer) {
        clearInterval(rematchCountdownTimer);
        rematchCountdownTimer = null;
    }
}
function stopMatchmakingTimer() {
    if (matchmakingTimer) {
        clearInterval(matchmakingTimer);
        matchmakingTimer = null;
    }
}
function startMatchmakingTimer() {
    stopMatchmakingTimer();
    matchmakingSeconds.value = 0;
    matchmakingTimer = setInterval(() => {
        matchmakingSeconds.value += 1;
    }, 1000);
}
function flashYourTurn() {
    if (isStartOverlayVisible.value)
        return;
    if (!checkers.canMoveCurrentTurn.value)
        return;
    showYourTurn.value = true;
    if (yourTurnTimer)
        clearTimeout(yourTurnTimer);
    yourTurnTimer = setTimeout(() => {
        showYourTurn.value = false;
        yourTurnTimer = null;
    }, 2000);
}
function restartTurnTimer() {
    stopTurnTimer();
    turnSecondsLeft.value = TURN_SECONDS;
    if (checkers.displayState.value.winner || isStartOverlayVisible.value)
        return;
    turnTimer = setInterval(() => {
        turnSecondsLeft.value = Math.max(0, turnSecondsLeft.value - 1);
        if (turnSecondsLeft.value === 0) {
            stopTurnTimer();
            checkers.timeoutTurn();
        }
    }, 1000);
}
watch(() => `${checkers.displayState.value.turn}:${checkers.displayState.value.revision}:${checkers.mode.value}:${checkers.myRole.value}:${isStartOverlayVisible.value}`, () => {
    restartTurnTimer();
    flashYourTurn();
}, { immediate: true });
function shouldAutoRandomizeFriendRoom(rid) {
    const t = rid.trim();
    return !t || t === 'lobby';
}
function runCheckersModeReset(mode) {
    checkers.restartGame();
    if (mode !== 'rated') {
        checkers.setMode(mode);
    }
}
/** After `roomId` changes the WS reconnects; `restart` / `setMode` no-op until the socket is open. */
function scheduleRunCheckersModeReset(mode) {
    const gen = ++checkersRoomHandshakeGen;
    const stopRef = {};
    stopRef.stop = watch(() => checkers.wsStatus.value, (status) => {
        if (gen !== checkersRoomHandshakeGen) {
            queueMicrotask(() => stopRef.stop?.());
            return;
        }
        if (status !== 'open') {
            return;
        }
        queueMicrotask(() => {
            stopRef.stop?.();
            runCheckersModeReset(mode);
        });
    }, { immediate: true });
}
function consumeCheckersEntryDefaultModeQuery() {
    const raw = route.query[CHECKERS_DEFAULT_MODE_QUERY_KEY];
    const val = Array.isArray(raw) ? raw[0] : raw;
    if (val !== CHECKERS_DEFAULT_MODE_RATED_Q) {
        return;
    }
    selectedUiMode.value = 'rated';
    userChoseCheckersUiMode.value = true;
    const roomParam = route.params.roomId;
    const roomIdParam = Array.isArray(roomParam) ? roomParam[0] : roomParam;
    const nextQuery = { ...route.query };
    delete nextQuery[CHECKERS_DEFAULT_MODE_QUERY_KEY];
    void router.replace({
        name: 'checkers',
        params: { roomId: String(roomIdParam ?? 'lobby') },
        query: nextQuery,
    });
}
watch(() => route.query[CHECKERS_DEFAULT_MODE_QUERY_KEY], () => {
    consumeCheckersEntryDefaultModeQuery();
}, { immediate: true });
watch(roomId, (id) => {
    const slug = (id || '').trim();
    if (!slug || slug === 'lobby') {
        return;
    }
    if (checkersFriendSlugSet().has(slug)) {
        selectedUiMode.value = 'friend';
        userChoseCheckersUiMode.value = true;
    }
}, { immediate: true });
watch(roomId, () => {
    hasStartedCurrentGame.value = false;
    if (expectFriendRestartAfterRoute) {
        expectFriendRestartAfterRoute = false;
        scheduleRunCheckersModeReset('friend');
    }
});
watch([selectedUiMode, roomId], ([ui, rid]) => {
    if (ui !== 'friend' || rid !== 'lobby') {
        return;
    }
    if (expectFriendRestartAfterRoute) {
        return;
    }
    expectFriendRestartAfterRoute = true;
    const next = generateCallRoomCode();
    addCheckersFriendSlug(next);
    void router.replace({ name: 'checkers', params: { roomId: next } });
});
watch(() => ({
    rid: roomId.value,
    ws: checkers.wsStatus.value,
    synced: checkers.serverModeSynced.value,
    mode: checkers.mode.value,
    rated: checkers.isRatedMatch.value,
}), ({ rid, ws, synced, mode, rated }) => {
    if (!rid || ws !== 'open' || !synced) {
        return;
    }
    if (rated) {
        removeCheckersFriendSlug(rid);
        return;
    }
    if (mode === 'friend') {
        return;
    }
    if (!checkersFriendSlugSet().has(rid)) {
        return;
    }
    checkers.setMode('friend');
});
watch(displayNameDraft, (displayName) => {
    const userId = auth.user.value?.dbUserId;
    if (userId) {
        saveSignedInCheckersDisplay(userId, displayName);
        return;
    }
    saveGuestDisplayName(displayName);
});
watch(() => [auth.loaded.value, auth.user.value?.dbUserId ?? ''], ([loaded, userId], prev) => {
    if (!loaded) {
        return;
    }
    const prevTuple = prev;
    if (prevTuple && loaded === prevTuple[0] && userId === prevTuple[1]) {
        return;
    }
    if (userId) {
        const fromProfile = cleanDisplayName(auth.user.value?.displayName);
        displayNameDraft.value = readSignedInCheckersDisplay(userId) || fromProfile;
    }
    else {
        displayNameDraft.value = readGuestDisplayName();
    }
}, { immediate: true });
watch(localPlayerDrafts, (names) => {
    saveLocalPlayerNames(names);
}, { deep: true });
watch(friendRoomReady, (ready) => {
    if (selectedUiMode.value !== 'friend' || !ready)
        return;
    hasStartedCurrentGame.value = true;
    restartTurnTimer();
}, { immediate: true });
watch(() => ({
    mode: checkers.mode.value,
    rated: checkers.isRatedMatch.value,
    synced: checkers.serverModeSynced.value,
}), ({ mode, rated, synced }) => {
    if (rated) {
        selectedUiMode.value = 'rated';
        return;
    }
    if (selectedUiMode.value === 'rated') {
        return;
    }
    if (!synced) {
        return;
    }
    if (!userChoseCheckersUiMode.value) {
        selectedUiMode.value = mode;
        return;
    }
    if ((selectedUiMode.value === 'friend' && mode !== 'friend') ||
        (selectedUiMode.value === 'local' && mode !== 'local') ||
        (selectedUiMode.value === 'bot' && mode !== 'bot')) {
        return;
    }
    selectedUiMode.value = mode;
});
watch(() => checkers.isRatedMatch.value, (rated) => {
    if (rated) {
        hasStartedCurrentGame.value = true;
    }
}, { immediate: true });
function unlockRemoteAudio() {
    remoteAudioUnlocked.value = true;
    playAllPageAudio();
}
function onAudioGesture() {
    unlockRemoteAudio();
}
function teardownAudioGestureUnlock() {
    if (typeof window === 'undefined')
        return;
    window.removeEventListener('pointerdown', onAudioGesture, true);
    window.removeEventListener('keydown', onAudioGesture, true);
}
function onDocumentPointerDown(event) {
    const target = event.target;
    if (!(target instanceof Node))
        return;
    if (audioControlsOpen.value && !audioControlsRoot.value?.contains(target)) {
        audioControlsOpen.value = false;
    }
}
onMounted(() => {
    if (typeof window === 'undefined')
        return;
    prepareCheckersNadleChatWs();
    void auth.ensureAuthLoaded();
    void loadCheckersLbActive();
    preloadMatchFoundSound();
    void refreshBotDifficulty();
    window.addEventListener('pointerdown', onAudioGesture, { capture: true });
    window.addEventListener('keydown', onAudioGesture, { capture: true });
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    scheduleVoiceDockAnchorUpdate();
    window.addEventListener('resize', scheduleVoiceDockAnchorUpdate);
    window.addEventListener('scroll', scheduleVoiceDockAnchorUpdate, true);
    void nextTick(() => {
        const el = resolveVoiceDockAnchorEl();
        if (typeof ResizeObserver !== 'undefined') {
            voiceDockResizeObserver = new ResizeObserver(() => scheduleVoiceDockAnchorUpdate());
            if (el)
                voiceDockResizeObserver.observe(el);
        }
        scheduleVoiceDockAnchorUpdate();
    });
});
onUnmounted(() => {
    teardownVoiceDockAnchor();
    disposeCheckersNadleChatWs();
    stopTurnTimer();
    stopRematchCountdown();
    stopMatchmakingTimer();
    if (yourTurnTimer)
        clearTimeout(yourTurnTimer);
    if (matchRedirectTimer)
        clearTimeout(matchRedirectTimer);
    cancelMatchmaking();
    teardownAudioGestureUnlock();
    checkersVoice.leaveCall();
    if (typeof window !== 'undefined') {
        window.removeEventListener('resize', scheduleVoiceDockAnchorUpdate);
        window.removeEventListener('scroll', scheduleVoiceDockAnchorUpdate, true);
    }
    if (typeof document !== 'undefined') {
        document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    }
});
watch(() => auth.user.value?.dbUserId, () => {
    void refreshBotDifficulty();
});
watch(() => ({
    winner: checkers.displayState.value.winner,
    revision: checkers.displayState.value.revision,
}), ({ winner, revision }) => {
    if (!winner) {
        ratingDelta.value = null;
    }
    if (!winner || recordedWinnerRevision.value === revision)
        return;
    recordedWinnerRevision.value = revision;
    const label = winner === 'player1' ? playerOneLabel.value : playerTwoLabel.value;
    saveCheckersLeaderboard({
        ...leaderboardWins.value,
        [label]: (leaderboardWins.value[label] ?? 0) + 1,
    });
    void submitCheckersMatchResult(revision);
});
watch(shouldShowAutoRematchCountdown, (show) => {
    stopRematchCountdown();
    if (!show)
        return;
    rematchCountdown.value = 5;
    rematchCountdownTimer = setInterval(() => {
        rematchCountdown.value = Math.max(0, rematchCountdown.value - 1);
        if (rematchCountdown.value === 0) {
            stopRematchCountdown();
        }
    }, 1000);
}, { immediate: true });
function setGameMode(mode) {
    if (matchmakingState.value !== 'idle')
        return;
    if (mode === selectedUiMode.value)
        return;
    if (isActiveGame.value) {
        pendingModeChange.value = mode;
        return;
    }
    applyGameModeChange(mode);
}
function applyGameModeChange(mode) {
    pendingModeChange.value = null;
    userChoseCheckersUiMode.value = true;
    selectedUiMode.value = mode;
    hasStartedCurrentGame.value = false;
    showYourTurn.value = false;
    matchmakingError.value = '';
    ratingDelta.value = null;
    stopTurnTimer();
    stopMatchmakingTimer();
    cancelMatchmaking();
    if (mode === 'bot' || mode === 'local') {
        removeCheckersFriendSlug(roomId.value);
    }
    if (mode === 'friend' && shouldAutoRandomizeFriendRoom(roomId.value)) {
        const next = generateCallRoomCode();
        addCheckersFriendSlug(next);
        expectFriendRestartAfterRoute = true;
        void router.replace({ name: 'checkers', params: { roomId: next } });
        return;
    }
    if (mode === 'friend') {
        addCheckersFriendSlug(roomId.value);
    }
    scheduleRunCheckersModeReset(mode);
}
function confirmModeChange() {
    const mode = pendingModeChange.value;
    if (!mode)
        return;
    applyGameModeChange(mode);
}
function cancelModeChange() {
    pendingModeChange.value = null;
}
function startCurrentGame() {
    if (needsGuestNickname.value) {
        saveGuestDisplayName(displayNameDraft.value);
        return;
    }
    if (selectedUiMode.value === 'rated') {
        void findMatch();
        return;
    }
    if (selectedUiMode.value === 'friend') {
        if (checkers.readyPending.value)
            return;
        checkers.setReady(!myReady.value);
        return;
    }
    if (selectedUiMode.value === 'local' && !hasLocalPlayerNames.value) {
        return;
    }
    hasStartedCurrentGame.value = true;
    restartTurnTimer();
    flashYourTurn();
}
function difficultyForRating(rating) {
    if (rating < 1000)
        return 'easy';
    if (rating > 1400)
        return 'hard';
    return 'medium';
}
async function refreshBotDifficulty() {
    const userId = auth.user.value?.dbUserId;
    if (!userId) {
        botDifficulty.value = 'medium';
        return;
    }
    const res = await apiFetch('/api/leaderboard/rating?game=checkers').catch(() => null);
    if (!res)
        return;
    const data = await readJsonIfOk(res);
    const entry = data?.entries?.find((row) => row.userId === userId);
    botDifficulty.value = difficultyForRating(typeof entry?.rating === 'number' ? entry.rating : 1200);
}
function preloadMatchFoundSound() {
    if (typeof window === 'undefined')
        return;
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor)
        return;
    audioContext ??= new AudioContextCtor();
}
function playMatchFoundSound() {
    if (matchFoundFeedbackPlayed || typeof window === 'undefined')
        return;
    matchFoundFeedbackPlayed = true;
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor)
        return;
    audioContext ??= new AudioContextCtor();
    const ctx = audioContext;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.24);
    gain.connect(ctx.destination);
    for (const [index, frequency] of [523, 784].entries()) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        osc.connect(gain);
        osc.start(ctx.currentTime + index * 0.055);
        osc.stop(ctx.currentTime + 0.24);
    }
}
function cancelMatchmaking() {
    if (matchmakingState.value !== 'searching') {
        return;
    }
    matchmakingAbort?.abort();
    matchmakingAbort = null;
    stopMatchmakingTimer();
    matchmakingSeconds.value = 0;
    matchmakingState.value = 'idle';
    if (selectedUiMode.value === 'rated') {
        hasStartedCurrentGame.value = false;
    }
    void apiFetch('/api/matchmaking/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: readCheckersClientId() }),
    }).catch(() => { });
}
async function findMatch() {
    if (matchmakingState.value !== 'idle') {
        return;
    }
    matchmakingState.value = 'searching';
    matchmakingError.value = '';
    startMatchmakingTimer();
    matchFoundFeedbackPlayed = false;
    const clientId = readCheckersClientId();
    const abort = new AbortController();
    matchmakingAbort = abort;
    try {
        while (!abort.signal.aborted) {
            const res = await apiFetch('/api/matchmaking/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId }),
                signal: abort.signal,
            });
            const data = await readJsonIfOk(res);
            const matchRoomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
            if (matchRoomId) {
                matchmakingState.value = 'matched';
                matchmakingAbort = null;
                stopMatchmakingTimer();
                playMatchFoundSound();
                matchRedirectTimer = setTimeout(() => {
                    matchRedirectTimer = null;
                    void router.push({ name: 'checkers', params: { roomId: matchRoomId } }).finally(() => {
                        hasStartedCurrentGame.value = true;
                        matchmakingState.value = 'idle';
                    });
                }, 850);
                return;
            }
            if (!res.ok && res.status !== 202 && res.status !== 409) {
                throw new Error('matchmaking_failed');
            }
        }
    }
    catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
            matchmakingError.value = isUkLocale.value
                ? 'Не вдалося знайти гру. Спробуй ще раз.'
                : 'Could not find a match. Try again.';
            if (selectedUiMode.value === 'rated') {
                hasStartedCurrentGame.value = false;
            }
        }
    }
    finally {
        if (matchmakingAbort === abort) {
            matchmakingAbort = null;
        }
        stopMatchmakingTimer();
        if (matchmakingState.value === 'searching') {
            matchmakingState.value = 'idle';
        }
    }
}
async function submitCheckersMatchResult(revision) {
    const room = checkers.roomId.value.trim();
    if (!room || !checkers.isRatedMatch.value) {
        return;
    }
    const res = await apiFetch('/api/matchmaking/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room, revision }),
    }).catch(() => { });
    if (!res)
        return;
    const data = await readJsonIfOk(res);
    if (typeof data?.ratingDelta === 'number') {
        ratingDelta.value = Math.round(data.ratingDelta);
    }
    void refreshBotDifficulty();
}
function toggleCheckersMic() {
    unlockRemoteAudio();
    if (!isCheckersPlayer.value) {
        if (checkersVoice.micEnabled.value) {
            checkersVoice.toggleMic();
        }
        return;
    }
    checkersVoice.toggleMic();
}
function toggleRemoteListenMuted() {
    remoteListenMuted.value = !remoteListenMuted.value;
}
watch(checkersVoiceDisplayName, (displayName) => {
    checkersVoice.session.selfDisplayName = displayName;
}, { immediate: true });
let checkersVoiceJoinSeq = 0;
const checkersVoiceJoinKey = computed(() => `${checkers.state.value ? 1 : 0}|${checkersVoiceRole.value}|${checkersVoiceRoomId.value}`);
watch(checkersVoiceJoinKey, async () => {
    const ready = Boolean(checkers.state.value);
    const roomIdVoice = checkersVoiceRoomId.value;
    const seq = ++checkersVoiceJoinSeq;
    checkersVoice.leaveCall();
    remoteAudioUnlocked.value = false;
    await nextTick();
    if (seq !== checkersVoiceJoinSeq || !ready || !roomIdVoice) {
        return;
    }
    checkersVoice.session.roomId = roomIdVoice;
    checkersVoice.session.selfDisplayName = checkersVoiceDisplayName.value;
    await checkersVoice.joinCall();
}, { immediate: true, flush: 'post' });
watch(isCheckersPlayer, (canSpeak) => {
    if (!canSpeak && checkersVoice.micEnabled.value) {
        checkersVoice.toggleMic();
    }
}, { immediate: true });
function cleanCheckersRoomSlug(raw) {
    return raw.trim().slice(0, 80);
}
const friendInviteRoomDraft = ref('');
watch(roomId, (id) => {
    friendInviteRoomDraft.value = id || '';
}, { immediate: true });
const friendInvitePreviewUrl = computed(() => {
    const code = cleanCheckersRoomSlug(friendInviteRoomDraft.value) || checkers.roomId.value || 'checkers';
    const path = `/app/checkers/${encodeURIComponent(code)}`;
    if (typeof window === 'undefined') {
        return path;
    }
    return new URL(path, window.location.origin).href;
});
function applyFriendRoomFromOverlay() {
    const next = cleanCheckersRoomSlug(friendInviteRoomDraft.value);
    if (!next || next === roomId.value) {
        return;
    }
    addCheckersFriendSlug(next);
    expectFriendRestartAfterRoute = true;
    void router.push({ name: 'checkers', params: { roomId: next } });
}
function randomizeFriendRoomCode() {
    friendInviteRoomDraft.value = generateCallRoomCode();
}
function copyFriendInvitePreview() {
    void navigator.clipboard.writeText(friendInvitePreviewUrl.value).then(() => {
        copiedInvite.value = true;
        roomCopyFlash.value = true;
        window.setTimeout(() => {
            copiedInvite.value = false;
            roomCopyFlash.value = false;
        }, 1800);
    }, () => {
        copiedInvite.value = false;
        roomCopyFlash.value = false;
    });
}
let audioContext = null;
let lastSoundAt = 0;
function playUiTone(kind) {
    if (typeof window === 'undefined') {
        return;
    }
    const now = performance.now();
    if (now - lastSoundAt < 55) {
        return;
    }
    lastSoundAt = now;
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) {
        return;
    }
    audioContext ??= new AudioContextCtor();
    const ctx = audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const frequency = kind === 'capture' ? 180 : kind === 'move' ? 440 : 620;
    osc.type = kind === 'capture' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === 'capture' ? 0.16 : 0.09));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (kind === 'capture' ? 0.18 : 0.11));
}
function handleCellClick(pos) {
    if (matchmakingState.value !== 'idle' || isStartOverlayVisible.value) {
        return;
    }
    const current = checkers.state.value;
    const selected = checkers.selected.value;
    if (!checkers.canMoveCurrentTurn.value) {
        return;
    }
    if (!current) {
        checkers.selectCell(pos);
        return;
    }
    const validMove = selected ? getValidMove(current, selected, pos) : null;
    const piece = current.board[pos.row]?.[pos.col];
    if (validMove) {
        playUiTone(validMove.captured ? 'capture' : 'move');
    }
    else if (piece?.player === current.turn && getLegalMoves(current, pos).length > 0) {
        playUiTone('select');
    }
    checkers.selectCell(pos);
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-board-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-turn-hud__timer--low']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-find-match']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-find-match']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-sidebar-nick']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mode-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mode-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mode-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-room-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-room-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-room-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-start-game-field']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-friend-invite__room-pop']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-local-name-input']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-ready-list']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-start-game-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-start-game-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-start-game-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-auto-rematch']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-voice-dock']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-voice-dock']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-audio-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-headphones-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mic-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mic-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mic-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mic-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mic-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mic-button--speaking']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mic-button--speaking']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mic-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-matchmaking-dots']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-matchmaking-dots']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--checkers']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-route']} */ ;
/** @type {__VLS_StyleScopedClasses['page-route__body']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-board-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-game-triptych__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['page-route']} */ ;
/** @type {__VLS_StyleScopedClasses['page-route__body']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--checkers']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-route']} */ ;
/** @type {__VLS_StyleScopedClasses['page-route__body']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-game-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__guess-focus-anchor']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-board-shell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-route" },
    ...{ class: ({
            'page-route--matchmaking': __VLS_ctx.matchmakingState === 'searching',
            'page-route--matched': __VLS_ctx.matchmakingState === 'matched',
        }) },
});
/** @type {__VLS_StyleScopedClasses['page-route']} */ ;
/** @type {__VLS_StyleScopedClasses['page-route--matchmaking']} */ ;
/** @type {__VLS_StyleScopedClasses['page-route--matched']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-route__body" },
});
/** @type {__VLS_StyleScopedClasses['page-route__body']} */ ;
const __VLS_0 = AppContainer || AppContainer;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    wide: true,
    flush: true,
    ...{ class: "nadle-page nadle-page--len5 nadle-page--checkers sa-game-triptych" },
}));
const __VLS_2 = __VLS_1({
    wide: true,
    flush: true,
    ...{ class: "nadle-page nadle-page--len5 nadle-page--checkers sa-game-triptych" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len5']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--checkers']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-game-triptych']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadle-page__grid sa-game-triptych__grid h-full min-h-0" },
});
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-game-triptych__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
const __VLS_6 = AppCard || AppCard;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    ...{ class: "nadle-page__stack nadle-page__stack--side nadle-page__stack--leader" },
}));
const __VLS_8 = __VLS_7({
    ...{ class: "nadle-page__stack nadle-page__stack--side nadle-page__stack--leader" },
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--side']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
const { default: __VLS_11 } = __VLS_9.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadle-page__leader-stack" },
});
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "checkers-room-meta" },
    'aria-label': "Checkers room status",
});
/** @type {__VLS_StyleScopedClasses['checkers-room-meta']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "checkers-mode-icons" },
    'aria-label': "Game mode",
});
/** @type {__VLS_StyleScopedClasses['checkers-mode-icons']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setGameMode('friend');
            // @ts-ignore
            [matchmakingState, matchmakingState, setGameMode,];
        } },
    type: "button",
    ...{ class: "checkers-mode-icon" },
    ...{ class: ({ 'checkers-mode-icon--active': __VLS_ctx.selectedUiMode === 'friend' }) },
    disabled: (__VLS_ctx.matchmakingState !== 'idle'),
    title: (__VLS_ctx.checkersUi.modeFriend),
    'aria-label': (__VLS_ctx.checkersUi.modeFriend),
});
/** @type {__VLS_StyleScopedClasses['checkers-mode-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mode-icon--active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 24 24",
    'aria-hidden': "true",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.7-3 2.5-5 4.5-5s3.8 2 4.5 5H3.5Zm8 0c.5-1.8 1.3-3.3 2.4-4.2.6-.5 1.3-.8 2.1-.8 2 0 3.8 2 4.5 5h-9Z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setGameMode('bot');
            // @ts-ignore
            [matchmakingState, setGameMode, selectedUiMode, checkersUi, checkersUi,];
        } },
    type: "button",
    ...{ class: "checkers-mode-icon" },
    ...{ class: ({ 'checkers-mode-icon--active': __VLS_ctx.selectedUiMode === 'bot' }) },
    disabled: (__VLS_ctx.matchmakingState !== 'idle'),
    title: (__VLS_ctx.checkersUi.modeBot),
    'aria-label': (__VLS_ctx.checkersUi.modeBot),
});
/** @type {__VLS_StyleScopedClasses['checkers-mode-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mode-icon--active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 24 24",
    'aria-hidden': "true",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M11 3h2v3h3a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4h3V3Zm-3 5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H8Zm1.5 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setGameMode('local');
            // @ts-ignore
            [matchmakingState, setGameMode, selectedUiMode, checkersUi, checkersUi,];
        } },
    type: "button",
    ...{ class: "checkers-mode-icon" },
    ...{ class: ({ 'checkers-mode-icon--active': __VLS_ctx.selectedUiMode === 'local' }) },
    disabled: (__VLS_ctx.matchmakingState !== 'idle'),
    title: (__VLS_ctx.checkersUi.modeLocal),
    'aria-label': (__VLS_ctx.checkersUi.modeLocal),
});
/** @type {__VLS_StyleScopedClasses['checkers-mode-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mode-icon--active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 24 24",
    'aria-hidden': "true",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6v2h3v2H7v-2h3v-2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v9h16V7H4Z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setGameMode('rated');
            // @ts-ignore
            [matchmakingState, setGameMode, selectedUiMode, checkersUi, checkersUi,];
        } },
    type: "button",
    ...{ class: "checkers-find-match" },
    disabled: (__VLS_ctx.matchmakingState !== 'idle'),
});
/** @type {__VLS_StyleScopedClasses['checkers-find-match']} */ ;
(__VLS_ctx.checkersUi.ratedCta);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "checkers-sidebar-nick checkers-start-game-field" },
});
/** @type {__VLS_StyleScopedClasses['checkers-sidebar-nick']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-start-game-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.checkersUi.nicknameField);
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    value: (__VLS_ctx.displayNameDraft),
    type: "text",
    maxlength: "48",
    autocomplete: "nickname",
    disabled: (!__VLS_ctx.auth.loaded),
});
if (__VLS_ctx.matchmakingError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "checkers-room-meta__error" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-room-meta__error']} */ ;
    (__VLS_ctx.matchmakingError);
}
const __VLS_12 = NadleGlobalLeaderboardTable;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
    tab: (__VLS_ctx.leaderboardTab),
    loading: (__VLS_ctx.checkersLbLoading),
    error: (__VLS_ctx.checkersLbError),
    rows: (__VLS_ctx.checkersLbTableRows),
    scoreColumnHeader: (__VLS_ctx.checkersLbScoreLabel),
    selfStreakSummary: (__VLS_ctx.checkersLbSelfStreakSummary),
    sectionAriaLabel: "Checkers leaderboard",
    title: (__VLS_ctx.t('nadleLeaderboard.title')),
    tabsAriaLabel: (__VLS_ctx.t('nadleLeaderboard.tabsAria')),
    tabWinsLabel: (__VLS_ctx.t('nadleLeaderboard.tabWins')),
    tabStreakLabel: (__VLS_ctx.t('nadleLeaderboard.tabStreak')),
    tabRatingLabel: (__VLS_ctx.t('nadleLeaderboard.tabRating')),
    loadingText: (__VLS_ctx.t('nadleLeaderboard.loading')),
    emptyText: (__VLS_ctx.t('nadleLeaderboard.empty')),
    colRank: (__VLS_ctx.t('nadleLeaderboard.colRank')),
    colPlayer: (__VLS_ctx.checkersUi.lbColPlayer),
    youLabel: (__VLS_ctx.checkersUi.lbYou),
}));
const __VLS_14 = __VLS_13({
    tab: (__VLS_ctx.leaderboardTab),
    loading: (__VLS_ctx.checkersLbLoading),
    error: (__VLS_ctx.checkersLbError),
    rows: (__VLS_ctx.checkersLbTableRows),
    scoreColumnHeader: (__VLS_ctx.checkersLbScoreLabel),
    selfStreakSummary: (__VLS_ctx.checkersLbSelfStreakSummary),
    sectionAriaLabel: "Checkers leaderboard",
    title: (__VLS_ctx.t('nadleLeaderboard.title')),
    tabsAriaLabel: (__VLS_ctx.t('nadleLeaderboard.tabsAria')),
    tabWinsLabel: (__VLS_ctx.t('nadleLeaderboard.tabWins')),
    tabStreakLabel: (__VLS_ctx.t('nadleLeaderboard.tabStreak')),
    tabRatingLabel: (__VLS_ctx.t('nadleLeaderboard.tabRating')),
    loadingText: (__VLS_ctx.t('nadleLeaderboard.loading')),
    emptyText: (__VLS_ctx.t('nadleLeaderboard.empty')),
    colRank: (__VLS_ctx.t('nadleLeaderboard.colRank')),
    colPlayer: (__VLS_ctx.checkersUi.lbColPlayer),
    youLabel: (__VLS_ctx.checkersUi.lbYou),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
// @ts-ignore
[matchmakingState, checkersUi, checkersUi, checkersUi, checkersUi, displayNameDraft, auth, matchmakingError, matchmakingError, leaderboardTab, checkersLbLoading, checkersLbError, checkersLbTableRows, checkersLbScoreLabel, checkersLbSelfStreakSummary, t, t, t, t, t, t, t, t,];
var __VLS_9;
const __VLS_17 = AppCard || AppCard;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
    ref: "checkersGameStackRef",
    ...{ class: "nadle-page__stack nadle-page__stack--game checkers-game-stack" },
}));
const __VLS_19 = __VLS_18({
    ref: "checkersGameStackRef",
    ...{ class: "nadle-page__stack nadle-page__stack--game checkers-game-stack" },
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
var __VLS_22 = {};
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-game-stack']} */ ;
const { default: __VLS_24 } = __VLS_20.slots;
if (__VLS_ctx.isActiveGame) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkers-turn-hud" },
        role: "status",
        'aria-live': "polite",
        'aria-label': (`${__VLS_ctx.checkersUi.metaTurn}: ${__VLS_ctx.turnLabel}. ${__VLS_ctx.checkersUi.metaTimer}: ${__VLS_ctx.turnTimerLabel}`),
    });
    /** @type {__VLS_StyleScopedClasses['checkers-turn-hud']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "checkers-turn-hud__item" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-turn-hud__item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "checkers-turn-hud__value" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-turn-hud__value']} */ ;
    (__VLS_ctx.turnLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "checkers-turn-hud__divider" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['checkers-turn-hud__divider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "checkers-turn-hud__item" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-turn-hud__item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "checkers-turn-hud__value checkers-turn-hud__value--mono" },
        ...{ class: ({ 'checkers-turn-hud__timer--low': __VLS_ctx.isTurnTimerLow }) },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-turn-hud__value']} */ ;
    /** @type {__VLS_StyleScopedClasses['checkers-turn-hud__value--mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['checkers-turn-hud__timer--low']} */ ;
    (__VLS_ctx.turnTimerLabel);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "checkersGameContentRef",
    ...{ class: "nadle-page__game" },
});
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadle-page__guess-focus-anchor checkers-board-shell" },
});
/** @type {__VLS_StyleScopedClasses['nadle-page__guess-focus-anchor']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-board-shell']} */ ;
const __VLS_25 = CheckersBoard;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
    ...{ 'onCellClick': {} },
    board: (__VLS_ctx.checkers.board.value),
    selected: (__VLS_ctx.checkers.selected.value),
    validDestinations: (__VLS_ctx.checkers.validDestinations.value),
    captureDestinations: (__VLS_ctx.checkers.captureDestinations.value),
    winningMove: (__VLS_ctx.winningMove),
    flipped: (__VLS_ctx.boardFlipped),
}));
const __VLS_27 = __VLS_26({
    ...{ 'onCellClick': {} },
    board: (__VLS_ctx.checkers.board.value),
    selected: (__VLS_ctx.checkers.selected.value),
    validDestinations: (__VLS_ctx.checkers.validDestinations.value),
    captureDestinations: (__VLS_ctx.checkers.captureDestinations.value),
    winningMove: (__VLS_ctx.winningMove),
    flipped: (__VLS_ctx.boardFlipped),
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
let __VLS_30;
const __VLS_31 = ({ cellClick: {} },
    { onCellClick: (__VLS_ctx.handleCellClick) });
var __VLS_28;
var __VLS_29;
let __VLS_32;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
    name: "checkers-start-game",
}));
const __VLS_34 = __VLS_33({
    name: "checkers-start-game",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
const { default: __VLS_37 } = __VLS_35.slots;
if (__VLS_ctx.isStartOverlayVisible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkers-start-game-overlay" },
        role: "dialog",
        'aria-modal': "true",
        'aria-labelledby': "checkers-start-game-title",
    });
    /** @type {__VLS_StyleScopedClasses['checkers-start-game-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkers-start-game-card" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-start-game-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        id: "checkers-start-game-title",
        ...{ class: "checkers-start-game-title" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-start-game-title']} */ ;
    if (__VLS_ctx.needsGuestNickname) {
        (__VLS_ctx.checkersUi.overlayGuestTitle);
    }
    else if (__VLS_ctx.selectedUiMode === 'rated') {
        (__VLS_ctx.checkersUi.modeRated);
    }
    else if (__VLS_ctx.selectedUiMode === 'friend') {
        (__VLS_ctx.checkersUi.modeFriend);
    }
    else if (__VLS_ctx.selectedUiMode === 'local') {
        (__VLS_ctx.checkersUi.modeLocal);
    }
    else {
        (__VLS_ctx.checkersUi.modeBot);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "checkers-start-game-copy" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-start-game-copy']} */ ;
    if (__VLS_ctx.needsGuestNickname) {
        (__VLS_ctx.checkersUi.overlayGuestCopy);
    }
    else if (__VLS_ctx.matchmakingState === 'matched') {
        (__VLS_ctx.checkersUi.overlayMatched);
    }
    else if (__VLS_ctx.matchmakingState === 'searching') {
        (__VLS_ctx.checkersUi.overlaySearching);
        (__VLS_ctx.matchmakingSeconds);
        (__VLS_ctx.checkersUi.searchingSecondsSuffix);
    }
    else if (__VLS_ctx.selectedUiMode === 'rated') {
        (__VLS_ctx.checkersUi.overlayRatedCopy);
    }
    else if (__VLS_ctx.selectedUiMode === 'friend') {
        (__VLS_ctx.checkersUi.overlayFriendCopy);
    }
    else if (__VLS_ctx.selectedUiMode === 'local') {
        (__VLS_ctx.checkersUi.overlayLocalCopy);
    }
    else {
        (__VLS_ctx.checkersUi.overlayBotCopy);
    }
    if (__VLS_ctx.needsGuestNickname) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "checkers-start-game-field" },
        });
        /** @type {__VLS_StyleScopedClasses['checkers-start-game-field']} */ ;
        (__VLS_ctx.checkersUi.nicknameField);
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.displayNameDraft),
            type: "text",
            autocomplete: "nickname",
            maxlength: "48",
        });
    }
    else if (__VLS_ctx.selectedUiMode === 'friend') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "checkers-friend-invite" },
        });
        /** @type {__VLS_StyleScopedClasses['checkers-friend-invite']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "call-page__room-pop-code checkers-friend-invite__room-pop" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__room-pop-code']} */ ;
        /** @type {__VLS_StyleScopedClasses['checkers-friend-invite__room-pop']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "call-page__room-pop-label" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__room-pop-label']} */ ;
        (__VLS_ctx.checkersUi.roomCodeField);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "call-page__room-pop-code-row" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__room-pop-code-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onKeydown: (__VLS_ctx.applyFriendRoomFromOverlay) },
            value: (__VLS_ctx.friendInviteRoomDraft),
            ...{ class: "call-page__room-pop-code-input" },
            type: "text",
            maxlength: "80",
            autocomplete: "off",
        });
        /** @type {__VLS_StyleScopedClasses['call-page__room-pop-code-input']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "call-page__room-pop-code-tools" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__room-pop-code-tools']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "call-page__room-pop-copy-wrap" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__room-pop-copy-wrap']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.copyFriendInvitePreview) },
            type: "button",
            ...{ class: "call-page__room-pop-ico-btn" },
            title: (__VLS_ctx.roomCopyFlash ? __VLS_ctx.t('callPage.roomCodeCopied') : __VLS_ctx.t('callPage.roomCopy')),
            'aria-label': (__VLS_ctx.roomCopyFlash ? __VLS_ctx.t('callPage.roomCodeCopied') : __VLS_ctx.t('callPage.roomCopy')),
        });
        /** @type {__VLS_StyleScopedClasses['call-page__room-pop-ico-btn']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            xmlns: "http://www.w3.org/2000/svg",
            width: "18",
            height: "18",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            'stroke-width': "2",
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            'aria-hidden': "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
            width: "14",
            height: "14",
            x: "8",
            y: "8",
            rx: "2",
            ry: "2",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            role: "status",
            'aria-live': "polite",
            ...{ class: "call-page__room-pop-copy-tooltip" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.roomCopyFlash) }, null, null);
        /** @type {__VLS_StyleScopedClasses['call-page__room-pop-copy-tooltip']} */ ;
        (__VLS_ctx.t('callPage.roomCodeCopied'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.randomizeFriendRoomCode) },
            type: "button",
            ...{ class: "call-page__room-pop-ico-btn" },
            title: (__VLS_ctx.t('callPage.roomGenerateNew')),
            'aria-label': (__VLS_ctx.t('callPage.roomRegenerateAria')),
        });
        /** @type {__VLS_StyleScopedClasses['call-page__room-pop-ico-btn']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            xmlns: "http://www.w3.org/2000/svg",
            width: "18",
            height: "18",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            'stroke-width': "2",
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            'aria-hidden': "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
            width: "16",
            height: "16",
            x: "4",
            y: "4",
            rx: "2.5",
            ry: "2.5",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
            cx: "9",
            cy: "9",
            r: "1.1",
            fill: "currentColor",
            stroke: "none",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
            cx: "15",
            cy: "9",
            r: "1.1",
            fill: "currentColor",
            stroke: "none",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
            cx: "9",
            cy: "15",
            r: "1.1",
            fill: "currentColor",
            stroke: "none",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
            cx: "15",
            cy: "15",
            r: "1.1",
            fill: "currentColor",
            stroke: "none",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "checkers-friend-invite__link-row" },
        });
        /** @type {__VLS_StyleScopedClasses['checkers-friend-invite__link-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.checkersUi.linkLabel);
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
            ...{ class: "checkers-friend-invite__url" },
        });
        /** @type {__VLS_StyleScopedClasses['checkers-friend-invite__url']} */ ;
        (__VLS_ctx.friendInvitePreviewUrl);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "checkers-friend-invite__actions checkers-friend-invite__actions--solo" },
        });
        /** @type {__VLS_StyleScopedClasses['checkers-friend-invite__actions']} */ ;
        /** @type {__VLS_StyleScopedClasses['checkers-friend-invite__actions--solo']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.applyFriendRoomFromOverlay) },
            type: "button",
            ...{ class: "checkers-start-game-secondary checkers-friend-invite__apply" },
            disabled: (!__VLS_ctx.cleanCheckersRoomSlug(__VLS_ctx.friendInviteRoomDraft) ||
                __VLS_ctx.cleanCheckersRoomSlug(__VLS_ctx.friendInviteRoomDraft) === __VLS_ctx.roomId),
        });
        /** @type {__VLS_StyleScopedClasses['checkers-start-game-secondary']} */ ;
        /** @type {__VLS_StyleScopedClasses['checkers-friend-invite__apply']} */ ;
        (__VLS_ctx.checkersUi.applyFriendRoom);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "checkers-ready-list" },
        });
        /** @type {__VLS_StyleScopedClasses['checkers-ready-list']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: ({ 'checkers-ready-list__item--ready': __VLS_ctx.whiteSeatReady }) },
        });
        /** @type {__VLS_StyleScopedClasses['checkers-ready-list__item--ready']} */ ;
        (__VLS_ctx.playerOneLabel);
        (__VLS_ctx.whiteSeatReady ? __VLS_ctx.checkersUi.readyOn : __VLS_ctx.checkersUi.readyOff);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: ({ 'checkers-ready-list__item--ready': __VLS_ctx.blackSeatReady }) },
        });
        /** @type {__VLS_StyleScopedClasses['checkers-ready-list__item--ready']} */ ;
        (__VLS_ctx.playerTwoLabel);
        (__VLS_ctx.blackSeatReady ? __VLS_ctx.checkersUi.readyOn : __VLS_ctx.checkersUi.readyOff);
    }
    else if (__VLS_ctx.selectedUiMode === 'local') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "checkers-local-names" },
        });
        /** @type {__VLS_StyleScopedClasses['checkers-local-names']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "checkers-local-player-row" },
        });
        /** @type {__VLS_StyleScopedClasses['checkers-local-player-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "checkers-local-piece checkers-local-piece--light" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['checkers-local-piece']} */ ;
        /** @type {__VLS_StyleScopedClasses['checkers-local-piece--light']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            ...{ class: "checkers-local-piece__svg" },
            viewBox: "0 0 24 24",
        });
        /** @type {__VLS_StyleScopedClasses['checkers-local-piece__svg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
            cx: "12",
            cy: "12",
            r: "8",
            fill: "#f5f0ff",
            stroke: "rgba(124,58,237,0.75)",
            'stroke-width': "1.4",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
            cx: "12",
            cy: "12",
            r: "5.2",
            fill: "#faf5ff",
            stroke: "rgba(139,92,246,0.35)",
            'stroke-width': "0.7",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.localPlayerDrafts.white),
            ...{ class: "checkers-local-name-input" },
            type: "text",
            maxlength: "48",
            placeholder: (__VLS_ctx.checkersUi.localNickPlaceholder),
        });
        /** @type {__VLS_StyleScopedClasses['checkers-local-name-input']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "checkers-local-player-row" },
        });
        /** @type {__VLS_StyleScopedClasses['checkers-local-player-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "checkers-local-piece checkers-local-piece--dark" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['checkers-local-piece']} */ ;
        /** @type {__VLS_StyleScopedClasses['checkers-local-piece--dark']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            ...{ class: "checkers-local-piece__svg" },
            viewBox: "0 0 24 24",
        });
        /** @type {__VLS_StyleScopedClasses['checkers-local-piece__svg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
            cx: "12",
            cy: "12",
            r: "8",
            fill: "#141018",
            stroke: "rgba(167,139,250,0.5)",
            'stroke-width': "1.4",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
            cx: "12",
            cy: "12",
            r: "5.2",
            fill: "#261933",
            stroke: "rgba(139,92,246,0.3)",
            'stroke-width': "0.7",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.localPlayerDrafts.black),
            ...{ class: "checkers-local-name-input" },
            type: "text",
            maxlength: "48",
            placeholder: (__VLS_ctx.checkersUi.localNickPlaceholder),
        });
        /** @type {__VLS_StyleScopedClasses['checkers-local-name-input']} */ ;
    }
    if (__VLS_ctx.matchmakingState !== 'matched') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.startCurrentGame) },
            type: "button",
            ...{ class: "checkers-start-game-button" },
            disabled: (__VLS_ctx.checkers.readyPending.value ||
                __VLS_ctx.matchmakingState === 'searching' ||
                (__VLS_ctx.selectedUiMode === 'local' && !__VLS_ctx.hasLocalPlayerNames) ||
                (__VLS_ctx.needsGuestNickname && !__VLS_ctx.guestDisplayName)),
        });
        /** @type {__VLS_StyleScopedClasses['checkers-start-game-button']} */ ;
        (__VLS_ctx.startGameButtonLabel);
    }
    if (__VLS_ctx.matchmakingState === 'searching') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.cancelMatchmaking) },
            type: "button",
            ...{ class: "checkers-start-game-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['checkers-start-game-secondary']} */ ;
        (__VLS_ctx.checkersUi.cancelSearch);
    }
}
// @ts-ignore
[matchmakingState, matchmakingState, matchmakingState, matchmakingState, matchmakingState, selectedUiMode, selectedUiMode, selectedUiMode, selectedUiMode, selectedUiMode, selectedUiMode, selectedUiMode, selectedUiMode, selectedUiMode, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, checkersUi, displayNameDraft, t, t, t, t, t, t, t, isActiveGame, turnLabel, turnLabel, turnTimerLabel, turnTimerLabel, isTurnTimerLow, checkers, checkers, checkers, checkers, checkers, winningMove, boardFlipped, handleCellClick, isStartOverlayVisible, needsGuestNickname, needsGuestNickname, needsGuestNickname, needsGuestNickname, matchmakingSeconds, applyFriendRoomFromOverlay, applyFriendRoomFromOverlay, friendInviteRoomDraft, friendInviteRoomDraft, friendInviteRoomDraft, copyFriendInvitePreview, roomCopyFlash, roomCopyFlash, roomCopyFlash, randomizeFriendRoomCode, friendInvitePreviewUrl, cleanCheckersRoomSlug, cleanCheckersRoomSlug, roomId, whiteSeatReady, whiteSeatReady, playerOneLabel, blackSeatReady, blackSeatReady, playerTwoLabel, localPlayerDrafts, localPlayerDrafts, startCurrentGame, hasLocalPlayerNames, guestDisplayName, startGameButtonLabel, cancelMatchmaking,];
var __VLS_35;
const __VLS_38 = CheckersEndGameOverlay || CheckersEndGameOverlay;
// @ts-ignore
const __VLS_39 = __VLS_asFunctionalComponent1(__VLS_38, new __VLS_38({
    ...{ 'onRematch': {} },
    ...{ 'onPlayBot': {} },
    ...{ 'onPlayFriend': {} },
    ...{ 'onPlayLocal': {} },
    winner: (__VLS_ctx.endGameWinner),
    mode: (__VLS_ctx.checkers.mode.value),
    playerLabels: (__VLS_ctx.playerLabels),
    isVisible: (__VLS_ctx.isEndGameOverlayVisible),
}));
const __VLS_40 = __VLS_39({
    ...{ 'onRematch': {} },
    ...{ 'onPlayBot': {} },
    ...{ 'onPlayFriend': {} },
    ...{ 'onPlayLocal': {} },
    winner: (__VLS_ctx.endGameWinner),
    mode: (__VLS_ctx.checkers.mode.value),
    playerLabels: (__VLS_ctx.playerLabels),
    isVisible: (__VLS_ctx.isEndGameOverlayVisible),
}, ...__VLS_functionalComponentArgsRest(__VLS_39));
let __VLS_43;
const __VLS_44 = ({ rematch: {} },
    { onRematch: (...[$event]) => {
            __VLS_ctx.checkers.restartGame();
            // @ts-ignore
            [checkers, checkers, endGameWinner, playerLabels, isEndGameOverlayVisible,];
        } });
const __VLS_45 = ({ playBot: {} },
    { onPlayBot: (...[$event]) => {
            __VLS_ctx.setGameMode('bot');
            // @ts-ignore
            [setGameMode,];
        } });
const __VLS_46 = ({ playFriend: {} },
    { onPlayFriend: (...[$event]) => {
            __VLS_ctx.setGameMode('friend');
            // @ts-ignore
            [setGameMode,];
        } });
const __VLS_47 = ({ playLocal: {} },
    { onPlayLocal: (...[$event]) => {
            __VLS_ctx.setGameMode('local');
            // @ts-ignore
            [setGameMode,];
        } });
const { default: __VLS_48 } = __VLS_41.slots;
if (__VLS_ctx.ratingDelta !== null) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "checkers-rating-delta" },
        ...{ class: ({ 'checkers-rating-delta--down': __VLS_ctx.ratingDelta < 0 }) },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-rating-delta']} */ ;
    /** @type {__VLS_StyleScopedClasses['checkers-rating-delta--down']} */ ;
    (__VLS_ctx.ratingDelta > 0 ? `+${__VLS_ctx.ratingDelta}` : __VLS_ctx.ratingDelta);
}
if (__VLS_ctx.shouldShowAutoRematchCountdown) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "checkers-auto-rematch" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-auto-rematch']} */ ;
    (__VLS_ctx.checkersUi.rematchIn);
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
        key: (__VLS_ctx.rematchCountdown),
    });
    (__VLS_ctx.rematchCountdown);
}
// @ts-ignore
[checkersUi, ratingDelta, ratingDelta, ratingDelta, ratingDelta, ratingDelta, shouldShowAutoRematchCountdown, rematchCountdown, rematchCountdown,];
var __VLS_41;
var __VLS_42;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "checkers-controls" },
});
/** @type {__VLS_StyleScopedClasses['checkers-controls']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "checkers-controls__actions" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['checkers-controls__actions']} */ ;
// @ts-ignore
[];
var __VLS_20;
const __VLS_49 = AppCard || AppCard;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent1(__VLS_49, new __VLS_49({
    ...{ class: "nadle-page__stack nadle-page__stack--side nadle-page__stack--chat" },
}));
const __VLS_51 = __VLS_50({
    ...{ class: "nadle-page__stack nadle-page__stack--side nadle-page__stack--chat" },
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--side']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
const { default: __VLS_54 } = __VLS_52.slots;
const __VLS_55 = TwitchRelayChatPanel;
// @ts-ignore
const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({
    ref: "chatPanelRef",
    flexRail: true,
    showGuessHints: (false),
    wsStatus: (__VLS_ctx.checkersNadleWsStatus),
    wsStatusLabel: (__VLS_ctx.checkersRelayWsStatusLabel),
    chatTitle: (__VLS_ctx.t('nadleUi.chatTitle')),
    guessLenHint: "",
    channelDisplay: (__VLS_ctx.checkersEffectiveTwitchChannel),
    twitchWatchUrl: (__VLS_ctx.checkersTwitchWatchUrl),
    openTwitchLabel: (__VLS_ctx.t('nadleUi.chatOpenTwitch')),
    ircRelayBanner: (__VLS_ctx.checkersRelayIrcBanner),
    relayAriaLabel: (__VLS_ctx.t('nadleUi.chatRelayAria')),
    chatEmptyText: (__VLS_ctx.t('nadleUi.chatEmpty', { channel: __VLS_ctx.checkersEffectiveTwitchChannel })),
    guessBadgeLabel: (__VLS_ctx.t('nadleUi.chatGuessBadge')),
    lines: (__VLS_ctx.checkersNadleChatLines),
    defaultCooldownMs: (__VLS_ctx.checkersNadlePublicConfig?.chatGuessCooldownMs ?? 1500),
    formatCooldownHint: (__VLS_ctx.formatCheckersChatCooldownHint),
    feedbackToEmojis: (__VLS_ctx.checkersChatFeedbackToEmojis),
}));
const __VLS_57 = __VLS_56({
    ref: "chatPanelRef",
    flexRail: true,
    showGuessHints: (false),
    wsStatus: (__VLS_ctx.checkersNadleWsStatus),
    wsStatusLabel: (__VLS_ctx.checkersRelayWsStatusLabel),
    chatTitle: (__VLS_ctx.t('nadleUi.chatTitle')),
    guessLenHint: "",
    channelDisplay: (__VLS_ctx.checkersEffectiveTwitchChannel),
    twitchWatchUrl: (__VLS_ctx.checkersTwitchWatchUrl),
    openTwitchLabel: (__VLS_ctx.t('nadleUi.chatOpenTwitch')),
    ircRelayBanner: (__VLS_ctx.checkersRelayIrcBanner),
    relayAriaLabel: (__VLS_ctx.t('nadleUi.chatRelayAria')),
    chatEmptyText: (__VLS_ctx.t('nadleUi.chatEmpty', { channel: __VLS_ctx.checkersEffectiveTwitchChannel })),
    guessBadgeLabel: (__VLS_ctx.t('nadleUi.chatGuessBadge')),
    lines: (__VLS_ctx.checkersNadleChatLines),
    defaultCooldownMs: (__VLS_ctx.checkersNadlePublicConfig?.chatGuessCooldownMs ?? 1500),
    formatCooldownHint: (__VLS_ctx.formatCheckersChatCooldownHint),
    feedbackToEmojis: (__VLS_ctx.checkersChatFeedbackToEmojis),
}, ...__VLS_functionalComponentArgsRest(__VLS_56));
var __VLS_60 = {};
var __VLS_58;
// @ts-ignore
[t, t, t, t, t, checkersNadleWsStatus, checkersRelayWsStatusLabel, checkersEffectiveTwitchChannel, checkersEffectiveTwitchChannel, checkersTwitchWatchUrl, checkersRelayIrcBanner, checkersNadleChatLines, checkersNadlePublicConfig, formatCheckersChatCooldownHint, checkersChatFeedbackToEmojis,];
var __VLS_52;
// @ts-ignore
[];
var __VLS_3;
let __VLS_62;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_63 = __VLS_asFunctionalComponent1(__VLS_62, new __VLS_62({
    name: "checkers-your-turn",
}));
const __VLS_64 = __VLS_63({
    name: "checkers-your-turn",
}, ...__VLS_functionalComponentArgsRest(__VLS_63));
const { default: __VLS_67 } = __VLS_65.slots;
if (__VLS_ctx.showYourTurn) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkers-your-turn" },
        'aria-live': "polite",
    });
    /** @type {__VLS_StyleScopedClasses['checkers-your-turn']} */ ;
    (__VLS_ctx.checkersUi.yourTurnBanner);
}
// @ts-ignore
[checkersUi, showYourTurn,];
var __VLS_65;
let __VLS_68;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent1(__VLS_68, new __VLS_68({
    name: "checkers-mode-confirm",
}));
const __VLS_70 = __VLS_69({
    name: "checkers-mode-confirm",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
const { default: __VLS_73 } = __VLS_71.slots;
if (__VLS_ctx.pendingModeChange) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkers-mode-confirm-overlay" },
        role: "dialog",
        'aria-modal': "true",
        'aria-labelledby': "checkers-mode-confirm-title",
    });
    /** @type {__VLS_StyleScopedClasses['checkers-mode-confirm-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkers-mode-confirm-card" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-mode-confirm-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        id: "checkers-mode-confirm-title",
        ...{ class: "checkers-mode-confirm-title" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-mode-confirm-title']} */ ;
    (__VLS_ctx.checkersUi.modeConfirmTitle);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "checkers-mode-confirm-copy" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-mode-confirm-copy']} */ ;
    (__VLS_ctx.modeConfirmFullCopy);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkers-mode-confirm-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-mode-confirm-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.cancelModeChange) },
        type: "button",
        ...{ class: "checkers-mode-confirm-button" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-mode-confirm-button']} */ ;
    (__VLS_ctx.checkersUi.modeConfirmStay);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.confirmModeChange) },
        type: "button",
        ...{ class: "checkers-mode-confirm-button checkers-mode-confirm-button--danger" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-mode-confirm-button']} */ ;
    /** @type {__VLS_StyleScopedClasses['checkers-mode-confirm-button--danger']} */ ;
    (__VLS_ctx.checkersUi.modeConfirmChange);
}
// @ts-ignore
[checkersUi, checkersUi, checkersUi, pendingModeChange, modeConfirmFullCopy, cancelModeChange, confirmModeChange,];
var __VLS_71;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "checkers-voice-audio" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['checkers-voice-audio']} */ ;
for (const [tile] of __VLS_vFor((__VLS_ctx.remoteVoiceTiles))) {
    const __VLS_74 = StreamAudio;
    // @ts-ignore
    const __VLS_75 = __VLS_asFunctionalComponent1(__VLS_74, new __VLS_74({
        key: (tile.peerId),
        stream: (tile.stream),
        playRev: (tile.playRev),
        listenVolume: (__VLS_ctx.remoteListenVolume),
        listenMuted: (!__VLS_ctx.remoteAudioUnlocked || __VLS_ctx.remoteListenMuted),
    }));
    const __VLS_76 = __VLS_75({
        key: (tile.peerId),
        stream: (tile.stream),
        playRev: (tile.playRev),
        listenVolume: (__VLS_ctx.remoteListenVolume),
        listenMuted: (!__VLS_ctx.remoteAudioUnlocked || __VLS_ctx.remoteListenMuted),
    }, ...__VLS_functionalComponentArgsRest(__VLS_75));
    // @ts-ignore
    [remoteVoiceTiles, remoteListenVolume, remoteAudioUnlocked, remoteListenMuted,];
}
let __VLS_79;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_80 = __VLS_asFunctionalComponent1(__VLS_79, new __VLS_79({
    to: "body",
}));
const __VLS_81 = __VLS_80({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_80));
const { default: __VLS_84 } = __VLS_82.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "checkers-voice-dock" },
    ...{ style: (__VLS_ctx.voiceDockInlineStyle) },
});
/** @type {__VLS_StyleScopedClasses['checkers-voice-dock']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.toggleCheckersMic) },
    type: "button",
    ...{ class: "checkers-mic-button" },
    ...{ class: ({
            'checkers-mic-button--active': __VLS_ctx.isMicActive,
            'checkers-mic-button--muted': !__VLS_ctx.isMicActive,
            'checkers-mic-button--speaking': __VLS_ctx.isMicActive && __VLS_ctx.localMicSpeaking,
        }) },
    disabled: (__VLS_ctx.isCheckersSpectator),
    'aria-pressed': (__VLS_ctx.isMicActive),
    'aria-label': (__VLS_ctx.micButtonLabel),
    title: (__VLS_ctx.micButtonLabel),
});
/** @type {__VLS_StyleScopedClasses['checkers-mic-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mic-button--active']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mic-button--muted']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-mic-button--speaking']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 24 24",
    'aria-hidden': "true",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M5 11h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h-2v-3.08A7 7 0 0 1 5 11Z",
});
if (!__VLS_ctx.isMicActive) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M4.7 3.3 20.7 19.3 19.3 20.7 3.3 4.7 4.7 3.3Z",
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "audioControlsRoot",
    ...{ class: "checkers-audio-controls" },
});
/** @type {__VLS_StyleScopedClasses['checkers-audio-controls']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.audioControlsOpen = !__VLS_ctx.audioControlsOpen;
            // @ts-ignore
            [voiceDockInlineStyle, toggleCheckersMic, isMicActive, isMicActive, isMicActive, isMicActive, isMicActive, localMicSpeaking, isCheckersSpectator, micButtonLabel, micButtonLabel, audioControlsOpen, audioControlsOpen,];
        } },
    type: "button",
    ...{ class: "checkers-headphones-button" },
    ...{ class: ({
            'checkers-headphones-button--active': __VLS_ctx.audioControlsOpen,
            'checkers-headphones-button--muted': __VLS_ctx.remoteListenMuted,
        }) },
    'aria-label': "Audio controls",
    title: "Audio controls",
});
/** @type {__VLS_StyleScopedClasses['checkers-headphones-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-headphones-button--active']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-headphones-button--muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 24 24",
    'aria-hidden': "true",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M12 4a8 8 0 0 0-8 8v6a2 2 0 0 0 2 2h3v-8H6a6 6 0 0 1 12 0h-3v8h3a2 2 0 0 0 2-2v-6a8 8 0 0 0-8-8Z",
});
if (__VLS_ctx.remoteListenMuted) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M4.7 3.3 20.7 19.3 19.3 20.7 3.3 4.7 4.7 3.3Z",
    });
}
if (__VLS_ctx.audioControlsOpen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkers-audio-popover" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-audio-popover']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "checkers-audio-popover__label" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-audio-popover__label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (Math.round(__VLS_ctx.remoteListenVolume * 100));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "checkers-audio-popover__range" },
        type: "range",
        min: "0",
        max: "2",
        step: "0.01",
    });
    (__VLS_ctx.remoteListenVolume);
    /** @type {__VLS_StyleScopedClasses['checkers-audio-popover__range']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.toggleRemoteListenMuted) },
        type: "button",
        ...{ class: "checkers-audio-popover__mute" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-audio-popover__mute']} */ ;
    (__VLS_ctx.remoteListenMuted ? 'Увімкнути суперника' : 'Вимкнути суперника');
}
// @ts-ignore
[remoteListenVolume, remoteListenVolume, remoteListenMuted, remoteListenMuted, remoteListenMuted, audioControlsOpen, audioControlsOpen, toggleRemoteListenMuted,];
var __VLS_82;
// @ts-ignore
var __VLS_23 = __VLS_22, __VLS_61 = __VLS_60;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
