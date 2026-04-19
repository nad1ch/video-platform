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
  prompts,
  promptsLoading,
  nowTick,
  showHostChrome,
  startRound,
  clearRound,
  sendDrawStart,
  sendDrawMove,
  sendDrawEnd,
  onCanvasClear,
  onRemoteDraw,
  loadPrompts,
  approvePrompt,
  deletePrompt,
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
  if (!st || st.phase === 'idle' || st.phase === 'revealed') {
    return null
  }
  const ms = st.endsAt - (nowTick.value ?? Date.now())
  return Math.max(0, Math.ceil(ms / 1000))
})

const roundsPlanHud = computed(() => {
  const st = garticState.value
  if (!st || st.phase === 'idle' || !st.roundsPlanned || st.roundsPlanned < 1) {
    return ''
  }
  return t('garticShow.roundsPlanHud', { n: st.roundsPlanned })
})

const gameFeelLine = computed(() => {
  const st = garticState.value
  if (!st || st.phase === 'idle') {
    return `🟡 ${t('garticShow.gameFeelWaiting')}`
  }
  if (st.phase === 'revealed') {
    return `🔴 ${t('garticShow.gameFeelEnd')}`
  }
  return `🟢 ${t('garticShow.gameFeelRound')}`
})

const showCanvasIdleOverlay = computed(() => garticState.value?.phase === 'idle')

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

const streamerSecretSubtle = computed(() => {
  if (!showHostChrome.value) {
    return ''
  }
  const st = garticState.value
  if (!st || st.phase === 'idle') {
    return ''
  }
  const w = st.currentWord?.trim()
  return w && w.length > 0 ? w : ''
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
  const rd = Math.min(600, Math.max(60, Math.floor(Number(roundDurationSec.value) || 180)))
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
  clearRound()
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
          <div class="space-y-2 p-3">
            <div class="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
              <p
                class="min-w-0 flex-1 font-mono text-xl font-bold leading-tight tracking-[0.2em] text-slate-50 md:text-2xl"
                aria-live="polite"
              >
                {{ maskedWordDisplay }}
              </p>
              <p
                v-if="roundSecondsLeft !== null"
                class="shrink-0 whitespace-nowrap font-mono text-base font-bold tabular-nums text-amber-200 md:text-lg"
                aria-live="polite"
              >
                ⏱&nbsp;{{ roundSecondsLeft }}s
              </p>
            </div>
            <p class="text-center text-sm font-semibold text-slate-300">
              {{ gameFeelLine }}
            </p>
            <p v-if="roundsPlanHud" class="text-center text-[0.65rem] font-medium text-violet-300/90">
              {{ roundsPlanHud }}
            </p>
          </div>

          <div class="aspect-video w-full shrink-0 bg-black">
            <div
              class="flex h-full w-full items-center justify-center px-2 text-center text-[0.65rem] leading-snug text-slate-500"
            >
              {{ t('garticShow.cameraPlaceholder') }}
            </div>
          </div>
          <div
            v-if="showHostChrome && showCanvasIdleOverlay && wordSourceUi === 'manual'"
            class="border-t border-white/10 bg-black/90 px-3 py-2"
          >
            <label class="mb-1 block text-left text-[0.65rem] font-medium text-slate-500" for="gartic-manual-word-cam">{{
              t('garticShow.sectionWord')
            }}</label>
            <input
              id="gartic-manual-word-cam"
              v-model="manualWord"
              class="w-full rounded-lg border border-slate-700/80 bg-slate-950/90 px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500/40"
              type="text"
              maxlength="80"
              autocomplete="off"
              :placeholder="t('garticShow.manualWordInputPlaceholder')"
            />
          </div>
          <p
            v-if="streamerSecretSubtle"
            class="border-t border-white/5 bg-black px-2 py-1.5 text-center font-mono text-[0.65rem] leading-snug tracking-wide text-slate-500"
          >
            {{ streamerSecretSubtle }}
          </p>
          <GarticHostSettingsPanel
            v-if="showHostChrome && !showCanvasIdleOverlay"
            :prompts="prompts"
            :prompts-loading="promptsLoading"
            @load-prompts="loadPrompts"
            @approve-prompt="(id) => approvePrompt(id, true)"
            @delete-prompt="deletePrompt"
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
              />
            </div>
          </div>

          <div
            v-if="showCanvasIdleOverlay && showHostChrome"
            class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-slate-950/85 px-3 py-4 backdrop-blur-sm"
          >
            <GarticRoundSetupPanel
              v-model:word-source="wordSourceUi"
              v-model:round-duration-sec="roundDurationSec"
              v-model:round-count="roundsPlanned"
              class="pointer-events-auto max-h-[min(92vh,42rem)] w-full max-w-md overflow-y-auto shadow-2xl shadow-black/50"
              :start-disabled="roundSetupStartDisabled"
              :prompts="prompts"
              :prompts-loading="promptsLoading"
              @load-prompts="loadPrompts"
              @approve-prompt="(id) => approvePrompt(id, true)"
              @delete-prompt="deletePrompt"
              @start="onStart"
            />
          </div>
          <div
            v-else-if="showCanvasIdleOverlay"
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
