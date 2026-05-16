/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuth } from '@/composables/useAuth';
import { useNadleStreamerRoom } from '@/composables/useNadleStreamerRoom';
import TwitchRelayChatPanel from '@/components/twitch/TwitchRelayChatPanel.vue';
import { useNadrawShowOrchestrator, } from '@/features/nadraw-show/orchestrator/useNadrawShowOrchestrator';
import NadrawCanvasBoard from '@/features/nadraw-show/components/NadrawCanvasBoard.vue';
import NadrawRoundSetupPanel from '@/features/nadraw-show/components/NadrawRoundSetupPanel.vue';
import { STREAMER_NICK } from '@/eat-first/constants/brand.js';
import cloudWideSrc from '@/assets/landing/clouds/cloud-wide-volumetric.webp';
import hudRoundBodySrc from '@/assets/nadraw-show/hud-round-body.svg';
import hudTimerSrc from '@/assets/nadraw-show/hud-timer.svg';
const NADRAW_HTML_CLASS = 'sa-nadraw-route';
const NADRAW_STAGE_WIDTH = 1440;
const NADRAW_STAGE_CONTENT_WIDTH = 1425;
const NADRAW_STAGE_HEIGHT = 784;
const NADRAW_COMPACT_BREAKPOINT = 936;
const NADRAW_FLUID_BREAKPOINT = 1440;
const { t } = useI18n();
const route = useRoute();
const auth = useAuth();
const manualWord = ref('');
const nextRoundWordEdit = ref('');
const wordSourceUi = ref('global');
const roundDurationSec = ref(30);
const roundsPlanned = ref(5);
const effectiveSlug = computed(() => {
    const p = route.params.streamer;
    const s = typeof p === 'string' ? p : Array.isArray(p) ? p[0] : '';
    return String(s ?? '').trim().toLowerCase() || null;
});
const { streamerProfile, streamerLoadError, loadStreamerCard, effectiveTwitchChannel } = useNadleStreamerRoom({
    effectiveNadleSlug: effectiveSlug,
    demoFallbackChannel: STREAMER_NICK,
});
const orch = useNadrawShowOrchestrator({
    route,
    streamerProfile,
    authLoaded: computed(() => auth.loaded.value),
    isAuthenticated: computed(() => auth.isAuthenticated.value),
});
const { nadrawState, chatLines, lastWsError, wsStatus, nowTick, showHostChrome, startRound, clearRound, ackNextRound, sendDrawStart, sendDrawMove, sendDrawEnd, onCanvasClear, onRemoteDraw, } = orch;
const boardRef = useTemplateRef('boardRef');
const pageRef = useTemplateRef('pageRef');
const chatPanelRef = ref(null);
const nadrawStageScale = ref(1);
const nadrawStageLayoutHeight = ref(NADRAW_STAGE_HEIGHT);
const nadrawCompact = ref(false);
const nadrawFluid = ref(false);
const nadrawStageStyle = computed(() => ({
    '--nadraw-stage-scale': nadrawStageScale.value.toFixed(4),
    '--nadraw-stage-layout-height': `${nadrawStageLayoutHeight.value}px`,
    '--nadraw-stage-visual-height': `${Math.ceil(nadrawStageLayoutHeight.value * nadrawStageScale.value)}px`,
}));
let nadrawStageResizeObserver = null;
function syncNadrawStageScale() {
    const width = pageRef.value?.clientWidth || window.innerWidth || NADRAW_STAGE_WIDTH;
    const height = window.innerHeight || NADRAW_STAGE_HEIGHT;
    nadrawCompact.value = width < NADRAW_COMPACT_BREAKPOINT;
    nadrawStageLayoutHeight.value = nadrawCompact.value ? NADRAW_STAGE_HEIGHT : Math.max(NADRAW_STAGE_HEIGHT, height - 116);
    nadrawFluid.value = !nadrawCompact.value && width >= NADRAW_FLUID_BREAKPOINT;
    if (nadrawCompact.value) {
        nadrawStageScale.value = 1;
        return;
    }
    if (nadrawFluid.value) {
        nadrawStageScale.value = 1;
        return;
    }
    const availableContentWidth = Math.max(1, width);
    const next = Math.min(1, availableContentWidth / NADRAW_STAGE_CONTENT_WIDTH);
    nadrawStageScale.value = next;
}
onCanvasClear(() => {
    boardRef.value?.clearBoard();
});
onRemoteDraw((p) => {
    boardRef.value?.applyRemote(p);
});
const roundSecondsLeft = computed(() => {
    const st = nadrawState.value;
    if (!st || st.phase === 'idle' || st.phase === 'revealed' || st.phase === 'between_rounds') {
        return null;
    }
    const ms = st.endsAt - (nowTick.value ?? Date.now());
    return Math.max(0, Math.ceil(ms / 1000));
});
const showRoundSetupOverlay = computed(() => {
    if (!showHostChrome.value) {
        return false;
    }
    const st = nadrawState.value;
    if (!st || st.phase !== 'idle') {
        return false;
    }
    return (st.roundsPlanned ?? 0) === 0;
});
const showWordStripInCamera = computed(() => {
    if (!showHostChrome.value) {
        return false;
    }
    const st = nadrawState.value;
    if (!st) {
        return false;
    }
    const setupManual = showRoundSetupOverlay.value && wordSourceUi.value === 'manual';
    const betweenNext = st.phase === 'between_rounds' && st.breakSessionFinished !== true;
    return setupManual || betweenNext;
});
const wordStripModel = computed({
    get() {
        if (nadrawState.value?.phase === 'between_rounds') {
            return nextRoundWordEdit.value;
        }
        return manualWord.value;
    },
    set(v) {
        if (nadrawState.value?.phase === 'between_rounds') {
            nextRoundWordEdit.value = v;
        }
        else {
            manualWord.value = v;
        }
    },
});
const hostCurrentWord = computed(() => canvasHostWordToDrawInCamera.value?.word ?? '');
const showWordChoicePanel = computed(() => {
    if (!showHostChrome.value) {
        return false;
    }
    return showWordStripInCamera.value || hostCurrentWord.value.length > 0;
});
const wordChoiceModel = computed({
    get() {
        if (showWordStripInCamera.value) {
            return wordStripModel.value;
        }
        return hostCurrentWord.value || manualWord.value;
    },
    set(v) {
        if (showWordStripInCamera.value || showRoundSetupOverlay.value) {
            wordStripModel.value = v;
        }
        else {
            manualWord.value = v;
        }
    },
});
const wordChoiceReadonly = computed(() => hostCurrentWord.value.length > 0 && !showWordStripInCamera.value);
const wordChoiceSubmitDisabled = computed(() => {
    if (wordChoiceReadonly.value) {
        return false;
    }
    return wordChoiceModel.value.trim().length === 0;
});
const showBetweenRoundOverlay = computed(() => nadrawState.value?.phase === 'between_rounds');
const showCanvasInitVeil = computed(() => nadrawState.value === null);
const breakOverlayHeadline = computed(() => {
    const st = nadrawState.value;
    if (!st || st.phase !== 'between_rounds') {
        return '';
    }
    if (st.breakSessionFinished) {
        return t('nadrawShow.breakSessionCompleteTitle');
    }
    if (st.breakHadWinner && st.breakWinnerDisplayName) {
        return t('nadrawShow.breakRoundSummaryWinner', { name: st.breakWinnerDisplayName });
    }
    return t('nadrawShow.breakRoundSummaryNobody');
});
const breakAckButtonLabel = computed(() => {
    const st = nadrawState.value;
    if (!st || st.phase !== 'between_rounds') {
        return '';
    }
    if (st.breakSessionFinished) {
        return t('nadrawShow.breakFinishSession');
    }
    return t('nadrawShow.breakContinueNextRound');
});
const breakAckDisabled = computed(() => {
    const st = nadrawState.value;
    if (!st || st.phase !== 'between_rounds' || st.breakSessionFinished) {
        return false;
    }
    if (st.sessionWordSource === 'manual') {
        return nextRoundWordEdit.value.trim().length === 0 && String(st.nextWordDraft ?? '').trim().length === 0;
    }
    return false;
});
const viewerIdleVeil = computed(() => {
    if (showHostChrome.value) {
        return false;
    }
    const st = nadrawState.value;
    return st === null || st.phase === 'idle';
});
const canvasIdleOverlayLine = computed(() => t('nadrawShow.canvasEmptyTitleViewer'));
const roundSetupStartDisabled = computed(() => wordSourceUi.value === 'manual' && manualWord.value.trim().length === 0);
function backendWordSource(ui) {
    if (ui === 'manual') {
        return 'manual';
    }
    if (ui === 'channel') {
        return 'db';
    }
    return 'random';
}
const showCanvasStatsHud = computed(() => {
    const st = nadrawState.value;
    return Boolean(st && st.phase !== 'idle');
});
const canvasHostWordToDrawInCamera = computed(() => {
    if (!showHostChrome.value) {
        return null;
    }
    const st = nadrawState.value;
    if (!st || (st.phase !== 'drawing_locked' && st.phase !== 'drawing_active')) {
        return null;
    }
    const w = st.currentWord?.trim();
    if (!w) {
        return null;
    }
    return { label: 'nadrawShow.canvasWordToDraw', word: w };
});
const canvasHostWordWasForHost = computed(() => {
    if (!showHostChrome.value) {
        return null;
    }
    const st = nadrawState.value;
    if (!st || (st.phase !== 'revealed' && st.phase !== 'between_rounds')) {
        return null;
    }
    const w = st.currentWord?.trim();
    if (!w) {
        return null;
    }
    return { word: w };
});
const maskedWordDisplay = computed(() => {
    const m = nadrawState.value?.maskedWord?.trim();
    if (m && m !== '—') {
        return m.replace(/\s+/g, ' ');
    }
    const w = nadrawState.value?.currentWord?.trim();
    if (w) {
        return Array.from(w)
            .map((ch) => (ch.trim() ? '_' : ' '))
            .join(' ');
    }
    return '';
});
const showMaskedWordHud = computed(() => maskedWordDisplay.value.trim().length > 0);
function formatClockSeconds(total) {
    const safe = Math.max(0, Math.floor(total));
    const mm = Math.floor(safe / 60);
    const ss = String(safe % 60).padStart(2, '0');
    return `${mm}:${ss}`;
}
const roundClockLabel = computed(() => {
    const sec = roundSecondsLeft.value ?? nadrawState.value?.roundDurationSec ?? roundDurationSec.value;
    return formatClockSeconds(sec);
});
const roundProgressLabel = computed(() => {
    const st = nadrawState.value;
    const total = st?.roundsPlanned && st.roundsPlanned > 0 ? st.roundsPlanned : roundsPlanned.value;
    const current = st && st.phase !== 'idle'
        ? Math.max(0, Math.min(total, (st.roundNumber ?? 1) - (st.phase === 'between_rounds' ? 0 : 1)))
        : 0;
    return `${current}/${total}`;
});
function nadrawLineCid(id, index) {
    let h = index;
    for (let i = 0; i < id.length; i++) {
        h = Math.imul(31, h) + id.charCodeAt(i);
    }
    return Math.abs(h);
}
const nadrawRelayChatLines = computed(() => (chatLines.value ?? []).map((line, i) => ({
    _cid: nadrawLineCid(line.id, i),
    displayName: line.displayName,
    text: line.text,
    validGuess: false,
    system: line.system === true,
})));
watch(nadrawRelayChatLines, () => {
    void nextTick(() => chatPanelRef.value?.scrollToBottom());
}, { deep: true });
const nadrawChatWsPillStatus = computed(() => {
    if (wsStatus.value === 'open') {
        return 'open';
    }
    if (lastWsError.value) {
        return 'error';
    }
    return 'idle';
});
const twitchWatchUrl = computed(() => `https://www.twitch.tv/${encodeURIComponent(effectiveTwitchChannel.value)}`);
function formatNadrawCooldownHint(ms) {
    const s = ms / 1000;
    const label = Number.isInteger(s) ? String(s) : s.toFixed(1);
    return t('nadleUi.cooldownHint', { seconds: label });
}
function nadrawFeedbackToEmojis() {
    return '';
}
function onStart() {
    if (roundSetupStartDisabled.value) {
        return;
    }
    const rp = Math.min(100, Math.max(1, Math.floor(Number(roundsPlanned.value) || 1)));
    const rd = Math.min(600, Math.max(10, Math.floor(Number(roundDurationSec.value) || 30)));
    roundsPlanned.value = rp;
    roundDurationSec.value = rd;
    const src = backendWordSource(wordSourceUi.value);
    if (src === 'manual') {
        startRound('manual', manualWord.value.trim(), rd, rp);
    }
    else {
        startRound(src, undefined, rd, rp);
    }
}
function onResetGame() {
    if (!showHostChrome.value) {
        return;
    }
    clearRound();
    boardRef.value?.clearBoard();
    manualWord.value = '';
    nextRoundWordEdit.value = '';
}
function onAckBetweenRound() {
    const st = nadrawState.value;
    if (!st || st.phase !== 'between_rounds') {
        return;
    }
    if (st.breakSessionFinished) {
        ackNextRound();
        return;
    }
    const w = nextRoundWordEdit.value.trim();
    const draft = String(st.nextWordDraft ?? '').trim();
    const nextWord = w.length > 0 ? w : (draft.length > 0 ? draft : undefined);
    if (st.sessionWordSource === 'manual') {
        ackNextRound(nextWord);
        return;
    }
    ackNextRound(nextWord);
}
function onWordPanelSubmit() {
    if (wordChoiceSubmitDisabled.value) {
        return;
    }
    if (showRoundSetupOverlay.value) {
        onStart();
        return;
    }
    if (nadrawState.value?.phase === 'between_rounds') {
        onAckBetweenRound();
    }
}
onMounted(() => {
    document.documentElement.classList.add(NADRAW_HTML_CLASS);
    void loadStreamerCard();
    void nextTick(syncNadrawStageScale);
    if (pageRef.value) {
        nadrawStageResizeObserver = new ResizeObserver(syncNadrawStageScale);
        nadrawStageResizeObserver.observe(pageRef.value);
    }
    window.addEventListener('resize', syncNadrawStageScale, { passive: true });
});
onUnmounted(() => {
    document.documentElement.classList.remove(NADRAW_HTML_CLASS);
    nadrawStageResizeObserver?.disconnect();
    nadrawStageResizeObserver = null;
    window.removeEventListener('resize', syncNadrawStageScale);
});
watch(effectiveSlug, () => {
    void loadStreamerCard();
});
watch(() => nadrawState.value?.phase, (p) => {
    if (p === 'drawing_locked' || p === 'drawing_active') {
        manualWord.value = '';
    }
});
watch(() => nadrawState.value, (st) => {
    if (st?.phase === 'between_rounds' && typeof st.nextWordDraft === 'string') {
        nextRoundWordEdit.value = st.nextWordDraft;
    }
}, { deep: true });
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['app-shell-main__viewport--nadraw']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-main__viewport--nadraw']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-nadraw-route']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-nadraw-route']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-nadraw-route']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-main__viewport--nadraw']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-nadraw-route']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-left']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-camera-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-word-card__input']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-word-card__input']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-word-card__input']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__head']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line-body']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__name']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__name']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__name']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__name']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-inner']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-viewer-veil']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-between__kicker']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-between__title']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-viewer-veil']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-viewer-veil']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-between__button']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-main__viewport--nadraw']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--fluid']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-nadraw-route']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--fluid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--fluid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-stage']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--fluid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--fluid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-left']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--fluid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--fluid']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-stage']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page__cloud']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page__cloud--left']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page__cloud--right']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-main']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-left']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-left']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-camera-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-word-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-word-card__input']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-inner']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup-over-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup-over-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-left']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-inner']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-main--toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-inner']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-board-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup-over-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup-over-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup-over-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup-over-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup-over-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup-over-canvas']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-page" },
    ...{ class: ({ 'nadraw-page--compact': __VLS_ctx.nadrawCompact, 'nadraw-page--fluid': __VLS_ctx.nadrawFluid }) },
    ...{ style: (__VLS_ctx.nadrawStageStyle) },
});
/** @type {__VLS_StyleScopedClasses['nadraw-page']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page--fluid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
    ...{ class: "sr-only" },
});
/** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
(__VLS_ctx.t('nadrawShow.title'));
if (__VLS_ctx.streamerLoadError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "nadraw-page__error" },
        role: "status",
        'aria-live': "polite",
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-page__error']} */ ;
    (__VLS_ctx.streamerLoadError);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "pageRef",
    ...{ class: "nadraw-page__inner" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-page__inner']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-stage" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-stage']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "nadraw-page__cloud nadraw-page__cloud--left" },
    src: (__VLS_ctx.cloudWideSrc),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['nadraw-page__cloud']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page__cloud--left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "nadraw-page__cloud nadraw-page__cloud--right" },
    src: (__VLS_ctx.cloudWideSrc),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['nadraw-page__cloud']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-page__cloud--right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-layout" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-layout']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "nadraw-left" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-left']} */ ;
if (__VLS_ctx.showWordChoicePanel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
        ...{ onSubmit: (__VLS_ctx.onWordPanelSubmit) },
        ...{ class: "nadraw-card nadraw-word-card sa-glass-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadraw-word-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-glass-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "nadraw-word-card__title" },
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-word-card__title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        id: "nadraw-word-panel-input",
        value: (__VLS_ctx.wordChoiceModel),
        ...{ class: "nadraw-word-card__input" },
        type: "text",
        maxlength: "80",
        autocomplete: "off",
        readonly: (__VLS_ctx.wordChoiceReadonly),
        placeholder: "write here...",
        'aria-label': (__VLS_ctx.t('nadrawShow.manualWord')),
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-word-card__input']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "nadraw-card nadraw-camera-card sa-glass-panel" },
        'aria-label': (__VLS_ctx.t('nadrawShow.sectionCamera')),
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadraw-camera-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-glass-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.t('nadrawShow.cameraPlaceholder'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "nadraw-card nadraw-chat-card sa-glass-panel" },
    'aria-label': (__VLS_ctx.t('nadrawShow.chatTitle')),
});
/** @type {__VLS_StyleScopedClasses['nadraw-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-chat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-panel']} */ ;
const __VLS_0 = TwitchRelayChatPanel;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ref: "chatPanelRef",
    ...{ class: "nadraw-chat" },
    flexRail: true,
    showWsPill: (true),
    showGuessHints: (false),
    wsStatus: (__VLS_ctx.nadrawChatWsPillStatus),
    wsStatusLabel: ('live'),
    chatTitle: "Stream chat;",
    guessLenHint: "",
    channelDisplay: (__VLS_ctx.effectiveTwitchChannel),
    twitchWatchUrl: (__VLS_ctx.twitchWatchUrl),
    openTwitchLabel: "open twitch",
    ircRelayBanner: "",
    relayAriaLabel: (__VLS_ctx.t('nadleUi.chatRelayAria')),
    chatEmptyText: (__VLS_ctx.t('nadleUi.chatEmpty', { channel: __VLS_ctx.effectiveTwitchChannel })),
    guessBadgeLabel: (__VLS_ctx.t('nadleUi.chatGuessBadge')),
    lines: (__VLS_ctx.nadrawRelayChatLines),
    defaultCooldownMs: (1500),
    formatCooldownHint: (__VLS_ctx.formatNadrawCooldownHint),
    feedbackToEmojis: (__VLS_ctx.nadrawFeedbackToEmojis),
}));
const __VLS_2 = __VLS_1({
    ref: "chatPanelRef",
    ...{ class: "nadraw-chat" },
    flexRail: true,
    showWsPill: (true),
    showGuessHints: (false),
    wsStatus: (__VLS_ctx.nadrawChatWsPillStatus),
    wsStatusLabel: ('live'),
    chatTitle: "Stream chat;",
    guessLenHint: "",
    channelDisplay: (__VLS_ctx.effectiveTwitchChannel),
    twitchWatchUrl: (__VLS_ctx.twitchWatchUrl),
    openTwitchLabel: "open twitch",
    ircRelayBanner: "",
    relayAriaLabel: (__VLS_ctx.t('nadleUi.chatRelayAria')),
    chatEmptyText: (__VLS_ctx.t('nadleUi.chatEmpty', { channel: __VLS_ctx.effectiveTwitchChannel })),
    guessBadgeLabel: (__VLS_ctx.t('nadleUi.chatGuessBadge')),
    lines: (__VLS_ctx.nadrawRelayChatLines),
    defaultCooldownMs: (1500),
    formatCooldownHint: (__VLS_ctx.formatNadrawCooldownHint),
    feedbackToEmojis: (__VLS_ctx.nadrawFeedbackToEmojis),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
/** @type {__VLS_StyleScopedClasses['nadraw-chat']} */ ;
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
    ...{ class: "nadraw-main" },
    ...{ class: ({ 'nadraw-main--toolbar': __VLS_ctx.showHostChrome }) },
});
/** @type {__VLS_StyleScopedClasses['nadraw-main']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-main--toolbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-board-shell sa-glass-panel" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-board-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-board-inner" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-board-inner']} */ ;
const __VLS_7 = NadrawCanvasBoard || NadrawCanvasBoard;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
    ...{ 'onDrawStart': {} },
    ...{ 'onDrawMove': {} },
    ...{ 'onDrawEnd': {} },
    ...{ 'onResetGame': {} },
    ref: "boardRef",
    ...{ class: "nadraw-canvas-board" },
    showToolbar: (__VLS_ctx.showHostChrome),
    canDraw: (__VLS_ctx.showHostChrome && (__VLS_ctx.nadrawState?.phase === 'drawing_locked' || __VLS_ctx.nadrawState?.phase === 'drawing_active')),
}));
const __VLS_9 = __VLS_8({
    ...{ 'onDrawStart': {} },
    ...{ 'onDrawMove': {} },
    ...{ 'onDrawEnd': {} },
    ...{ 'onResetGame': {} },
    ref: "boardRef",
    ...{ class: "nadraw-canvas-board" },
    showToolbar: (__VLS_ctx.showHostChrome),
    canDraw: (__VLS_ctx.showHostChrome && (__VLS_ctx.nadrawState?.phase === 'drawing_locked' || __VLS_ctx.nadrawState?.phase === 'drawing_active')),
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
let __VLS_12;
const __VLS_13 = ({ drawStart: {} },
    { onDrawStart: ((id, nx, ny, m) => __VLS_ctx.sendDrawStart(id, nx, ny, m)) });
const __VLS_14 = ({ drawMove: {} },
    { onDrawMove: ((id, nx, ny, m) => __VLS_ctx.sendDrawMove(id, nx, ny, m)) });
const __VLS_15 = ({ drawEnd: {} },
    { onDrawEnd: ((id, nx, ny, m) => __VLS_ctx.sendDrawEnd(id, nx, ny, m)) });
const __VLS_16 = ({ resetGame: {} },
    { onResetGame: (__VLS_ctx.onResetGame) });
var __VLS_17 = {};
/** @type {__VLS_StyleScopedClasses['nadraw-canvas-board']} */ ;
const { default: __VLS_19 } = __VLS_10.slots;
if (__VLS_ctx.showCanvasStatsHud) {
    {
        const { hud: __VLS_20 } = __VLS_10.slots;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "nadraw-hud" },
            role: "status",
            'aria-live': "polite",
        });
        /** @type {__VLS_StyleScopedClasses['nadraw-hud']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "nadraw-hud__pill nadraw-hud__pill--timer" },
        });
        /** @type {__VLS_StyleScopedClasses['nadraw-hud__pill']} */ ;
        /** @type {__VLS_StyleScopedClasses['nadraw-hud__pill--timer']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            ...{ class: "nadraw-hud__icon nadraw-hud__icon--timer" },
            src: (__VLS_ctx.hudTimerSrc),
            alt: "",
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['nadraw-hud__icon']} */ ;
        /** @type {__VLS_StyleScopedClasses['nadraw-hud__icon--timer']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.roundClockLabel);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "nadraw-hud__pill nadraw-hud__pill--rounds" },
        });
        /** @type {__VLS_StyleScopedClasses['nadraw-hud__pill']} */ ;
        /** @type {__VLS_StyleScopedClasses['nadraw-hud__pill--rounds']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            ...{ class: "nadraw-hud__icon nadraw-hud__icon--rounds" },
            src: (__VLS_ctx.hudRoundBodySrc),
            alt: "",
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['nadraw-hud__icon']} */ ;
        /** @type {__VLS_StyleScopedClasses['nadraw-hud__icon--rounds']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.roundProgressLabel);
        if (__VLS_ctx.showMaskedWordHud) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "nadraw-hud__pill nadraw-hud__pill--word" },
            });
            /** @type {__VLS_StyleScopedClasses['nadraw-hud__pill']} */ ;
            /** @type {__VLS_StyleScopedClasses['nadraw-hud__pill--word']} */ ;
            (__VLS_ctx.maskedWordDisplay);
        }
        // @ts-ignore
        [nadrawCompact, nadrawFluid, nadrawStageStyle, t, t, t, t, t, t, t, t, streamerLoadError, streamerLoadError, cloudWideSrc, cloudWideSrc, showWordChoicePanel, onWordPanelSubmit, wordChoiceModel, wordChoiceReadonly, nadrawChatWsPillStatus, effectiveTwitchChannel, effectiveTwitchChannel, twitchWatchUrl, nadrawRelayChatLines, formatNadrawCooldownHint, nadrawFeedbackToEmojis, showHostChrome, showHostChrome, showHostChrome, nadrawState, nadrawState, sendDrawStart, sendDrawMove, sendDrawEnd, onResetGame, showCanvasStatsHud, hudTimerSrc, roundClockLabel, hudRoundBodySrc, roundProgressLabel, showMaskedWordHud, maskedWordDisplay,];
    }
}
// @ts-ignore
[];
var __VLS_10;
var __VLS_11;
if (__VLS_ctx.showRoundSetupOverlay) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ class: "nadraw-board-cloud nadraw-board-cloud--setup-left" },
        src: (__VLS_ctx.cloudWideSrc),
        alt: "",
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-board-cloud']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadraw-board-cloud--setup-left']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ class: "nadraw-board-cloud nadraw-board-cloud--setup-right" },
        src: (__VLS_ctx.cloudWideSrc),
        alt: "",
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-board-cloud']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadraw-board-cloud--setup-right']} */ ;
    const __VLS_21 = NadrawRoundSetupPanel;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
        ...{ 'onStart': {} },
        wordSource: (__VLS_ctx.wordSourceUi),
        roundDurationSec: (__VLS_ctx.roundDurationSec),
        roundCount: (__VLS_ctx.roundsPlanned),
        ...{ class: "nadraw-setup-over-canvas" },
        startDisabled: (__VLS_ctx.roundSetupStartDisabled),
    }));
    const __VLS_23 = __VLS_22({
        ...{ 'onStart': {} },
        wordSource: (__VLS_ctx.wordSourceUi),
        roundDurationSec: (__VLS_ctx.roundDurationSec),
        roundCount: (__VLS_ctx.roundsPlanned),
        ...{ class: "nadraw-setup-over-canvas" },
        startDisabled: (__VLS_ctx.roundSetupStartDisabled),
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    let __VLS_26;
    const __VLS_27 = ({ start: {} },
        { onStart: (__VLS_ctx.onStart) });
    /** @type {__VLS_StyleScopedClasses['nadraw-setup-over-canvas']} */ ;
    var __VLS_24;
    var __VLS_25;
}
if (__VLS_ctx.showCanvasInitVeil) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "nadraw-loading-veil" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-loading-veil']} */ ;
}
else if (__VLS_ctx.showBetweenRoundOverlay) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nadraw-between" },
        role: "status",
        'aria-live': "polite",
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-between']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "nadraw-between__kicker" },
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-between__kicker']} */ ;
    (__VLS_ctx.t('nadrawShow.breakOverlayKicker'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "nadraw-between__title" },
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-between__title']} */ ;
    (__VLS_ctx.breakOverlayHeadline);
    if (__VLS_ctx.canvasHostWordWasForHost) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "nadraw-between__word" },
        });
        /** @type {__VLS_StyleScopedClasses['nadraw-between__word']} */ ;
        (__VLS_ctx.canvasHostWordWasForHost.word);
    }
    if (__VLS_ctx.showHostChrome) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.onAckBetweenRound) },
            ...{ class: "nadraw-between__button" },
            type: "button",
            disabled: (__VLS_ctx.breakAckDisabled),
        });
        /** @type {__VLS_StyleScopedClasses['nadraw-between__button']} */ ;
        (__VLS_ctx.breakAckButtonLabel);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "nadraw-between__wait" },
        });
        /** @type {__VLS_StyleScopedClasses['nadraw-between__wait']} */ ;
        (__VLS_ctx.t('nadrawShow.breakViewerWait'));
    }
}
else if (__VLS_ctx.viewerIdleVeil) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nadraw-viewer-veil" },
        role: "status",
        'aria-live': "polite",
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-viewer-veil']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.canvasIdleOverlayLine);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.t('nadrawShow.canvasEmptySubtitleViewer'));
}
// @ts-ignore
var __VLS_6 = __VLS_5, __VLS_18 = __VLS_17;
// @ts-ignore
[t, t, t, cloudWideSrc, cloudWideSrc, showHostChrome, showRoundSetupOverlay, wordSourceUi, roundDurationSec, roundsPlanned, roundSetupStartDisabled, onStart, showCanvasInitVeil, showBetweenRoundOverlay, breakOverlayHeadline, canvasHostWordWasForHost, canvasHostWordWasForHost, onAckBetweenRound, breakAckDisabled, breakAckButtonLabel, viewerIdleVeil, canvasIdleOverlayLine,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
