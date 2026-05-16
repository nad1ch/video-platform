/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import AppContainer from '@/components/ui/AppContainer.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import NadleGlobalLeaderboardTable from '@/components/nadle/NadleGlobalLeaderboardTable.vue';
import TwitchRelayChatPanel from '@/components/twitch/TwitchRelayChatPanel.vue';
import NadleLocalBoardGrid from '@/components/nadle/NadleLocalBoardGrid.vue';
import NadleOnScreenKeyboard from '@/components/nadle/NadleOnScreenKeyboard.vue';
import { STREAMER_NICK } from '@/eat-first/constants/brand.js';
import { useNadleGlobalLeaderboard } from '@/composables/useNadleGlobalLeaderboard';
import { NADLE_DICTIONARY_ERROR_TEXT, useNadleState } from '@/composables/useNadleState';
import { useNadleStatusBanners } from '@/composables/useNadleStatusBanners';
import { useNadleStreamerRoom } from '@/composables/useNadleStreamerRoom';
import { isAllowedGuess } from '@/nadle/nadleLogic';
import { useNadleWs } from '@/nadle/ws';
import { createLogger } from '@/utils/logger';
import { useAuth } from '@/composables/useAuth';
const nadleLog = createLogger('nadle-ws');
const DEMO_TWITCH_CHANNEL = STREAMER_NICK;
const NADLE_ROUTE_HTML_CLASS = 'sa-nadle-route';
function normalizeTwitchLogin(raw) {
    if (raw == null || typeof raw !== 'string') {
        return null;
    }
    const t = raw.trim().replace(/^#/, '').toLowerCase();
    if (t.length < 2 || t.length > 25) {
        return null;
    }
    if (!/^[a-z0-9_]+$/.test(t)) {
        return null;
    }
    return t;
}
const route = useRoute();
const { t } = useI18n();
const { isAuthenticated, user, isAdmin, ensureAuthLoaded } = useAuth();
const effectiveNadleSlug = computed(() => {
    const u = user.value;
    const fromAccount = u && typeof u.nadleStreamerName === 'string' ? normalizeTwitchLogin(u.nadleStreamerName) : null;
    if (fromAccount) {
        return fromAccount;
    }
    return normalizeTwitchLogin(String(route.params.streamer || ''));
});
const nadleStorageScope = computed(() => effectiveNadleSlug.value || 'default');
const { nadlePublicConfig, streamerProfile, streamerLoadError, effectiveTwitchChannel, loadStreamerCard, fetchNadlePublicConfig, } = useNadleStreamerRoom({
    effectiveNadleSlug,
    demoFallbackChannel: DEMO_TWITCH_CHANNEL,
});
const lastError = ref(null);
const nadleToastText = ref(null);
let nadleToastTimer;
function showNadleToast(text) {
    nadleToastText.value = text;
    if (nadleToastTimer !== undefined) {
        window.clearTimeout(nadleToastTimer);
    }
    nadleToastTimer = window.setTimeout(() => {
        nadleToastText.value = null;
        nadleToastTimer = undefined;
    }, 2200);
}
const nadleTabPeerId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
const chatPanelRef = ref(null);
function scrollChatToBottom() {
    chatPanelRef.value?.scrollToBottom();
}
const { globalLbTab, globalLbLoading, globalLbError, globalLbTableRows, globalLbScoreLabel, globalLbSelfStreakSummary, loadGlobalLbActive, } = useNadleGlobalLeaderboard({
    streamerProfile,
    effectiveNadleSlug,
    user,
});
const { gameState, chatLines, sessionUser, wsStatus, ircRelayStatus, sendGuess: sendNadleWsGuess, requestNextWord: requestNadleNextWord, prepareNadleWsMount, disposeNadleWs, } = useNadleWs({
    streamerProfile,
    lastError,
    nadleTabPeerId,
    log: nadleLog,
    onNewGame: () => {
        void loadGlobalLbActive();
    },
    afterChatLineAppended: () => {
        void nextTick(() => scrollChatToBottom());
    },
    isAuthenticated,
});
const { NADLE_MAX_ATTEMPTS, WORD_LENGTH_OPTIONS, KBD_ROW1, KBD_ROW2, KBD_ROW3, wordLength, secretWord, localGuesses, gameStatus, localRoundId, localStats, secretPeekVisible, guessInput, nadleGridRows, kbdAppendLetter, clampGuessSrInput, kbdBackspace, submitGuess, newRoundSameLength, setWordLength, toggleSecretPeek, hydrateScope, persistCurrentLocalStats, normalizeWord, wordGraphemeCount, } = useNadleState({ storageScope: nadleStorageScope, lastError });
const { topBanner } = useNadleStatusBanners({
    streamerLoadError,
    lastError,
    wsStatus,
    ircRelayStatus,
});
watch(lastError, (text) => {
    if (!text) {
        return;
    }
    showNadleToast(text);
    lastError.value = null;
});
function formatCooldownHint(ms) {
    const s = ms / 1000;
    const label = Number.isInteger(s) ? String(s) : s.toFixed(1);
    return t('nadleUi.cooldownHint', { seconds: label });
}
function feedbackToEmojis(fb) {
    return fb
        .map((f) => (f === 'correct' ? '🟩' : f === 'present' ? '🟨' : '⬛'))
        .join(' ');
}
const twitchWatchUrl = computed(() => `https://www.twitch.tv/${encodeURIComponent(effectiveTwitchChannel.value)}`);
const CONFETTI_PIECES = 32;
function confettiStyle(i) {
    const seed = i * 1103;
    const cx = `${((seed % 160) - 80).toFixed(0)}px`;
    const dx = `${(((seed * 7) % 200) - 100).toFixed(0)}px`;
    const hue = String((seed * 13) % 360);
    const delay = `${((i * 17) % 450) / 1000}s`;
    const dur = `${1.4 + ((seed % 80) / 100)}s`;
    return {
        '--cf-cx': cx,
        '--cf-dx': dx,
        '--cf-hue': hue,
        '--cf-delay': delay,
        '--cf-dur': dur,
    };
}
const guessFieldId = 'nadle-guess-sr';
const guessInputEl = ref(null);
const chatTargetWordLength = computed(() => {
    const ws = gameState.value?.wordLength;
    if (typeof ws === 'number' && Number.isFinite(ws) && ws > 0) {
        return Math.min(32, Math.max(1, Math.round(ws)));
    }
    return wordLength.value;
});
const serverPlayer = computed(() => {
    const uid = sessionUser.value?.id;
    if (!uid) {
        return null;
    }
    return gameState.value?.players.find((player) => player.userId === uid) ?? null;
});
const useServerBoard = computed(() => Boolean(sessionUser.value && gameState.value));
const activeWordLength = computed(() => {
    const len = gameState.value?.wordLength;
    return useServerBoard.value && (len === 5 || len === 6 || len === 7) ? len : wordLength.value;
});
const serverGameStatus = computed(() => {
    const player = serverPlayer.value;
    if (player?.guessed) {
        return 'won';
    }
    if ((player?.rows.length ?? 0) >= NADLE_MAX_ATTEMPTS) {
        return 'lost';
    }
    return 'playing';
});
const displayGameStatus = computed(() => (useServerBoard.value ? serverGameStatus.value : gameStatus.value));
const displayBoardLocked = computed(() => displayGameStatus.value !== 'playing' || (serverPlayer.value?.rows.length ?? localGuesses.value.length) >= NADLE_MAX_ATTEMPTS);
const canStartNewActiveRound = computed(() => !useServerBoard.value || Boolean(sessionUser.value));
const displaySecretWord = computed(() => (useServerBoard.value ? (gameState.value?.secretWord ?? '') : secretWord.value));
const serverRoundKey = ref(0);
watch(() => gameState.value?.gameId, (gameId, prev) => {
    if (gameId && gameId !== prev) {
        serverRoundKey.value += 1;
        guessInput.value = '';
    }
});
watch(() => gameState.value?.wordLength, (len) => {
    if (typeof len === 'number' && (len === 5 || len === 6 || len === 7)) {
        wordLength.value = len;
    }
}, { immediate: true });
const activeRoundId = computed(() => (useServerBoard.value ? serverRoundKey.value : localRoundId.value));
const displayGridRows = computed(() => {
    if (!useServerBoard.value) {
        return nadleGridRows.value;
    }
    const len = activeWordLength.value;
    const submitted = serverPlayer.value?.rows ?? [];
    const canType = displayGameStatus.value === 'playing' && submitted.length < NADLE_MAX_ATTEMPTS;
    const draftChars = canType ? [...normalizeWord(guessInput.value)].slice(0, len) : [];
    const rows = [];
    for (let r = 0; r < NADLE_MAX_ATTEMPTS; r += 1) {
        const cells = [];
        const row = submitted[r];
        if (row) {
            const letters = [...row.guess];
            for (let c = 0; c < len; c += 1) {
                cells.push({
                    letter: letters[c] ?? '',
                    feedback: row.feedback[c] ?? null,
                    locked: true,
                    rowIndex: r,
                    colIndex: c,
                });
            }
        }
        else if (r === submitted.length && canType) {
            for (let c = 0; c < len; c += 1) {
                cells.push({
                    letter: draftChars[c] ?? '',
                    feedback: null,
                    locked: false,
                    rowIndex: r,
                    colIndex: c,
                });
            }
        }
        else {
            for (let c = 0; c < len; c += 1) {
                cells.push({ letter: '', feedback: null, locked: false, rowIndex: r, colIndex: c });
            }
        }
        rows.push(cells);
    }
    return rows;
});
const FEEDBACK_RANK = {
    absent: 0,
    present: 1,
    correct: 2,
};
const activeKbdLetterBestFeedback = computed(() => {
    const map = new Map();
    for (const row of displayGridRows.value) {
        for (const cell of row) {
            if (!cell.letter || cell.feedback == null) {
                continue;
            }
            const ch = normalizeWord(cell.letter);
            const prev = map.get(ch);
            if (prev == null || FEEDBACK_RANK[cell.feedback] > FEEDBACK_RANK[prev]) {
                map.set(ch, cell.feedback);
            }
        }
    }
    return map;
});
function activeKbdKeyFeedbackModifier(ch) {
    const fb = activeKbdLetterBestFeedback.value.get(normalizeWord(ch));
    return fb ? `nadle-page__kbd-key--${fb}` : undefined;
}
let nadleStreamerLoadSeq = 0;
watch(() => effectiveNadleSlug.value || 'default', async (scope) => {
    const seq = ++nadleStreamerLoadSeq;
    hydrateScope(scope);
    await loadStreamerCard();
    if (seq !== nadleStreamerLoadSeq) {
        return;
    }
    void fetchNadlePublicConfig();
}, { immediate: true });
function submitActiveGuess() {
    const guess = normalizeWord(guessInput.value);
    if (wordGraphemeCount(guess) !== activeWordLength.value) {
        return;
    }
    if (!isAllowedGuess(guess, activeWordLength.value)) {
        lastError.value = NADLE_DICTIONARY_ERROR_TEXT;
        return;
    }
    if (!useServerBoard.value) {
        submitGuess();
        return;
    }
    lastError.value = null;
    if (displayBoardLocked.value) {
        return;
    }
    if (!sendNadleWsGuess(guess, gameState.value?.gameId)) {
        lastError.value = t('nadleUi.wsNotConnected');
        return;
    }
    guessInput.value = '';
}
function appendActiveLetter(ch) {
    if (displayBoardLocked.value) {
        return;
    }
    kbdAppendLetter(ch);
}
function backspaceActiveGuess() {
    if (displayBoardLocked.value) {
        return;
    }
    kbdBackspace();
}
function newActiveRound() {
    if (!useServerBoard.value) {
        newRoundSameLength();
        return;
    }
    if (!requestNadleNextWord(activeWordLength.value)) {
        lastError.value = t('nadleUi.wsNotConnected');
    }
}
function setActiveWordLength(len) {
    if (useServerBoard.value) {
        if (!requestNadleNextWord(len)) {
            lastError.value = t('nadleUi.wsNotConnected');
        }
        return;
    }
    setWordLength(len);
}
function onWindowKeydown(e) {
    if (displayBoardLocked.value) {
        return;
    }
    const el = e.target;
    if (el instanceof HTMLElement) {
        if (el.isContentEditable) {
            return;
        }
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            return;
        }
        if (tag === 'A') {
            return;
        }
        if (tag === 'BUTTON' && !el.closest('.nadle-page__kbd')) {
            return;
        }
    }
    if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
    }
    if (e.key === 'Backspace') {
        e.preventDefault();
        backspaceActiveGuess();
        return;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        submitActiveGuess();
        return;
    }
    if (e.key.length === 1 && /\p{Script=Cyrillic}/u.test(e.key)) {
        e.preventDefault();
        appendActiveLetter(normalizeWord(e.key));
        return;
    }
}
watch(gameStatus, (next, prev) => {
    if (prev !== 'playing') {
        return;
    }
    if (next === 'won') {
        const s = { ...localStats.value, won: localStats.value.won + 1 };
        localStats.value = s;
        persistCurrentLocalStats(s);
    }
    else if (next === 'lost') {
        const s = { ...localStats.value, lost: localStats.value.lost + 1 };
        localStats.value = s;
        persistCurrentLocalStats(s);
    }
});
const NADLE_STREAM_CHAT_ANCHOR_ID = 'nadle-stream-chat-anchor';
function scrollNadleChatIntoView() {
    if (typeof document === 'undefined') {
        return;
    }
    document.getElementById(NADLE_STREAM_CHAT_ANCHOR_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function focusNadleGuessInput() {
    if (displayBoardLocked.value) {
        return;
    }
    guessInputEl.value?.focus({ preventScroll: true });
}
onMounted(() => {
    prepareNadleWsMount();
    document.documentElement.classList.add(NADLE_ROUTE_HTML_CLASS);
    void ensureAuthLoaded();
    void loadGlobalLbActive();
    window.addEventListener('keydown', onWindowKeydown);
});
onBeforeUnmount(() => {
    disposeNadleWs();
    document.documentElement.classList.remove(NADLE_ROUTE_HTML_CLASS);
    window.removeEventListener('keydown', onWindowKeydown);
    if (nadleToastTimer !== undefined) {
        window.clearTimeout(nadleToastTimer);
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-route']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__toast']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-toast-enter-from']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-toast-leave-to']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-toast-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-toast-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__setup']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__chat-mobile-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['page-route']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len6']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len7']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len5']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len6']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len7']} */ ;
/** @type {__VLS_StyleScopedClasses['page-route']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__chat-mobile-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__chat-mobile-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__chat-mobile-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__global-lb']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len5']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len6']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len7']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len5']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len6']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len7']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len5']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len6']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len7']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len5']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len6']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len7']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__guess-board']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__global-lb']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__side-tools']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__side-tools']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-peek-word-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-peek-word-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__confetti-bit']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__others']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__side-tools-row']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__global-lb']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__global-lb']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__side-tools']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__chat-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__chat-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__chat-feed']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__side-tools']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__shell']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__head']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__name']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__name']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__name']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__name']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__text']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__guess-board']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len5']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len6']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page--len7']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-route" },
});
/** @type {__VLS_StyleScopedClasses['page-route']} */ ;
const __VLS_0 = AppContainer || AppContainer;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    wide: true,
    flush: true,
    ...{ class: (['nadle-page', `nadle-page--len${__VLS_ctx.activeWordLength}`]) },
}));
const __VLS_2 = __VLS_1({
    wide: true,
    flush: true,
    ...{ class: (['nadle-page', `nadle-page--len${__VLS_ctx.activeWordLength}`]) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['nadle-page']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.topBanner) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "nadle-page__banner" },
        ...{ class: ({ 'nadle-page__banner--error': __VLS_ctx.topBanner.variant === 'error' }) },
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__banner']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadle-page__banner--error']} */ ;
    (__VLS_ctx.topBanner.text);
}
let __VLS_6;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    name: "nadle-toast",
}));
const __VLS_8 = __VLS_7({
    name: "nadle-toast",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
if (__VLS_ctx.nadleToastText) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nadle-page__toast" },
        role: "status",
        'aria-live': "polite",
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__toast']} */ ;
    (__VLS_ctx.nadleToastText);
}
// @ts-ignore
[activeWordLength, topBanner, topBanner, topBanner, nadleToastText, nadleToastText,];
var __VLS_9;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadle-page__grid" },
});
/** @type {__VLS_StyleScopedClasses['nadle-page__grid']} */ ;
const __VLS_12 = AppCard || AppCard;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
    ...{ class: "nadle-page__stack nadle-page__stack--side nadle-page__stack--leader" },
}));
const __VLS_14 = __VLS_13({
    ...{ class: "nadle-page__stack nadle-page__stack--side nadle-page__stack--leader" },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--side']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--leader']} */ ;
const { default: __VLS_17 } = __VLS_15.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadle-page__leader-stack" },
});
/** @type {__VLS_StyleScopedClasses['nadle-page__leader-stack']} */ ;
const __VLS_18 = NadleGlobalLeaderboardTable;
// @ts-ignore
const __VLS_19 = __VLS_asFunctionalComponent1(__VLS_18, new __VLS_18({
    tab: (__VLS_ctx.globalLbTab),
    loading: (__VLS_ctx.globalLbLoading),
    error: (__VLS_ctx.globalLbError),
    rows: (__VLS_ctx.globalLbTableRows),
    scoreColumnHeader: (__VLS_ctx.globalLbScoreLabel),
    selfStreakSummary: (__VLS_ctx.globalLbSelfStreakSummary),
    sectionAriaLabel: (__VLS_ctx.t('nadleUi.globalLeaderboard')),
    title: (__VLS_ctx.t('nadleUi.globalLeaderboard')),
    tabsAriaLabel: (__VLS_ctx.t('nadleLeaderboard.tabsAria')),
    tabWinsLabel: (__VLS_ctx.t('nadleLeaderboard.tabWins')),
    tabStreakLabel: (__VLS_ctx.t('nadleLeaderboard.tabStreak')),
    tabRatingLabel: (__VLS_ctx.t('nadleLeaderboard.tabRating')),
    loadingText: (__VLS_ctx.t('nadleLeaderboard.loading')),
    emptyText: (__VLS_ctx.t('nadleLeaderboard.empty')),
    colRank: (__VLS_ctx.t('nadleLeaderboard.colRank')),
    colPlayer: (__VLS_ctx.t('nadleLeaderboard.colPlayer')),
    youLabel: (__VLS_ctx.t('nadleLeaderboard.you')),
}));
const __VLS_20 = __VLS_19({
    tab: (__VLS_ctx.globalLbTab),
    loading: (__VLS_ctx.globalLbLoading),
    error: (__VLS_ctx.globalLbError),
    rows: (__VLS_ctx.globalLbTableRows),
    scoreColumnHeader: (__VLS_ctx.globalLbScoreLabel),
    selfStreakSummary: (__VLS_ctx.globalLbSelfStreakSummary),
    sectionAriaLabel: (__VLS_ctx.t('nadleUi.globalLeaderboard')),
    title: (__VLS_ctx.t('nadleUi.globalLeaderboard')),
    tabsAriaLabel: (__VLS_ctx.t('nadleLeaderboard.tabsAria')),
    tabWinsLabel: (__VLS_ctx.t('nadleLeaderboard.tabWins')),
    tabStreakLabel: (__VLS_ctx.t('nadleLeaderboard.tabStreak')),
    tabRatingLabel: (__VLS_ctx.t('nadleLeaderboard.tabRating')),
    loadingText: (__VLS_ctx.t('nadleLeaderboard.loading')),
    emptyText: (__VLS_ctx.t('nadleLeaderboard.empty')),
    colRank: (__VLS_ctx.t('nadleLeaderboard.colRank')),
    colPlayer: (__VLS_ctx.t('nadleLeaderboard.colPlayer')),
    youLabel: (__VLS_ctx.t('nadleLeaderboard.you')),
}, ...__VLS_functionalComponentArgsRest(__VLS_19));
if (__VLS_ctx.displayGameStatus === 'playing' && __VLS_ctx.isAdmin) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nadle-page__side-tools" },
        'aria-label': (__VLS_ctx.t('nadleUi.streamToolsAria')),
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__side-tools']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nadle-page__side-tools-row" },
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__side-tools-row']} */ ;
    const __VLS_23 = AppButton || AppButton;
    // @ts-ignore
    const __VLS_24 = __VLS_asFunctionalComponent1(__VLS_23, new __VLS_23({
        ...{ 'onClick': {} },
        type: "button",
        variant: "ghost",
        ...{ class: "nadle-page__peek-btn nadle-page__side-tool-btn" },
    }));
    const __VLS_25 = __VLS_24({
        ...{ 'onClick': {} },
        type: "button",
        variant: "ghost",
        ...{ class: "nadle-page__peek-btn nadle-page__side-tool-btn" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_24));
    let __VLS_28;
    const __VLS_29 = ({ click: {} },
        { onClick: (__VLS_ctx.toggleSecretPeek) });
    /** @type {__VLS_StyleScopedClasses['nadle-page__peek-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadle-page__side-tool-btn']} */ ;
    const { default: __VLS_30 } = __VLS_26.slots;
    (__VLS_ctx.secretPeekVisible ? __VLS_ctx.t('nadleUi.hideWord') : __VLS_ctx.t('nadleUi.showWord'));
    // @ts-ignore
    [globalLbTab, globalLbLoading, globalLbError, globalLbTableRows, globalLbScoreLabel, globalLbSelfStreakSummary, t, t, t, t, t, t, t, t, t, t, t, t, t, t, displayGameStatus, isAdmin, toggleSecretPeek, secretPeekVisible,];
    var __VLS_26;
    var __VLS_27;
    let __VLS_31;
    /** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
    Transition;
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
        name: "nadle-peek-word",
    }));
    const __VLS_33 = __VLS_32({
        name: "nadle-peek-word",
    }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    const { default: __VLS_36 } = __VLS_34.slots;
    if (__VLS_ctx.secretPeekVisible) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "nadle-page__peek-word nadle-page__peek-word--side" },
            'aria-live': "polite",
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__peek-word']} */ ;
        /** @type {__VLS_StyleScopedClasses['nadle-page__peek-word--side']} */ ;
        (__VLS_ctx.displaySecretWord);
    }
    // @ts-ignore
    [secretPeekVisible, displaySecretWord,];
    var __VLS_34;
}
// @ts-ignore
[];
var __VLS_15;
const __VLS_37 = AppCard || AppCard;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent1(__VLS_37, new __VLS_37({
    ...{ class: "nadle-page__stack nadle-page__stack--game" },
}));
const __VLS_39 = __VLS_38({
    ...{ class: "nadle-page__stack nadle-page__stack--game" },
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--game']} */ ;
const { default: __VLS_42 } = __VLS_40.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadle-page__game" },
    ...{ style: ({ '--nadle-len': String(__VLS_ctx.activeWordLength) }) },
});
/** @type {__VLS_StyleScopedClasses['nadle-page__game']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadle-page__guess-focus-anchor" },
});
/** @type {__VLS_StyleScopedClasses['nadle-page__guess-focus-anchor']} */ ;
const __VLS_43 = NadleLocalBoardGrid;
// @ts-ignore
const __VLS_44 = __VLS_asFunctionalComponent1(__VLS_43, new __VLS_43({
    ...{ 'onFocusInput': {} },
    roundId: (__VLS_ctx.activeRoundId),
    wordLength: (__VLS_ctx.activeWordLength),
    maxAttempts: (__VLS_ctx.NADLE_MAX_ATTEMPTS),
    rows: (__VLS_ctx.displayGridRows),
}));
const __VLS_45 = __VLS_44({
    ...{ 'onFocusInput': {} },
    roundId: (__VLS_ctx.activeRoundId),
    wordLength: (__VLS_ctx.activeWordLength),
    maxAttempts: (__VLS_ctx.NADLE_MAX_ATTEMPTS),
    rows: (__VLS_ctx.displayGridRows),
}, ...__VLS_functionalComponentArgsRest(__VLS_44));
let __VLS_48;
const __VLS_49 = ({ focusInput: {} },
    { onFocusInput: (__VLS_ctx.focusNadleGuessInput) });
var __VLS_46;
var __VLS_47;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.submitActiveGuess) },
    ...{ class: "nadle-page__sr-form" },
});
/** @type {__VLS_StyleScopedClasses['nadle-page__sr-form']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "nadle-page__sr-only" },
    for: (__VLS_ctx.guessFieldId),
});
/** @type {__VLS_StyleScopedClasses['nadle-page__sr-only']} */ ;
(__VLS_ctx.t('nadleUi.guessLabel'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onInput: (__VLS_ctx.clampGuessSrInput) },
    id: (__VLS_ctx.guessFieldId),
    ref: "guessInputEl",
    value: (__VLS_ctx.guessInput),
    ...{ class: "nadle-page__native-guess-input" },
    type: "text",
    inputmode: "text",
    autocapitalize: "off",
    spellcheck: "false",
    disabled: (__VLS_ctx.displayBoardLocked),
    autocomplete: "off",
    lang: "uk",
});
/** @type {__VLS_StyleScopedClasses['nadle-page__native-guess-input']} */ ;
if (__VLS_ctx.displayGameStatus === 'won') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (`win-${__VLS_ctx.activeRoundId}`),
        ...{ class: "nadle-page__game-panel-width nadle-page__celebrate" },
        'aria-live': "polite",
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__game-panel-width']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadle-page__celebrate']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nadle-page__confetti" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__confetti']} */ ;
    for (const [n] of __VLS_vFor((__VLS_ctx.CONFETTI_PIECES))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            key: (`cf-${__VLS_ctx.activeRoundId}-${n}`),
            ...{ class: "nadle-page__confetti-bit" },
            ...{ style: (__VLS_ctx.confettiStyle(n)) },
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__confetti-bit']} */ ;
        // @ts-ignore
        [activeWordLength, activeWordLength, t, displayGameStatus, activeRoundId, activeRoundId, activeRoundId, NADLE_MAX_ATTEMPTS, displayGridRows, focusNadleGuessInput, submitActiveGuess, guessFieldId, guessFieldId, clampGuessSrInput, guessInput, displayBoardLocked, CONFETTI_PIECES, confettiStyle,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "nadle-page__celebrate-title" },
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__celebrate-title']} */ ;
    (__VLS_ctx.t('nadleUi.celebrateTitle'));
    if (__VLS_ctx.canStartNewActiveRound) {
        const __VLS_50 = AppButton || AppButton;
        // @ts-ignore
        const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({
            ...{ 'onClick': {} },
            variant: "primary",
            type: "button",
            ...{ class: "nadle-page__celebrate-btn" },
        }));
        const __VLS_52 = __VLS_51({
            ...{ 'onClick': {} },
            variant: "primary",
            type: "button",
            ...{ class: "nadle-page__celebrate-btn" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_51));
        let __VLS_55;
        const __VLS_56 = ({ click: {} },
            { onClick: (__VLS_ctx.newActiveRound) });
        /** @type {__VLS_StyleScopedClasses['nadle-page__celebrate-btn']} */ ;
        const { default: __VLS_57 } = __VLS_53.slots;
        (__VLS_ctx.t('nadleUi.newWord'));
        // @ts-ignore
        [t, t, canStartNewActiveRound, newActiveRound,];
        var __VLS_53;
        var __VLS_54;
    }
}
else if (__VLS_ctx.displayGameStatus === 'lost') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nadle-page__game-panel-width nadle-page__end-panel nadle-page__end-panel--lost" },
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__game-panel-width']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadle-page__end-panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadle-page__end-panel--lost']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "nadle-page__end-panel-text" },
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__end-panel-text']} */ ;
    (__VLS_ctx.t('nadleUi.lostWasWord'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
        ...{ class: "nadle-page__secret" },
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__secret']} */ ;
    (__VLS_ctx.displaySecretWord);
    if (__VLS_ctx.canStartNewActiveRound) {
        const __VLS_58 = AppButton || AppButton;
        // @ts-ignore
        const __VLS_59 = __VLS_asFunctionalComponent1(__VLS_58, new __VLS_58({
            ...{ 'onClick': {} },
            variant: "primary",
            type: "button",
        }));
        const __VLS_60 = __VLS_59({
            ...{ 'onClick': {} },
            variant: "primary",
            type: "button",
        }, ...__VLS_functionalComponentArgsRest(__VLS_59));
        let __VLS_63;
        const __VLS_64 = ({ click: {} },
            { onClick: (__VLS_ctx.newActiveRound) });
        const { default: __VLS_65 } = __VLS_61.slots;
        (__VLS_ctx.t('nadleUi.newWord'));
        // @ts-ignore
        [t, t, displayGameStatus, displaySecretWord, canStartNewActiveRound, newActiveRound,];
        var __VLS_61;
        var __VLS_62;
    }
}
if (__VLS_ctx.displayGameStatus === 'playing') {
    const __VLS_66 = NadleOnScreenKeyboard;
    // @ts-ignore
    const __VLS_67 = __VLS_asFunctionalComponent1(__VLS_66, new __VLS_66({
        ...{ 'onLetter': {} },
        ...{ 'onBackspace': {} },
        ...{ 'onEnter': {} },
        ...{ 'onSetWordLength': {} },
        wordLength: (__VLS_ctx.activeWordLength),
        row1: (__VLS_ctx.KBD_ROW1),
        row2: (__VLS_ctx.KBD_ROW2),
        row3: (__VLS_ctx.KBD_ROW3),
        wordLengthOptions: (__VLS_ctx.WORD_LENGTH_OPTIONS),
        keysDisabled: (__VLS_ctx.displayBoardLocked),
        enterDisabled: (__VLS_ctx.displayBoardLocked || __VLS_ctx.wordGraphemeCount(__VLS_ctx.normalizeWord(__VLS_ctx.guessInput)) !== __VLS_ctx.activeWordLength),
        letterClass: (__VLS_ctx.activeKbdKeyFeedbackModifier),
        screenKeyboardAria: (__VLS_ctx.t('nadleUi.screenKeyboardAria')),
        kbdToolbarAria: (__VLS_ctx.t('nadleUi.kbdToolbarAria')),
        enterLabel: (__VLS_ctx.t('nadleUi.enter')),
    }));
    const __VLS_68 = __VLS_67({
        ...{ 'onLetter': {} },
        ...{ 'onBackspace': {} },
        ...{ 'onEnter': {} },
        ...{ 'onSetWordLength': {} },
        wordLength: (__VLS_ctx.activeWordLength),
        row1: (__VLS_ctx.KBD_ROW1),
        row2: (__VLS_ctx.KBD_ROW2),
        row3: (__VLS_ctx.KBD_ROW3),
        wordLengthOptions: (__VLS_ctx.WORD_LENGTH_OPTIONS),
        keysDisabled: (__VLS_ctx.displayBoardLocked),
        enterDisabled: (__VLS_ctx.displayBoardLocked || __VLS_ctx.wordGraphemeCount(__VLS_ctx.normalizeWord(__VLS_ctx.guessInput)) !== __VLS_ctx.activeWordLength),
        letterClass: (__VLS_ctx.activeKbdKeyFeedbackModifier),
        screenKeyboardAria: (__VLS_ctx.t('nadleUi.screenKeyboardAria')),
        kbdToolbarAria: (__VLS_ctx.t('nadleUi.kbdToolbarAria')),
        enterLabel: (__VLS_ctx.t('nadleUi.enter')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_67));
    let __VLS_71;
    const __VLS_72 = ({ letter: {} },
        { onLetter: (__VLS_ctx.appendActiveLetter) });
    const __VLS_73 = ({ backspace: {} },
        { onBackspace: (__VLS_ctx.backspaceActiveGuess) });
    const __VLS_74 = ({ enter: {} },
        { onEnter: (__VLS_ctx.submitActiveGuess) });
    const __VLS_75 = ({ setWordLength: {} },
        { onSetWordLength: (__VLS_ctx.setActiveWordLength) });
    var __VLS_69;
    var __VLS_70;
}
// @ts-ignore
[activeWordLength, activeWordLength, t, t, t, displayGameStatus, submitActiveGuess, guessInput, displayBoardLocked, displayBoardLocked, KBD_ROW1, KBD_ROW2, KBD_ROW3, WORD_LENGTH_OPTIONS, wordGraphemeCount, normalizeWord, activeKbdKeyFeedbackModifier, appendActiveLetter, backspaceActiveGuess, setActiveWordLength,];
var __VLS_40;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadle-page__chat-mobile-trigger" },
});
/** @type {__VLS_StyleScopedClasses['nadle-page__chat-mobile-trigger']} */ ;
const __VLS_76 = AppButton || AppButton;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent1(__VLS_76, new __VLS_76({
    ...{ 'onClick': {} },
    type: "button",
    variant: "secondary",
}));
const __VLS_78 = __VLS_77({
    ...{ 'onClick': {} },
    type: "button",
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
let __VLS_81;
const __VLS_82 = ({ click: {} },
    { onClick: (__VLS_ctx.scrollNadleChatIntoView) });
const { default: __VLS_83 } = __VLS_79.slots;
(__VLS_ctx.t('nadleUi.chatMobileOpen'));
// @ts-ignore
[t, scrollNadleChatIntoView,];
var __VLS_79;
var __VLS_80;
const __VLS_84 = AppCard || AppCard;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent1(__VLS_84, new __VLS_84({
    id: (__VLS_ctx.NADLE_STREAM_CHAT_ANCHOR_ID),
    ...{ class: "nadle-page__stack nadle-page__stack--side nadle-page__stack--chat" },
}));
const __VLS_86 = __VLS_85({
    id: (__VLS_ctx.NADLE_STREAM_CHAT_ANCHOR_ID),
    ...{ class: "nadle-page__stack nadle-page__stack--side nadle-page__stack--chat" },
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
/** @type {__VLS_StyleScopedClasses['nadle-page__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--side']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__stack--chat']} */ ;
const { default: __VLS_89 } = __VLS_87.slots;
const __VLS_90 = TwitchRelayChatPanel;
// @ts-ignore
const __VLS_91 = __VLS_asFunctionalComponent1(__VLS_90, new __VLS_90({
    ref: "chatPanelRef",
    flexRail: true,
    showGuessHints: (false),
    wsStatus: (__VLS_ctx.wsStatus),
    wsStatusLabel: "live",
    chatTitle: "Stream chat;",
    guessLenHint: (__VLS_ctx.t('nadleUi.chatGuessLenHint', { n: __VLS_ctx.chatTargetWordLength })),
    channelDisplay: (__VLS_ctx.effectiveTwitchChannel),
    twitchWatchUrl: (__VLS_ctx.twitchWatchUrl),
    openTwitchLabel: "open twitch",
    ircRelayBanner: "",
    relayAriaLabel: (__VLS_ctx.t('nadleUi.chatRelayAria')),
    chatEmptyText: (__VLS_ctx.t('nadleUi.chatEmpty', { channel: __VLS_ctx.effectiveTwitchChannel })),
    guessBadgeLabel: (__VLS_ctx.t('nadleUi.chatGuessBadge')),
    lines: (__VLS_ctx.chatLines),
    defaultCooldownMs: (__VLS_ctx.nadlePublicConfig?.chatGuessCooldownMs ?? 1500),
    formatCooldownHint: (__VLS_ctx.formatCooldownHint),
    feedbackToEmojis: (__VLS_ctx.feedbackToEmojis),
}));
const __VLS_92 = __VLS_91({
    ref: "chatPanelRef",
    flexRail: true,
    showGuessHints: (false),
    wsStatus: (__VLS_ctx.wsStatus),
    wsStatusLabel: "live",
    chatTitle: "Stream chat;",
    guessLenHint: (__VLS_ctx.t('nadleUi.chatGuessLenHint', { n: __VLS_ctx.chatTargetWordLength })),
    channelDisplay: (__VLS_ctx.effectiveTwitchChannel),
    twitchWatchUrl: (__VLS_ctx.twitchWatchUrl),
    openTwitchLabel: "open twitch",
    ircRelayBanner: "",
    relayAriaLabel: (__VLS_ctx.t('nadleUi.chatRelayAria')),
    chatEmptyText: (__VLS_ctx.t('nadleUi.chatEmpty', { channel: __VLS_ctx.effectiveTwitchChannel })),
    guessBadgeLabel: (__VLS_ctx.t('nadleUi.chatGuessBadge')),
    lines: (__VLS_ctx.chatLines),
    defaultCooldownMs: (__VLS_ctx.nadlePublicConfig?.chatGuessCooldownMs ?? 1500),
    formatCooldownHint: (__VLS_ctx.formatCooldownHint),
    feedbackToEmojis: (__VLS_ctx.feedbackToEmojis),
}, ...__VLS_functionalComponentArgsRest(__VLS_91));
var __VLS_95 = {};
var __VLS_93;
// @ts-ignore
[t, t, t, t, NADLE_STREAM_CHAT_ANCHOR_ID, wsStatus, chatTargetWordLength, effectiveTwitchChannel, effectiveTwitchChannel, twitchWatchUrl, chatLines, nadlePublicConfig, formatCooldownHint, feedbackToEmojis,];
var __VLS_87;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
var __VLS_96 = __VLS_95;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
