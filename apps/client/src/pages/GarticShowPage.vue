<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth'
import { useWordleStreamerRoom } from '@/composables/useWordleStreamerRoom'
import TwitchRelayChatPanel from '@/components/twitch/TwitchRelayChatPanel.vue'
import type { TwitchRelayChatWsStatus } from '@/components/twitch/twitchRelayChatTypes'
import {
  useGarticShowOrchestrator,
  type RemoteDrawPayload,
} from '@/features/gartic-show/orchestrator/useGarticShowOrchestrator'
import GarticCanvasBoard from '@/features/gartic-show/components/GarticCanvasBoard.vue'
import GarticHostSettingsPanel from '@/features/gartic-show/components/GarticHostSettingsPanel.vue'
import GarticRoundSetupPanel from '@/features/gartic-show/components/GarticRoundSetupPanel.vue'
import type { GarticRoundSetupWordSource } from '@/features/gartic-show/core/garticTypes'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'

/** Locks the shell to the viewport; see `style.css` (`html.sa-gartic-route`). */
const GARTIC_HTML_CLASS = 'sa-gartic-route'

const { t } = useI18n()
const route = useRoute()
const auth = useAuth()

const manualWord = ref('')
const nextRoundWordEdit = ref('')
const wordSourceUi = ref<GarticRoundSetupWordSource>('global')
const roundDurationSec = ref(180)
const roundsPlanned = ref(10)

const effectiveSlug = computed(() => {
  const p = route.params.streamer
  const s = typeof p === 'string' ? p : Array.isArray(p) ? p[0] : ''
  return String(s ?? '').trim().toLowerCase() || null
})

const { streamerProfile, streamerLoadError, loadStreamerCard, effectiveTwitchChannel } = useWordleStreamerRoom({
  effectiveWordleSlug: effectiveSlug,
  demoFallbackChannel: STREAMER_NICK,
})

const orch = useGarticShowOrchestrator({
  route,
  streamerProfile,
  authLoaded: computed(() => auth.loaded.value),
  isAuthenticated: computed(() => auth.isAuthenticated.value),
})

const {
  garticState,
  chatLines,
  lastWsError,
  wsStatus,
  nowTick,
  showHostChrome,
  startRound,
  clearCanvasOnly,
  ackNextRound,
  sendDrawStart,
  sendDrawMove,
  sendDrawEnd,
  onCanvasClear,
  onRemoteDraw,
} = orch

const boardRef = useTemplateRef<{ clearBoard: () => void; applyRemote: (p: RemoteDrawPayload) => void }>('boardRef')
const chatPanelRef = ref<InstanceType<typeof TwitchRelayChatPanel> | null>(null)

onCanvasClear(() => {
  boardRef.value?.clearBoard()
})

onRemoteDraw((p) => {
  boardRef.value?.applyRemote(p)
})

const roundSecondsLeft = computed(() => {
  const st = garticState.value
  if (!st || st.phase === 'idle' || st.phase === 'revealed' || st.phase === 'between_rounds') {
    return null
  }
  const ms = st.endsAt - (nowTick.value ?? Date.now())
  return Math.max(0, Math.ceil(ms / 1000))
})

const roundsPlanHud = computed(() => {
  const st = garticState.value
  if (!st || !st.roundsPlanned || st.roundsPlanned < 1) {
    return ''
  }
  const current = st.roundNumber ?? 1
  return t('garticShow.roundProgressHud', { current, total: st.roundsPlanned })
})

/** Full setup (overlay) only when no multi-round session is active. */
const showRoundSetupOverlay = computed(() => {
  if (!showHostChrome.value) {
    return false
  }
  const st = garticState.value
  if (!st || st.phase !== 'idle') {
    return false
  }
  return (st.roundsPlanned ?? 0) === 0
})

const showWordStripInCamera = computed(() => {
  if (!showHostChrome.value) {
    return false
  }
  const st = garticState.value
  if (!st) {
    return false
  }
  const setupManual = showRoundSetupOverlay.value && wordSourceUi.value === 'manual'
  const betweenNext =
    st.phase === 'between_rounds' && st.breakSessionFinished !== true
  return setupManual || betweenNext
})

const wordStripModel = computed({
  get(): string {
    if (garticState.value?.phase === 'between_rounds') {
      return nextRoundWordEdit.value
    }
    return manualWord.value
  },
  set(v: string) {
    if (garticState.value?.phase === 'between_rounds') {
      nextRoundWordEdit.value = v
    } else {
      manualWord.value = v
    }
  },
})

const wordStripLabel = computed(() => {
  if (garticState.value?.phase === 'between_rounds') {
    return t('garticShow.nextRoundWordLabel')
  }
  return t('garticShow.sectionWord')
})

const showBetweenRoundOverlay = computed(() => garticState.value?.phase === 'between_rounds')

const breakOverlayHeadline = computed(() => {
  const st = garticState.value
  if (!st || st.phase !== 'between_rounds') {
    return ''
  }
  if (st.breakSessionFinished) {
    return t('garticShow.breakSessionCompleteTitle')
  }
  if (st.breakHadWinner && st.breakWinnerDisplayName) {
    return t('garticShow.breakRoundSummaryWinner', { name: st.breakWinnerDisplayName })
  }
  return t('garticShow.breakRoundSummaryNobody')
})

const breakAckButtonLabel = computed(() => {
  const st = garticState.value
  if (!st || st.phase !== 'between_rounds') {
    return ''
  }
  if (st.breakSessionFinished) {
    return t('garticShow.breakFinishSession')
  }
  return t('garticShow.breakContinueNextRound')
})

const breakAckDisabled = computed(() => {
  const st = garticState.value
  if (!st || st.phase !== 'between_rounds' || st.breakSessionFinished) {
    return false
  }
  if (st.sessionWordSource === 'manual') {
    return nextRoundWordEdit.value.trim().length === 0
  }
  return false
})

const gameFeelLine = computed(() => {
  const st = garticState.value
  if (!st || st.phase === 'idle') {
    return `🟡 ${t('garticShow.gameFeelWaiting')}`
  }
  if (st.phase === 'between_rounds') {
    return `🟠 ${t('garticShow.gameFeelBetween')}`
  }
  if (st.phase === 'revealed') {
    return `🔴 ${t('garticShow.gameFeelEnd')}`
  }
  return `🟢 ${t('garticShow.gameFeelRound')}`
})

const showCanvasIdleOverlay = computed(() => garticState.value?.phase === 'idle')

const viewerIdleVeil = computed(
  () => showCanvasIdleOverlay.value && !showHostChrome.value,
)

/** Viewer idle veil; host sees round setup on the same overlay layer. */
const canvasIdleOverlayLine = computed(() => t('garticShow.canvasEmptyTitleViewer'))

const roundSetupStartDisabled = computed(
  () => wordSourceUi.value === 'manual' && manualWord.value.trim().length === 0,
)

function backendWordSource(ui: GarticRoundSetupWordSource): 'manual' | 'db' | 'random' {
  if (ui === 'manual') {
    return 'manual'
  }
  if (ui === 'channel') {
    return 'db'
  }
  return 'random'
}

const showCanvasStatsHud = computed(() => {
  const st = garticState.value
  return Boolean(st && st.phase !== 'idle')
})

/** Streamer-only: word to draw — shown on the camera strip while drawing. */
const canvasHostWordToDrawInCamera = computed((): { label: string; word: string } | null => {
  if (!showHostChrome.value) {
    return null
  }
  const st = garticState.value
  if (!st || (st.phase !== 'drawing_locked' && st.phase !== 'drawing_active')) {
    return null
  }
  const w = st.currentWord?.trim()
  if (!w) {
    return null
  }
  return { label: 'garticShow.canvasWordToDraw', word: w }
})

/** Streamer-only: revealed word at round end — canvas HUD (and break modal when it covers the board). */
const canvasHostWordWasForHost = computed((): { word: string } | null => {
  if (!showHostChrome.value) {
    return null
  }
  const st = garticState.value
  if (!st || (st.phase !== 'revealed' && st.phase !== 'between_rounds')) {
    return null
  }
  const w = st.currentWord?.trim()
  if (!w) {
    return null
  }
  return { word: w }
})

const maskedWordDisplay = computed(() => {
  const m = garticState.value?.maskedWord?.trim()
  if (!m || m === '—') {
    return '—'
  }
  return m
})

function garticLineCid(id: string, index: number): number {
  let h = index
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i)
  }
  return Math.abs(h)
}

const garticRelayChatLines = computed(() =>
  (chatLines.value ?? []).map((line, i) => ({
    _cid: garticLineCid(line.id, i),
    displayName: line.displayName,
    text: line.text,
    validGuess: false,
    system: line.system === true,
  })),
)

watch(
  garticRelayChatLines,
  () => {
    void nextTick(() => chatPanelRef.value?.scrollToBottom())
  },
  { deep: true },
)

const garticChatWsPillStatus = computed((): TwitchRelayChatWsStatus => {
  if (wsStatus.value === 'open') {
    return 'open'
  }
  if (lastWsError.value) {
    return 'error'
  }
  return 'idle'
})

const garticChatWsLabel = computed(() => {
  if (lastWsError.value) {
    return lastWsError.value
  }
  if (wsStatus.value === 'open') {
    return t('garticShow.wsDotConnected')
  }
  if (wsStatus.value === 'reconnecting') {
    return t('garticShow.wsDotReconnecting')
  }
  return t('garticShow.wsDotOffline')
})

const twitchWatchUrl = computed(
  () => `https://www.twitch.tv/${encodeURIComponent(effectiveTwitchChannel.value)}`,
)

function formatGarticCooldownHint(ms: number): string {
  const s = ms / 1000
  const label = Number.isInteger(s) ? String(s) : s.toFixed(1)
  return t('wordleUi.cooldownHint', { seconds: label })
}

function garticFeedbackToEmojis(): string {
  return ''
}

function onStart(): void {
  if (roundSetupStartDisabled.value) {
    return
  }
  const rp = Math.min(50, Math.max(1, Math.floor(Number(roundsPlanned.value) || 1)))
  const rd = Math.min(600, Math.max(10, Math.floor(Number(roundDurationSec.value) || 180)))
  roundsPlanned.value = rp
  roundDurationSec.value = rd
  const src = backendWordSource(wordSourceUi.value)
  if (src === 'manual') {
    startRound('manual', manualWord.value.trim(), rd, rp)
  } else {
    startRound(src, undefined, rd, rp)
  }
}

function onClearCanvas(): void {
  boardRef.value?.clearBoard()
  clearCanvasOnly()
}

function onAckBetweenRound(): void {
  const st = garticState.value
  if (!st || st.phase !== 'between_rounds') {
    return
  }
  if (st.breakSessionFinished) {
    ackNextRound()
    return
  }
  const w = nextRoundWordEdit.value.trim()
  if (st.sessionWordSource === 'manual') {
    if (!w) {
      return
    }
    ackNextRound(w)
    return
  }
  ackNextRound(w.length > 0 ? w : undefined)
}

onMounted(() => {
  document.documentElement.classList.add(GARTIC_HTML_CLASS)
  void loadStreamerCard()
})

onUnmounted(() => {
  document.documentElement.classList.remove(GARTIC_HTML_CLASS)
})

watch(effectiveSlug, () => {
  void loadStreamerCard()
})

watch(
  () => garticState.value?.phase,
  (p) => {
    if (p === 'drawing_locked' || p === 'drawing_active') {
      manualWord.value = ''
    }
  },
)

watch(
  () => garticState.value,
  (st) => {
    if (st?.phase === 'between_rounds' && typeof st.nextWordDraft === 'string') {
      nextRoundWordEdit.value = st.nextWordDraft
    }
  },
  { deep: true },
)
</script>

<template>
  <div
    class="relative flex h-full min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100"
  >
    <h1 class="sr-only">{{ t('garticShow.title') }}</h1>

    <div
      v-if="streamerLoadError"
      class="pointer-events-none fixed right-3 top-3 z-[100] flex flex-col items-end gap-1"
      role="status"
      aria-live="polite"
    >
      <p
        class="pointer-events-auto max-w-[min(16rem,calc(100vw-1.5rem))] rounded-lg border border-red-800/60 bg-red-950/90 px-2 py-1 text-[0.65rem] text-red-200"
      >
        {{ streamerLoadError }}
      </p>
    </div>

    <div class="flex min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden md:flex-row md:gap-3 md:px-4 md:pb-4 md:pt-4">
      <aside
        class="flex w-full max-w-none shrink-0 flex-col gap-3 overflow-hidden px-3 pt-3 max-md:max-h-[min(58vh,100%)] md:h-full md:w-[320px] md:min-w-[280px] md:max-w-[320px] md:min-h-0 md:px-0 md:pt-0"
      >
        <!-- Single merged card: HUD + camera + streamer controls -->
        <div
          class="flex shrink-0 flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/90 shadow-md"
        >
          <div class="relative aspect-video w-full shrink-0 overflow-hidden bg-black">
            <div
              class="flex h-full w-full items-center justify-center px-2 text-center text-[0.65rem] leading-snug text-slate-500"
            >
              {{ t('garticShow.cameraPlaceholder') }}
            </div>
            <div
              v-if="canvasHostWordToDrawInCamera || showWordStripInCamera"
              class="pointer-events-none absolute inset-x-0 bottom-0 z-[12] flex max-h-[52%] flex-col justify-end gap-1.5 border-t border-violet-500/20 bg-gradient-to-t from-black via-black/94 to-transparent px-2 pb-1.5 pt-2.5 backdrop-blur-[8px]"
            >
              <div
                v-if="canvasHostWordToDrawInCamera"
                class="pointer-events-none shrink-0 text-center"
              >
                <p class="text-[0.48rem] font-semibold uppercase tracking-wide text-slate-500">
                  {{ t(canvasHostWordToDrawInCamera.label) }}
                </p>
                <p
                  class="mt-0.5 font-mono text-[0.78rem] font-extrabold leading-tight tracking-wide text-violet-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                  :aria-label="t('garticShow.secretStreamerAria')"
                >
                  {{ canvasHostWordToDrawInCamera.word }}
                </p>
              </div>
              <div v-if="showWordStripInCamera" class="pointer-events-auto shrink-0 space-y-1">
                <label class="sa-panel-eat__label !mb-0 !text-[0.48rem]" for="gartic-word-strip-cam">{{
                  wordStripLabel
                }}</label>
                <input
                  id="gartic-word-strip-cam"
                  v-model="wordStripModel"
                  class="w-full rounded-[var(--ui-radius-lg,10px)] border-2 border-[color:var(--border-input,rgba(255,255,255,0.14))] bg-[color:var(--bg-muted,rgba(15,23,42,0.88))] px-2.5 py-1.5 text-left text-[0.78rem] font-semibold text-[color:var(--text-body,#f8fafc)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] placeholder:text-[color:var(--text-muted,rgba(196,181,253,0.5))] focus:border-[color:var(--border-strong,rgba(167,139,250,0.7))] focus:outline-none focus:ring-2 focus:ring-[color:var(--border-cyan-strong,rgba(56,189,248,0.35))]"
                  type="text"
                  maxlength="80"
                  autocomplete="off"
                  :placeholder="t('garticShow.manualWordInputPlaceholder')"
                />
              </div>
            </div>
          </div>
          <GarticHostSettingsPanel
            v-if="showHostChrome && !showRoundSetupOverlay"
            @clear-canvas="onClearCanvas"
          />
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TwitchRelayChatPanel
            ref="chatPanelRef"
            class="h-full min-h-0 flex-1 overflow-hidden"
            flex-rail
            :show-ws-pill="false"
            :show-guess-hints="false"
            :ws-status="garticChatWsPillStatus"
            :ws-status-label="garticChatWsLabel"
            :chat-title="t('garticShow.chatTitle')"
            guess-len-hint=""
            :channel-display="effectiveTwitchChannel"
            :twitch-watch-url="twitchWatchUrl"
            :open-twitch-label="t('wordleUi.chatOpenTwitch')"
            irc-relay-banner=""
            :relay-aria-label="t('wordleUi.chatRelayAria')"
            :chat-empty-text="t('wordleUi.chatEmpty', { channel: effectiveTwitchChannel })"
            :guess-badge-label="t('wordleUi.chatGuessBadge')"
            :lines="garticRelayChatLines"
            :default-cooldown-ms="1500"
            :format-cooldown-hint="formatGarticCooldownHint"
            :feedback-to-emojis="garticFeedbackToEmojis"
          />
        </div>
      </aside>

      <main class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-visible">
        <div
          class="relative flex min-h-0 flex-1 flex-col overflow-visible max-md:mx-3 max-md:my-3 md:mx-0 md:my-0"
        >
          <div
            class="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-lg shadow-black/40"
          >
            <h2 class="sr-only shrink-0">{{ t('garticShow.canvasTitle') }}</h2>
            <div class="relative min-h-0 flex-1">
              <GarticCanvasBoard
                ref="boardRef"
                class="absolute inset-0 min-h-0 w-full"
                :show-toolbar="
                  showHostChrome && (garticState?.phase === 'drawing_locked' || garticState?.phase === 'drawing_active')
                "
                :can-draw="showHostChrome && (garticState?.phase === 'drawing_locked' || garticState?.phase === 'drawing_active')"
                @draw-start="(id, nx, ny, m) => sendDrawStart(id, nx, ny, m)"
                @draw-move="(id, nx, ny, m) => sendDrawMove(id, nx, ny, m)"
                @draw-end="(id, nx, ny, m) => sendDrawEnd(id, nx, ny, m)"
              >
                <template v-if="showCanvasStatsHud" #hud>
                  <div
                    class="w-full max-w-full px-0.5"
                    role="status"
                    aria-live="polite"
                  >
                    <div
                      class="flex w-full min-w-0 flex-col gap-y-1 rounded-lg border border-white/10 bg-slate-950/75 px-2 py-0.5 text-[0.65rem] shadow-md backdrop-blur-md sm:px-2.5 sm:py-1 sm:text-[0.7rem] md:text-xs"
                    >
                      <div
                        class="flex w-full min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 sm:gap-x-2.5"
                      >
                        <span
                          class="min-w-0 max-w-[min(12rem,38vw)] truncate text-center font-mono text-[0.95em] font-extrabold tracking-[0.12em] text-slate-50 sm:max-w-[min(16rem,44vw)] md:tracking-[0.16em]"
                        >
                          {{ maskedWordDisplay }}
                        </span>
                        <span
                          v-if="roundSecondsLeft !== null"
                          class="shrink-0 whitespace-nowrap font-mono font-bold tabular-nums text-amber-200"
                        >
                          ⏱&nbsp;{{ roundSecondsLeft }}s
                        </span>
                        <span
                          class="max-w-[min(28rem,92vw)] shrink-0 text-center font-semibold leading-tight text-slate-300"
                        >
                          {{ gameFeelLine }}
                        </span>
                        <span
                          v-if="roundsPlanHud"
                          class="shrink-0 text-[0.9em] font-bold text-violet-300/95"
                        >
                          {{ roundsPlanHud }}
                        </span>
                      </div>
                      <div
                        v-if="canvasHostWordWasForHost"
                        class="flex w-full min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-0 border-t border-white/10 pt-1 text-[0.62rem] leading-tight text-slate-400 sm:text-[0.65rem]"
                      >
                        <span class="shrink-0 font-semibold uppercase tracking-wide text-slate-500">
                          {{ t('garticShow.canvasWordWas') }}
                        </span>
                        <span
                          class="min-w-0 truncate font-mono text-[0.85rem] font-bold text-violet-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-[0.9rem]"
                          :aria-label="t('garticShow.secretStreamerAria')"
                        >
                          {{ canvasHostWordWasForHost.word }}
                        </span>
                      </div>
                    </div>
                  </div>
                </template>
              </GarticCanvasBoard>
            </div>
          </div>

          <div
            v-if="showRoundSetupOverlay"
            class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-slate-950/85 px-3 py-4 backdrop-blur-sm"
          >
            <GarticRoundSetupPanel
              v-model:word-source="wordSourceUi"
              v-model:round-duration-sec="roundDurationSec"
              v-model:round-count="roundsPlanned"
              class="pointer-events-auto max-h-[min(92vh,42rem)] w-full max-w-md overflow-y-auto shadow-2xl shadow-black/50"
              :start-disabled="roundSetupStartDisabled"
              @start="onStart"
            />
          </div>
          <div
            v-else-if="showBetweenRoundOverlay"
            class="pointer-events-none absolute inset-0 z-[28] flex items-center justify-center rounded-2xl bg-[rgba(2,6,23,0.88)] px-3 py-6 backdrop-blur-[10px]"
            role="status"
            aria-live="polite"
          >
            <div
              class="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-violet-500/55 bg-[#0c0a12] px-5 py-6 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_0_40px_rgba(0,0,0,0.65),0_0_80px_rgba(139,92,246,0.22)] md:px-7 md:py-8"
            >
              <div
                class="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-600/30 blur-2xl"
                aria-hidden="true"
              />
              <div
                class="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-indigo-900/40 blur-2xl"
                aria-hidden="true"
              />
              <p
                class="relative text-[0.65rem] font-extrabold uppercase leading-tight tracking-[0.16em] text-violet-300 md:text-[0.72rem]"
              >
                {{ t('garticShow.breakOverlayKicker') }}
              </p>
              <p
                class="relative mt-3 text-lg font-extrabold leading-snug text-white [text-shadow:0_1px_0_rgb(0_0_0),0_2px_12px_rgb(0_0_0)] md:text-xl"
              >
                {{ breakOverlayHeadline }}
              </p>
              <div
                v-if="showHostChrome && canvasHostWordWasForHost"
                class="relative mt-3 flex flex-col items-center gap-0.5"
              >
                <span
                  class="text-[0.6rem] font-semibold uppercase tracking-wide text-slate-500 md:text-[0.65rem]"
                >
                  {{ t('garticShow.canvasWordWas') }}
                </span>
                <span
                  class="font-mono text-base font-extrabold tracking-wide text-violet-100 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] md:text-lg"
                  :aria-label="t('garticShow.secretStreamerAria')"
                >
                  {{ canvasHostWordWasForHost.word }}
                </span>
              </div>
              <p
                v-if="roundsPlanHud"
                class="relative mt-3 text-sm font-bold tabular-nums text-slate-100 md:text-base"
              >
                {{ roundsPlanHud }}
              </p>
              <button
                v-if="showHostChrome"
                type="button"
                class="sa-cta-accent relative mt-6 w-full max-w-xs !min-h-11 !text-[0.88rem]"
                :disabled="breakAckDisabled"
                @click="onAckBetweenRound"
              >
                {{ breakAckButtonLabel }}
              </button>
              <p v-else class="relative mt-5 text-sm font-semibold text-slate-200">
                {{ t('garticShow.breakViewerWait') }}
              </p>
            </div>
          </div>
          <div
            v-else-if="viewerIdleVeil"
            class="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-slate-950/88 px-4 backdrop-blur-[2px]"
          >
            <p class="text-center text-base font-semibold text-violet-100/95 md:text-lg">
              {{ canvasIdleOverlayLine }}
            </p>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
