<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth'
import { useNadleStreamerRoom } from '@/composables/useNadleStreamerRoom'
import TwitchRelayChatPanel from '@/components/twitch/TwitchRelayChatPanel.vue'
import type { TwitchRelayChatWsStatus } from '@/components/twitch/twitchRelayChatTypes'
import {
  useNadrawShowOrchestrator,
  type RemoteDrawPayload,
} from '@/features/nadraw-show/orchestrator/useNadrawShowOrchestrator'
import NadrawCanvasBoard from '@/features/nadraw-show/components/NadrawCanvasBoard.vue'
import NadrawHostSettingsPanel from '@/features/nadraw-show/components/NadrawHostSettingsPanel.vue'
import NadrawRoundSetupPanel from '@/features/nadraw-show/components/NadrawRoundSetupPanel.vue'
import type { NadrawRoundSetupWordSource } from '@/features/nadraw-show/core/nadrawTypes'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'

/** Locks the shell to the viewport; see `style.css` (`html.sa-nadraw-route`). */
const NADRAW_HTML_CLASS = 'sa-nadraw-route'

const { t } = useI18n()
const route = useRoute()
const auth = useAuth()

const manualWord = ref('')
const nextRoundWordEdit = ref('')
const wordSourceUi = ref<NadrawRoundSetupWordSource>('global')
const roundDurationSec = ref(180)
const roundsPlanned = ref(10)

const effectiveSlug = computed(() => {
  const p = route.params.streamer
  const s = typeof p === 'string' ? p : Array.isArray(p) ? p[0] : ''
  return String(s ?? '').trim().toLowerCase() || null
})

const { streamerProfile, streamerLoadError, loadStreamerCard, effectiveTwitchChannel } = useNadleStreamerRoom({
  effectiveNadleSlug: effectiveSlug,
  demoFallbackChannel: STREAMER_NICK,
})

const orch = useNadrawShowOrchestrator({
  route,
  streamerProfile,
  authLoaded: computed(() => auth.loaded.value),
  isAuthenticated: computed(() => auth.isAuthenticated.value),
})

const {
  nadrawState,
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
  const st = nadrawState.value
  if (!st || st.phase === 'idle' || st.phase === 'revealed' || st.phase === 'between_rounds') {
    return null
  }
  const ms = st.endsAt - (nowTick.value ?? Date.now())
  return Math.max(0, Math.ceil(ms / 1000))
})

const roundsPlanHud = computed(() => {
  const st = nadrawState.value
  if (!st || !st.roundsPlanned || st.roundsPlanned < 1) {
    return ''
  }
  const current = st.roundNumber ?? 1
  return t('nadrawShow.roundProgressHud', { current, total: st.roundsPlanned })
})

/** Full setup (overlay) only when no multi-round session is active. */
const showRoundSetupOverlay = computed(() => {
  if (!showHostChrome.value) {
    return false
  }
  const st = nadrawState.value
  if (!st || st.phase !== 'idle') {
    return false
  }
  return (st.roundsPlanned ?? 0) === 0
})

const showWordStripInCamera = computed(() => {
  if (!showHostChrome.value) {
    return false
  }
  const st = nadrawState.value
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
    if (nadrawState.value?.phase === 'between_rounds') {
      return nextRoundWordEdit.value
    }
    return manualWord.value
  },
  set(v: string) {
    if (nadrawState.value?.phase === 'between_rounds') {
      nextRoundWordEdit.value = v
    } else {
      manualWord.value = v
    }
  },
})

const wordStripLabel = computed(() => {
  if (nadrawState.value?.phase === 'between_rounds') {
    return t('nadrawShow.nextRoundWordLabel')
  }
  return t('nadrawShow.sectionWord')
})

const showBetweenRoundOverlay = computed(() => nadrawState.value?.phase === 'between_rounds')
const showCanvasInitVeil = computed(() => nadrawState.value === null)

const breakOverlayHeadline = computed(() => {
  const st = nadrawState.value
  if (!st || st.phase !== 'between_rounds') {
    return ''
  }
  if (st.breakSessionFinished) {
    return t('nadrawShow.breakSessionCompleteTitle')
  }
  if (st.breakHadWinner && st.breakWinnerDisplayName) {
    return t('nadrawShow.breakRoundSummaryWinner', { name: st.breakWinnerDisplayName })
  }
  return t('nadrawShow.breakRoundSummaryNobody')
})

const breakAckButtonLabel = computed(() => {
  const st = nadrawState.value
  if (!st || st.phase !== 'between_rounds') {
    return ''
  }
  if (st.breakSessionFinished) {
    return t('nadrawShow.breakFinishSession')
  }
  return t('nadrawShow.breakContinueNextRound')
})

const breakAckDisabled = computed(() => {
  const st = nadrawState.value
  if (!st || st.phase !== 'between_rounds' || st.breakSessionFinished) {
    return false
  }
  if (st.sessionWordSource === 'manual') {
    return nextRoundWordEdit.value.trim().length === 0
  }
  return false
})

const gameFeelLine = computed(() => {
  const st = nadrawState.value
  if (!st || st.phase === 'idle') {
    return `🟡 ${t('nadrawShow.gameFeelWaiting')}`
  }
  if (st.phase === 'between_rounds') {
    return `🟠 ${t('nadrawShow.gameFeelBetween')}`
  }
  if (st.phase === 'revealed') {
    return `🔴 ${t('nadrawShow.gameFeelEnd')}`
  }
  return `🟢 ${t('nadrawShow.gameFeelRound')}`
})

/** Viewers: lobby veil until server state arrives or round is idle (host sees setup panel instead). */
const viewerIdleVeil = computed(() => {
  if (showHostChrome.value) {
    return false
  }
  const st = nadrawState.value
  return st === null || st.phase === 'idle'
})

const canvasIdleOverlayLine = computed(() => t('nadrawShow.canvasEmptyTitleViewer'))

const roundSetupStartDisabled = computed(
  () => wordSourceUi.value === 'manual' && manualWord.value.trim().length === 0,
)

function backendWordSource(ui: NadrawRoundSetupWordSource): 'manual' | 'db' | 'random' {
  if (ui === 'manual') {
    return 'manual'
  }
  if (ui === 'channel') {
    return 'db'
  }
  return 'random'
}

const showCanvasStatsHud = computed(() => {
  const st = nadrawState.value
  return Boolean(st && st.phase !== 'idle')
})

/** Streamer-only: word to draw — shown on the camera strip while drawing. */
const canvasHostWordToDrawInCamera = computed((): { label: string; word: string } | null => {
  if (!showHostChrome.value) {
    return null
  }
  const st = nadrawState.value
  if (!st || (st.phase !== 'drawing_locked' && st.phase !== 'drawing_active')) {
    return null
  }
  const w = st.currentWord?.trim()
  if (!w) {
    return null
  }
  return { label: 'nadrawShow.canvasWordToDraw', word: w }
})

/** Streamer-only: revealed word at round end — canvas HUD (and break modal when it covers the board). */
const canvasHostWordWasForHost = computed((): { word: string } | null => {
  if (!showHostChrome.value) {
    return null
  }
  const st = nadrawState.value
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
  const m = nadrawState.value?.maskedWord?.trim()
  if (!m || m === '—') {
    return '—'
  }
  return m
})

function nadrawLineCid(id: string, index: number): number {
  let h = index
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i)
  }
  return Math.abs(h)
}

const nadrawRelayChatLines = computed(() =>
  (chatLines.value ?? []).map((line, i) => ({
    _cid: nadrawLineCid(line.id, i),
    displayName: line.displayName,
    text: line.text,
    validGuess: false,
    system: line.system === true,
  })),
)

watch(
  nadrawRelayChatLines,
  () => {
    void nextTick(() => chatPanelRef.value?.scrollToBottom())
  },
  { deep: true },
)

const nadrawChatWsPillStatus = computed((): TwitchRelayChatWsStatus => {
  if (wsStatus.value === 'open') {
    return 'open'
  }
  if (lastWsError.value) {
    return 'error'
  }
  return 'idle'
})

const nadrawChatWsLabel = computed(() => {
  if (lastWsError.value) {
    return lastWsError.value
  }
  if (wsStatus.value === 'open') {
    return t('nadrawShow.wsDotConnected')
  }
  if (wsStatus.value === 'reconnecting') {
    return t('nadrawShow.wsDotReconnecting')
  }
  return t('nadrawShow.wsDotOffline')
})

const twitchWatchUrl = computed(
  () => `https://www.twitch.tv/${encodeURIComponent(effectiveTwitchChannel.value)}`,
)

function formatNadrawCooldownHint(ms: number): string {
  const s = ms / 1000
  const label = Number.isInteger(s) ? String(s) : s.toFixed(1)
  return t('nadleUi.cooldownHint', { seconds: label })
}

function nadrawFeedbackToEmojis(): string {
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
  const st = nadrawState.value
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
  document.documentElement.classList.add(NADRAW_HTML_CLASS)
  void loadStreamerCard()
})

onUnmounted(() => {
  document.documentElement.classList.remove(NADRAW_HTML_CLASS)
})

watch(effectiveSlug, () => {
  void loadStreamerCard()
})

watch(
  () => nadrawState.value?.phase,
  (p) => {
    if (p === 'drawing_locked' || p === 'drawing_active') {
      manualWord.value = ''
    }
  },
)

watch(
  () => nadrawState.value,
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
    <h1 class="sr-only">{{ t('nadrawShow.title') }}</h1>

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
              {{ t('nadrawShow.cameraPlaceholder') }}
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
                  :aria-label="t('nadrawShow.secretStreamerAria')"
                >
                  {{ canvasHostWordToDrawInCamera.word }}
                </p>
              </div>
              <div v-if="showWordStripInCamera" class="pointer-events-auto shrink-0 space-y-1">
                <label class="sa-panel-eat__label !mb-0 !text-[0.48rem]" for="nadraw-word-strip-cam">{{
                  wordStripLabel
                }}</label>
                <input
                  id="nadraw-word-strip-cam"
                  v-model="wordStripModel"
                  class="w-full rounded-[var(--ui-radius-lg,10px)] border-2 border-[color:var(--border-input,rgba(255,255,255,0.14))] bg-[color:var(--bg-muted,rgba(15,23,42,0.88))] px-2.5 py-1.5 text-left text-[0.78rem] font-semibold text-[color:var(--text-body,#f8fafc)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] placeholder:text-[color:var(--text-muted,rgba(196,181,253,0.5))] focus:border-[color:var(--border-strong,rgba(167,139,250,0.7))] focus:outline-none focus:ring-2 focus:ring-[color:var(--border-cyan-strong,rgba(56,189,248,0.35))]"
                  type="text"
                  maxlength="80"
                  autocomplete="off"
                  :placeholder="t('nadrawShow.manualWordInputPlaceholder')"
                />
              </div>
            </div>
          </div>
          <NadrawHostSettingsPanel
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
            :ws-status="nadrawChatWsPillStatus"
            :ws-status-label="nadrawChatWsLabel"
            :chat-title="t('nadrawShow.chatTitle')"
            guess-len-hint=""
            :channel-display="effectiveTwitchChannel"
            :twitch-watch-url="twitchWatchUrl"
            :open-twitch-label="t('nadleUi.chatOpenTwitch')"
            irc-relay-banner=""
            :relay-aria-label="t('nadleUi.chatRelayAria')"
            :chat-empty-text="t('nadleUi.chatEmpty', { channel: effectiveTwitchChannel })"
            :guess-badge-label="t('nadleUi.chatGuessBadge')"
            :lines="nadrawRelayChatLines"
            :default-cooldown-ms="1500"
            :format-cooldown-hint="formatNadrawCooldownHint"
            :feedback-to-emojis="nadrawFeedbackToEmojis"
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
            <h2 class="sr-only shrink-0">{{ t('nadrawShow.canvasTitle') }}</h2>
            <div class="relative min-h-0 flex-1">
              <NadrawCanvasBoard
                ref="boardRef"
                class="absolute inset-0 min-h-0 w-full"
                :show-toolbar="
                  showHostChrome && (nadrawState?.phase === 'drawing_locked' || nadrawState?.phase === 'drawing_active')
                "
                :can-draw="showHostChrome && (nadrawState?.phase === 'drawing_locked' || nadrawState?.phase === 'drawing_active')"
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
                          {{ t('nadrawShow.canvasWordWas') }}
                        </span>
                        <span
                          class="min-w-0 truncate font-mono text-[0.85rem] font-bold text-violet-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-[0.9rem]"
                          :aria-label="t('nadrawShow.secretStreamerAria')"
                        >
                          {{ canvasHostWordWasForHost.word }}
                        </span>
                      </div>
                    </div>
                  </div>
                </template>
              </NadrawCanvasBoard>
            </div>
          </div>

          <div
            v-if="showCanvasInitVeil"
            class="pointer-events-none absolute inset-0 z-30 rounded-2xl bg-slate-950/90"
            aria-hidden="true"
          />
          <div
            v-else-if="showRoundSetupOverlay"
            class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-slate-950/85 px-3 py-4 backdrop-blur-sm"
          >
            <NadrawRoundSetupPanel
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
                {{ t('nadrawShow.breakOverlayKicker') }}
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
                  {{ t('nadrawShow.canvasWordWas') }}
                </span>
                <span
                  class="font-mono text-base font-extrabold tracking-wide text-violet-100 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] md:text-lg"
                  :aria-label="t('nadrawShow.secretStreamerAria')"
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
                {{ t('nadrawShow.breakViewerWait') }}
              </p>
            </div>
          </div>
          <div
            v-else-if="viewerIdleVeil"
            class="nadraw-idle-veil pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-2xl px-4"
            role="status"
            aria-live="polite"
          >
            <div
              class="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-950/92 via-slate-950/88 to-indigo-950/92"
              aria-hidden="true"
            />
            <div
              class="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.9)_1px,transparent_1.5px)] [background-size:14px_14px]"
              aria-hidden="true"
            />
            <div
              class="nadraw-idle-veil__blob nadraw-idle-veil__blob--a pointer-events-none absolute -left-[12%] top-[18%] h-[min(42vw,14rem)] w-[min(42vw,14rem)] rounded-full bg-violet-500/35 blur-3xl"
              aria-hidden="true"
            />
            <div
              class="nadraw-idle-veil__blob nadraw-idle-veil__blob--b pointer-events-none absolute -right-[8%] bottom-[12%] h-[min(48vw,16rem)] w-[min(48vw,16rem)] rounded-full bg-indigo-500/30 blur-3xl"
              aria-hidden="true"
            />
            <div
              class="nadraw-idle-veil__blob nadraw-idle-veil__blob--c pointer-events-none absolute left-[22%] bottom-[28%] h-[min(28vw,9rem)] w-[min(28vw,9rem)] rounded-full bg-fuchsia-500/20 blur-3xl"
              aria-hidden="true"
            />
            <div
              class="relative z-10 w-full max-w-md rounded-2xl border border-violet-400/25 bg-slate-950/55 px-6 py-8 shadow-[0_0_0_1px_rgba(139,92,246,0.12),0_24px_48px_rgba(0,0,0,0.45)] backdrop-blur-md md:px-8 md:py-9"
            >
              <p
                class="text-center text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-violet-300/95 md:text-[0.7rem]"
              >
                {{ t('nadrawShow.canvasIdleOverlayKicker') }}
              </p>
              <p class="mt-5 text-center text-4xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" aria-hidden="true">
                🎨
              </p>
              <p
                class="mt-4 text-center text-base font-bold leading-snug text-white [text-shadow:0_1px_0_rgb(0_0_0),0_2px_14px_rgb(0_0_0)] md:text-lg"
              >
                {{ canvasIdleOverlayLine }}
              </p>
              <p class="mt-2 text-center text-sm font-medium leading-relaxed text-violet-100/85 md:text-[0.95rem]">
                {{ t('nadrawShow.canvasEmptySubtitleViewer') }}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
@keyframes nadraw-idle-float-a {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(4%, -3%, 0) scale(1.06);
  }
}

@keyframes nadraw-idle-float-b {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(-5%, 4%, 0) scale(1.05);
  }
}

@keyframes nadraw-idle-float-c {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.85;
  }
  50% {
    transform: translate3d(3%, 5%, 0) scale(1.08);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .nadraw-idle-veil__blob--a {
    animation: nadraw-idle-float-a 14s ease-in-out infinite;
  }
  .nadraw-idle-veil__blob--b {
    animation: nadraw-idle-float-b 18s ease-in-out infinite;
  }
  .nadraw-idle-veil__blob--c {
    animation: nadraw-idle-float-c 12s ease-in-out infinite;
  }
}
</style>
