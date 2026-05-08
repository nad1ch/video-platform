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
import NadrawRoundSetupPanel from '@/features/nadraw-show/components/NadrawRoundSetupPanel.vue'
import type { NadrawRoundSetupWordSource } from '@/features/nadraw-show/core/nadrawTypes'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'
import cloudWideSrc from '@/assets/landing/clouds/cloud-wide-volumetric.webp'
import hudRoundBodySrc from '@/assets/nadraw-show/hud-round-body.svg'
import hudTimerSrc from '@/assets/nadraw-show/hud-timer.svg'


const NADRAW_HTML_CLASS = 'sa-nadraw-route'
const NADRAW_STAGE_WIDTH = 1440
const NADRAW_STAGE_CONTENT_WIDTH = 1425
const NADRAW_STAGE_HEIGHT = 784
const NADRAW_COMPACT_BREAKPOINT = 936
const NADRAW_FLUID_BREAKPOINT = 1440

const { t } = useI18n()
const route = useRoute()
const auth = useAuth()

const manualWord = ref('')
const nextRoundWordEdit = ref('')
const wordSourceUi = ref<NadrawRoundSetupWordSource>('global')
const roundDurationSec = ref(30)
const roundsPlanned = ref(5)

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
  clearRound,
  ackNextRound,
  sendDrawStart,
  sendDrawMove,
  sendDrawEnd,
  onCanvasClear,
  onRemoteDraw,
} = orch

const boardRef = useTemplateRef<{ clearBoard: () => void; applyRemote: (p: RemoteDrawPayload) => void }>('boardRef')
const pageRef = useTemplateRef<HTMLElement>('pageRef')
const chatPanelRef = ref<InstanceType<typeof TwitchRelayChatPanel> | null>(null)
const nadrawStageScale = ref(1)
const nadrawStageLayoutHeight = ref(NADRAW_STAGE_HEIGHT)
const nadrawCompact = ref(false)
const nadrawFluid = ref(false)

const nadrawStageStyle = computed<Record<string, string>>(() => ({
  '--nadraw-stage-scale': nadrawStageScale.value.toFixed(4),
  '--nadraw-stage-layout-height': `${nadrawStageLayoutHeight.value}px`,
  '--nadraw-stage-visual-height': `${Math.ceil(nadrawStageLayoutHeight.value * nadrawStageScale.value)}px`,
}))

let nadrawStageResizeObserver: ResizeObserver | null = null

function syncNadrawStageScale(): void {
  const width = pageRef.value?.clientWidth || window.innerWidth || NADRAW_STAGE_WIDTH
  const height = window.innerHeight || NADRAW_STAGE_HEIGHT
  nadrawCompact.value = width < NADRAW_COMPACT_BREAKPOINT
  nadrawStageLayoutHeight.value = nadrawCompact.value ? NADRAW_STAGE_HEIGHT : Math.max(NADRAW_STAGE_HEIGHT, height - 116)
  nadrawFluid.value = !nadrawCompact.value && width >= NADRAW_FLUID_BREAKPOINT
  if (nadrawCompact.value) {
    nadrawStageScale.value = 1
    return
  }
  if (nadrawFluid.value) {
    nadrawStageScale.value = 1
    return
  }
  const availableContentWidth = Math.max(1, width)
  const next = Math.min(1, availableContentWidth / NADRAW_STAGE_CONTENT_WIDTH)
  nadrawStageScale.value = next
}

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

const hostCurrentWord = computed(() => canvasHostWordToDrawInCamera.value?.word ?? '')

const showWordChoicePanel = computed(() => {
  if (!showHostChrome.value) {
    return false
  }
  return showWordStripInCamera.value || hostCurrentWord.value.length > 0
})

const wordChoiceModel = computed({
  get(): string {
    if (showWordStripInCamera.value) {
      return wordStripModel.value
    }
    return hostCurrentWord.value || manualWord.value
  },
  set(v: string) {
    if (showWordStripInCamera.value || showRoundSetupOverlay.value) {
      wordStripModel.value = v
    } else {
      manualWord.value = v
    }
  },
})

const wordChoiceReadonly = computed(() => hostCurrentWord.value.length > 0 && !showWordStripInCamera.value)

const wordChoiceSubmitDisabled = computed(() => {
  if (wordChoiceReadonly.value) {
    return false
  }
  return wordChoiceModel.value.trim().length === 0
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
    return nextRoundWordEdit.value.trim().length === 0 && String(st.nextWordDraft ?? '').trim().length === 0
  }
  return false
})

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
  if (m && m !== '—') {
    return m.replace(/\s+/g, ' ')
  }
  const w = nadrawState.value?.currentWord?.trim()
  if (w) {
    return Array.from(w)
      .map((ch) => (ch.trim() ? '_' : ' '))
      .join(' ')
  }
  return ''
})

const showMaskedWordHud = computed(() => maskedWordDisplay.value.trim().length > 0)

function formatClockSeconds(total: number): string {
  const safe = Math.max(0, Math.floor(total))
  const mm = Math.floor(safe / 60)
  const ss = String(safe % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

const roundClockLabel = computed(() => {
  const sec = roundSecondsLeft.value ?? nadrawState.value?.roundDurationSec ?? roundDurationSec.value
  return formatClockSeconds(sec)
})

const roundProgressLabel = computed(() => {
  const st = nadrawState.value
  const total = st?.roundsPlanned && st.roundsPlanned > 0 ? st.roundsPlanned : roundsPlanned.value
  const current =
    st && st.phase !== 'idle'
      ? Math.max(0, Math.min(total, (st.roundNumber ?? 1) - (st.phase === 'between_rounds' ? 0 : 1)))
      : 0
  return `${current}/${total}`
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
  const rp = Math.min(100, Math.max(1, Math.floor(Number(roundsPlanned.value) || 1)))
  const rd = Math.min(600, Math.max(10, Math.floor(Number(roundDurationSec.value) || 30)))
  roundsPlanned.value = rp
  roundDurationSec.value = rd
  const src = backendWordSource(wordSourceUi.value)
  if (src === 'manual') {
    startRound('manual', manualWord.value.trim(), rd, rp)
  } else {
    startRound(src, undefined, rd, rp)
  }
}

function onResetGame(): void {
  if (!showHostChrome.value) {
    return
  }
  clearRound()
  boardRef.value?.clearBoard()
  manualWord.value = ''
  nextRoundWordEdit.value = ''
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
  const draft = String(st.nextWordDraft ?? '').trim()
  const nextWord = w.length > 0 ? w : (draft.length > 0 ? draft : undefined)
  if (st.sessionWordSource === 'manual') {
    ackNextRound(nextWord)
    return
  }
  ackNextRound(nextWord)
}

function onWordPanelSubmit(): void {
  if (wordChoiceSubmitDisabled.value) {
    return
  }
  if (showRoundSetupOverlay.value) {
    onStart()
    return
  }
  if (nadrawState.value?.phase === 'between_rounds') {
    onAckBetweenRound()
  }
}

onMounted(() => {
  document.documentElement.classList.add(NADRAW_HTML_CLASS)
  void loadStreamerCard()
  void nextTick(syncNadrawStageScale)
  if (pageRef.value) {
    nadrawStageResizeObserver = new ResizeObserver(syncNadrawStageScale)
    nadrawStageResizeObserver.observe(pageRef.value)
  }
  window.addEventListener('resize', syncNadrawStageScale, { passive: true })
})

onUnmounted(() => {
  document.documentElement.classList.remove(NADRAW_HTML_CLASS)
  nadrawStageResizeObserver?.disconnect()
  nadrawStageResizeObserver = null
  window.removeEventListener('resize', syncNadrawStageScale)
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
    class="nadraw-page"
    :class="{ 'nadraw-page--compact': nadrawCompact, 'nadraw-page--fluid': nadrawFluid }"
    :style="nadrawStageStyle"
  >
    <h1 class="sr-only">{{ t('nadrawShow.title') }}</h1>

    <p v-if="streamerLoadError" class="nadraw-page__error" role="status" aria-live="polite">
      {{ streamerLoadError }}
    </p>

    <div ref="pageRef" class="nadraw-page__inner">
    <div class="nadraw-stage">
      <img class="nadraw-page__cloud nadraw-page__cloud--left" :src="cloudWideSrc" alt="" aria-hidden="true" />
      <img class="nadraw-page__cloud nadraw-page__cloud--right" :src="cloudWideSrc" alt="" aria-hidden="true" />

      <div class="nadraw-layout">
      <aside class="nadraw-left">
        <form v-if="showWordChoicePanel" class="nadraw-card nadraw-word-card sa-glass-panel" @submit.prevent="onWordPanelSubmit">
          <h2 class="nadraw-word-card__title">Choose a word</h2>
          <input
            id="nadraw-word-panel-input"
            v-model="wordChoiceModel"
            class="nadraw-word-card__input"
            type="text"
            maxlength="80"
            autocomplete="off"
            :readonly="wordChoiceReadonly"
            placeholder="write here..."
            :aria-label="t('nadrawShow.manualWord')"
          />
        </form>

        <section v-else class="nadraw-card nadraw-camera-card sa-glass-panel" :aria-label="t('nadrawShow.sectionCamera')">
          <p>{{ t('nadrawShow.cameraPlaceholder') }}</p>
        </section>

        <section class="nadraw-card nadraw-chat-card sa-glass-panel" :aria-label="t('nadrawShow.chatTitle')">
          <TwitchRelayChatPanel
            ref="chatPanelRef"
            class="nadraw-chat"
            flex-rail
            :show-ws-pill="true"
            :show-guess-hints="false"
            :ws-status="nadrawChatWsPillStatus"
            :ws-status-label="'live'"
            chat-title="Stream chat;"
            guess-len-hint=""
            :channel-display="effectiveTwitchChannel"
            :twitch-watch-url="twitchWatchUrl"
            open-twitch-label="open twitch"
            irc-relay-banner=""
            :relay-aria-label="t('nadleUi.chatRelayAria')"
            :chat-empty-text="t('nadleUi.chatEmpty', { channel: effectiveTwitchChannel })"
            :guess-badge-label="t('nadleUi.chatGuessBadge')"
            :lines="nadrawRelayChatLines"
            :default-cooldown-ms="1500"
            :format-cooldown-hint="formatNadrawCooldownHint"
            :feedback-to-emojis="nadrawFeedbackToEmojis"
          />
        </section>
      </aside>

      <main class="nadraw-main" :class="{ 'nadraw-main--toolbar': showHostChrome }">
        <div class="nadraw-board-shell sa-glass-panel">
          <div class="nadraw-board-inner">
            <NadrawCanvasBoard
              ref="boardRef"
              class="nadraw-canvas-board"
              :show-toolbar="showHostChrome"
              :can-draw="showHostChrome && (nadrawState?.phase === 'drawing_locked' || nadrawState?.phase === 'drawing_active')"
              @draw-start="(id, nx, ny, m) => sendDrawStart(id, nx, ny, m)"
              @draw-move="(id, nx, ny, m) => sendDrawMove(id, nx, ny, m)"
              @draw-end="(id, nx, ny, m) => sendDrawEnd(id, nx, ny, m)"
              @reset-game="onResetGame"
            >
              <template v-if="showCanvasStatsHud" #hud>
                <div class="nadraw-hud" role="status" aria-live="polite">
                  <span class="nadraw-hud__pill nadraw-hud__pill--timer">
                    <img class="nadraw-hud__icon nadraw-hud__icon--timer" :src="hudTimerSrc" alt="" aria-hidden="true" />
                    <span>{{ roundClockLabel }}</span>
                  </span>
                  <span class="nadraw-hud__pill nadraw-hud__pill--rounds">
                    <img class="nadraw-hud__icon nadraw-hud__icon--rounds" :src="hudRoundBodySrc" alt="" aria-hidden="true" />
                    <span>{{ roundProgressLabel }}</span>
                  </span>
                  <span v-if="showMaskedWordHud" class="nadraw-hud__pill nadraw-hud__pill--word">
                    {{ maskedWordDisplay }}
                  </span>
                </div>
              </template>
            </NadrawCanvasBoard>

            <template v-if="showRoundSetupOverlay">
              <img class="nadraw-board-cloud nadraw-board-cloud--setup-left" :src="cloudWideSrc" alt="" aria-hidden="true" />
              <img class="nadraw-board-cloud nadraw-board-cloud--setup-right" :src="cloudWideSrc" alt="" aria-hidden="true" />
              <NadrawRoundSetupPanel
                v-model:word-source="wordSourceUi"
                v-model:round-duration-sec="roundDurationSec"
                v-model:round-count="roundsPlanned"
                class="nadraw-setup-over-canvas"
                :start-disabled="roundSetupStartDisabled"
                @start="onStart"
              />
            </template>

            <div v-if="showCanvasInitVeil" class="nadraw-loading-veil" aria-hidden="true" />

            <div v-else-if="showBetweenRoundOverlay" class="nadraw-between" role="status" aria-live="polite">
              <p class="nadraw-between__kicker">{{ t('nadrawShow.breakOverlayKicker') }}</p>
              <p class="nadraw-between__title">{{ breakOverlayHeadline }}</p>
              <p v-if="canvasHostWordWasForHost" class="nadraw-between__word">
                {{ canvasHostWordWasForHost.word }}
              </p>
              <button
                v-if="showHostChrome"
                class="nadraw-between__button"
                type="button"
                :disabled="breakAckDisabled"
                @click="onAckBetweenRound"
              >
                {{ breakAckButtonLabel }}
              </button>
              <p v-else class="nadraw-between__wait">{{ t('nadrawShow.breakViewerWait') }}</p>
            </div>

            <div v-else-if="viewerIdleVeil" class="nadraw-viewer-veil" role="status" aria-live="polite">
              <p>{{ canvasIdleOverlayLine }}</p>
              <span>{{ t('nadrawShow.canvasEmptySubtitleViewer') }}</span>
            </div>
          </div>
        </div>
      </main>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.nadraw-page {
  --nadraw-purple: #66388f;
  --nadraw-panel-purple: rgba(81, 48, 116, 0.78);
  position: relative;
  box-sizing: border-box;
  flex: 0 0 var(--nadraw-stage-visual-height, 784px) !important;
  width: 100%;
  height: var(--nadraw-stage-visual-height, 784px) !important;
  min-height: var(--nadraw-stage-visual-height, 784px) !important;
  overflow: hidden;
  padding-left: var(--app-shell-content-x);
  padding-right: calc(var(--app-shell-content-x) + 4px);
  color: #ffffff;
  background: transparent;
  font-family: "Marmelad", var(--sa-font-main, system-ui, sans-serif);
}

.nadraw-page__inner {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
}

:global(.app-shell-main__viewport--nadraw),
:global(.sa-nadraw-route .app-shell-main__viewport--chrome) {
  padding-inline: 0;
  background: transparent;
}

:global(.app-shell-main--nadraw),
:global(.app-shell-main__viewport--nadraw),
:global(.app-shell-main__viewport--nadraw .app-shell-route-stack),
:global(.sa-nadraw-route .app-shell-main),
:global(.sa-nadraw-route .app-shell-main__viewport),
:global(.sa-nadraw-route .app-shell-route-stack) {
  flex: 0 0 auto !important;
  min-height: 784px !important;
  background: transparent;
}

:global(.app-shell-main__viewport--nadraw .app-shell-route-stack > .nadraw-page),
:global(.sa-nadraw-route .app-shell-route-stack > .nadraw-page) {
  flex: 0 0 var(--nadraw-stage-visual-height, 784px) !important;
  min-height: var(--nadraw-stage-visual-height, 784px) !important;
}

.nadraw-stage {
  position: relative;
  z-index: 1;
  width: 1440px;
  height: var(--nadraw-stage-layout-height, 784px);
  transform: scale(var(--nadraw-stage-scale, 1));
  transform-origin: 0 0;
}

.nadraw-page__cloud {
  position: absolute;
  z-index: 0;
  width: 832px;
  height: 416px;
  object-fit: cover;
  object-position: bottom;
  opacity: 0.26;
  pointer-events: none;
  user-select: none;
}

.nadraw-page__cloud--left {
  left: 170px;
  bottom: -126px;
  transform: rotate(2.35deg);
}

.nadraw-page__cloud--right {
  top: -238px;
  right: -220px;
  transform: scaleY(-1) rotate(173.31deg);
}

.nadraw-page__error {
  position: fixed;
  right: 12px;
  top: 12px;
  z-index: 100;
  max-width: min(320px, calc(100vw - 24px));
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(127, 29, 29, 0.86);
  color: #fee2e2;
  font-size: 12px;
  line-height: 1.3;
}

.nadraw-layout {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 343px minmax(0, 1071px);
  gap: 11px;
  width: min(1425px, 100%);
  height: var(--nadraw-stage-layout-height, 784px);
  min-height: 0;
  margin: 0;
  padding: 0 0 8px;
  box-sizing: border-box;
  align-content: start;
}

.nadraw-left {
  display: grid;
  grid-template-rows: 213px minmax(560px, 1fr);
  gap: 11px;
  width: 343px;
  height: calc(var(--nadraw-stage-layout-height, 784px) - 8px);
  min-height: 0;
  padding-top: 8px;
  box-sizing: border-box;
}

.nadraw-card {
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 29.143px;
  border: 1px solid rgba(255, 255, 255, 0.035);
  background-color: rgba(47, 25, 83, 0.2);
  background-image: linear-gradient(132.75deg, rgba(124, 77, 219, 0.119) 0%, rgba(102, 56, 143, 0.103) 73.206%);
  backdrop-filter: blur(18px) saturate(142%);
  -webkit-backdrop-filter: blur(18px) saturate(142%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -22px 42px rgba(4, 0, 18, 0.1),
    0 16px 32px rgba(54, 24, 105, 0.08);
}

.nadraw-left > .nadraw-card {
  width: 341px;
  margin-left: 0;
  background-color: transparent;
  background-image: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -22px 42px rgba(4, 0, 18, 0.08);
}

.nadraw-card::before,
.nadraw-board-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    radial-gradient(circle at 7.4px 6.4px, rgba(255, 255, 255, 0.32) 0 1.06px, transparent 1.12px),
    radial-gradient(circle at 145.7px 13.2px, rgba(255, 255, 255, 0.18) 0 1.06px, transparent 1.12px),
    radial-gradient(circle at 207.2px 6.9px, rgba(255, 255, 255, 0.16) 0 0.8px, transparent 0.86px);
}

.nadraw-card::after,
.nadraw-board-shell::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    linear-gradient(141deg, rgba(255, 255, 255, 0.095) 0%, rgba(255, 255, 255, 0.018) 31%, transparent 56%),
    radial-gradient(circle at 84% 12%, rgba(255, 255, 255, 0.055), transparent 26%);
  mix-blend-mode: screen;
}

.nadraw-camera-card {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 213px;
  padding: 0 24px;
  text-align: center;
}

.nadraw-camera-card p {
  position: relative;
  z-index: 1;
  margin: 0;
  color: #ffffff;
  font-size: 11.5px;
  line-height: 1.2;
}

.nadraw-word-card {
  height: 213px;
  padding: 17px 10px 14px;
  background-image: linear-gradient(132.75deg, rgba(124, 77, 219, 0.119) 0%, rgba(102, 56, 143, 0.103) 73.206%);
}

.nadraw-word-card__title {
  position: relative;
  z-index: 1;
  margin: 0 0 19px;
  height: 26px;
  color: #ffffff;
  font-family: "Climate Crisis", var(--sa-font-display, system-ui, sans-serif);
  font-size: 20px;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 30px;
  letter-spacing: 0;
  text-align: center;
}

.nadraw-word-card__input {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: 321px;
  height: 51px;
  margin-left: 0;
  border: 0;
  border-radius: 29.143px;
  color: #ffffff;
  font-family: "Climate Crisis", var(--sa-font-display, system-ui, sans-serif);
  font-variation-settings: 'YEAR' 1979;
  letter-spacing: 0;
}

.nadraw-word-card__input {
  display: block;
  padding: 0 20px;
  background-image: linear-gradient(164.61deg, rgba(124, 77, 219, 0.173) 0%, rgba(60, 36, 99, 0.169) 73.206%);
  backdrop-filter: blur(14px) saturate(145%);
  -webkit-backdrop-filter: blur(14px) saturate(145%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -12px 22px rgba(14, 2, 30, 0.1);
  font-size: 16px;
  line-height: 30px;
  text-align: center;
  outline: none;
}

.nadraw-word-card__input::placeholder {
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  text-align: left;
}

.nadraw-word-card__input:focus {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18);
}

.nadraw-chat-card {
  height: 100%;
  background-image: linear-gradient(109.37deg, rgba(124, 77, 219, 0.173) 0%, rgba(60, 36, 99, 0.169) 73.206%);
}

.nadraw-chat-card :deep(.twitch-relay-chat__shell) {
  position: relative;
  z-index: 1;
  gap: 0;
  height: 100%;
  padding: 0;
  overflow: hidden;
}

.nadraw-chat-card :deep(.twitch-relay-chat__head) {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  box-sizing: border-box;
  width: 100%;
  height: 82px;
  border-radius: 29.143px;
  background-image: linear-gradient(157.39deg, rgba(124, 77, 219, 0.173) 0%, rgba(60, 36, 99, 0.169) 73.206%);
  backdrop-filter: blur(16px) saturate(142%);
  -webkit-backdrop-filter: blur(16px) saturate(142%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -16px 28px rgba(6, 0, 20, 0.08);
  overflow: visible;
}

.nadraw-chat-card :deep(.twitch-relay-chat__head::before) {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    radial-gradient(circle at 46.3% 13.4%, rgba(255, 255, 255, 0.24) 0 0.85px, transparent 0.92px),
    radial-gradient(circle at 65.8% 4.9%, rgba(255, 255, 255, 0.16) 0 0.7px, transparent 0.76px);
}

.nadraw-chat-card :deep(.twitch-relay-chat__head-row) {
  position: relative;
  display: block;
  height: 46px;
}

.nadraw-chat-card :deep(.twitch-relay-chat__title) {
  position: absolute;
  left: 21px;
  top: 0;
  width: 201px;
  height: 51px;
  overflow: visible;
  font-family: "Climate Crisis", var(--sa-font-display, system-ui, sans-serif);
  font-size: 16px;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 50.526px;
  letter-spacing: 0;
  white-space: nowrap;
}

.nadraw-chat-card :deep(.twitch-relay-chat__ws-pill) {
  position: absolute;
  right: 16.756px;
  top: 18px;
  min-width: 42px;
  width: 42px;
  height: 23px;
  padding: 0;
  border-radius: 11.362px;
  background: rgba(255, 59, 48, 0.44);
  font-family: "Climate Crisis", var(--sa-font-display, system-ui, sans-serif);
  font-size: 9px;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 1;
}

.nadraw-chat-card :deep(.twitch-relay-chat__toolbar) {
  position: absolute;
  left: 11px;
  right: 17.143px;
  top: 46px;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0;
  width: auto;
  height: 20px;
  margin: 0;
}

.nadraw-chat-card :deep(.twitch-relay-chat__channel-pill) {
  margin-left: 14px;
  color: #ffffff;
  font-size: 13px;
  line-height: 15px;
}

.nadraw-chat-card :deep(.twitch-relay-chat__external) {
  margin-left: auto;
  min-width: 92px;
  height: 24px;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 11.362px;
  background: rgba(102, 56, 143, 0.33);
  font-family: "Climate Crisis", var(--sa-font-display, system-ui, sans-serif);
  font-size: 9px;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
}

.nadraw-chat-card :deep(.twitch-relay-chat__feed) {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 63px;
  bottom: 10px;
  z-index: 1;
  flex: none;
  width: auto;
  min-height: 0;
  height: auto;
  margin: 0;
  overflow: hidden auto;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.nadraw-chat-card :deep(.twitch-relay-chat__lines) {
  gap: 5px;
  padding: 0 0 2px;
}

.nadraw-chat-card :deep(.twitch-relay-chat__line) {
  display: block;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #ffffff;
  font-size: 14px;
  line-height: 1.2;
}

.nadraw-chat-card :deep(.twitch-relay-chat__line:hover) {
  background: transparent;
  box-shadow: none;
}

.nadraw-chat-card :deep(.twitch-relay-chat__avatar),
.nadraw-chat-card :deep(.twitch-relay-chat__badge) {
  display: none;
}

.nadraw-chat-card :deep(.twitch-relay-chat__line-body) {
  display: inline;
}

.nadraw-chat-card :deep(.twitch-relay-chat__line-body::before) {
  content: '1:38:55 ';
  color: #898989;
  font-size: 16px;
}

.nadraw-chat-card :deep(.twitch-relay-chat__line-meta) {
  display: inline;
}

.nadraw-chat-card :deep(.twitch-relay-chat__name) {
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0;
  color: #ff0000;
}

.nadraw-chat-card :deep(.twitch-relay-chat__line:nth-child(3n + 1) .twitch-relay-chat__name) {
  color: #00bbff;
}

.nadraw-chat-card :deep(.twitch-relay-chat__line:nth-child(3n + 2) .twitch-relay-chat__name) {
  color: #15ff00;
}

.nadraw-chat-card :deep(.twitch-relay-chat__line:nth-child(4n) .twitch-relay-chat__name) {
  color: #ff00b2;
}

.nadraw-chat-card :deep(.twitch-relay-chat__name::after) {
  content: ': ';
  color: #ffffff;
}

.nadraw-chat-card :deep(.twitch-relay-chat__text) {
  display: inline;
  margin: 0;
  color: #ffffff;
  font-size: 14px;
  line-height: 1.2;
}

.nadraw-chat-card :deep(.twitch-relay-chat__empty) {
  padding: 32px 10px;
  color: rgba(255, 255, 255, 0.76);
  font-size: 14px;
}

.nadraw-main {
  min-width: 0;
  padding-top: 52px;
}

.nadraw-board-shell {
  position: relative;
  box-sizing: border-box;
  width: 1071px;
  max-width: 100%;
  height: calc(var(--nadraw-stage-layout-height, 784px) - 52px);
  min-height: 0;
  padding: 18px 21px 19px 18px;
  overflow: visible;
  border-radius: 29.143px;
  border: 1px solid rgba(255, 255, 255, 0.035);
  background-image: linear-gradient(129.88deg, rgba(124, 77, 219, 0.173) 0%, rgba(60, 36, 99, 0.169) 73.206%);
  backdrop-filter: blur(18px) saturate(142%);
  -webkit-backdrop-filter: blur(18px) saturate(142%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.09),
    inset 0 -24px 42px rgba(4, 0, 18, 0.09);
}

.nadraw-board-inner {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.nadraw-board-inner :deep(.nadraw-board-toolbar) {
  top: -69px;
  left: -18px;
  width: calc(100% + 32px);
}

.nadraw-board-cloud {
  position: absolute;
  z-index: 10;
  width: clamp(832px, 62vw, 1280px);
  height: auto;
  aspect-ratio: 2 / 1;
  object-fit: cover;
  object-position: bottom;
  opacity: 0.2;
  pointer-events: none;
}

.nadraw-board-cloud--setup-left {
  left: -38%;
  top: -19%;
  transform: scaleY(-1) rotate(173.31deg);
}

.nadraw-board-cloud--setup-right {
  right: -34%;
  bottom: -36%;
  transform: scaleY(-1) rotate(173.31deg);
}

.nadraw-setup-over-canvas {
  position: absolute;
  z-index: 20;
  left: 50%;
  top: calc(50% - 24px);
  transform: translate(-50%, -50%);
}

.nadraw-hud {
  display: flex;
  align-items: center;
  gap: 7px;
  color: rgba(255, 255, 255, 0.94);
  font-family: "Coda Caption", var(--sa-font-display, system-ui, sans-serif);
  font-size: 20px;
  font-weight: 800;
  line-height: 32px;
  letter-spacing: 0;
}

.nadraw-hud__pill {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  height: 39px;
  border-radius: 25.268px;
  background: rgba(80, 57, 119, 0.54);
  overflow: hidden;
}

.nadraw-hud__icon {
  display: block;
  object-fit: fill;
  pointer-events: none;
  user-select: none;
}

.nadraw-hud__icon--timer {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
}

.nadraw-hud__icon--rounds {
  width: 26px;
  height: 26.929px;
  flex: 0 0 26px;
}

.nadraw-hud__pill--timer {
  width: 98px;
  padding: 0 8px 0 11px;
  gap: 6px;
}

.nadraw-hud__pill--rounds {
  width: 108px;
  padding: 0 8px 0 12px;
  gap: 6px;
}

.nadraw-hud__pill--word {
  min-width: 114px;
  max-width: 260px;
  padding: 0 22px;
  justify-content: center;
  white-space: nowrap;
}

.nadraw-loading-veil {
  position: absolute;
  inset: 6px;
  z-index: 18;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.02);
  pointer-events: none;
}

.nadraw-between,
.nadraw-viewer-veil {
  position: absolute;
  z-index: 26;
  left: 50%;
  top: 50%;
  box-sizing: border-box;
  width: min(420px, calc(100% - 32px));
  padding: 22px 24px;
  border-radius: 25px;
  border: 1px solid rgba(106, 74, 150, 1);
  background: #9b86bf;
  color: #ffffff;
  text-align: center;
  transform: translate(-50%, -50%);
}

.nadraw-between__kicker,
.nadraw-between__title,
.nadraw-viewer-veil p {
  margin: 0;
  font-family: "Climate Crisis", var(--sa-font-display, system-ui, sans-serif);
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  letter-spacing: 0;
}

.nadraw-between__kicker {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.76);
}

.nadraw-between__title,
.nadraw-viewer-veil p {
  margin-top: 8px;
  font-size: 20px;
  line-height: 1.25;
}

.nadraw-between__word,
.nadraw-viewer-veil span {
  display: block;
  margin: 10px 0 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: 15px;
}

.nadraw-between__button {
  width: 100%;
  height: 51px;
  margin-top: 18px;
  border: 1px solid rgba(115, 84, 161, 1);
  border-radius: 25.645px;
  background: #7d5aa9;
  color: #fff;
  font-family: "Climate Crisis", var(--sa-font-display, system-ui, sans-serif);
  font-size: 16px;
  font-variation-settings: 'YEAR' 1979;
  cursor: pointer;
}

.nadraw-between__button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.nadraw-page--fluid {
  --nadraw-fluid-stage-height: var(--nadraw-stage-layout-height, 784px);
  flex: 0 0 var(--nadraw-fluid-stage-height) !important;
  height: var(--nadraw-fluid-stage-height) !important;
  min-height: var(--nadraw-fluid-stage-height) !important;
}

:global(.app-shell-main__viewport--nadraw .app-shell-route-stack > .nadraw-page.nadraw-page--fluid),
:global(.sa-nadraw-route .app-shell-route-stack > .nadraw-page.nadraw-page--fluid) {
  flex: 0 0 var(--nadraw-fluid-stage-height) !important;
  min-height: var(--nadraw-fluid-stage-height) !important;
}

.nadraw-page--fluid .nadraw-stage {
  width: 100%;
  height: var(--nadraw-fluid-stage-height);
  transform: none;
}

.nadraw-page--fluid .nadraw-layout {
  grid-template-columns: 343px minmax(0, 1fr);
  width: 100%;
  height: var(--nadraw-fluid-stage-height);
}

.nadraw-page--fluid .nadraw-left {
  grid-template-rows: 213px minmax(560px, 1fr);
  height: calc(var(--nadraw-fluid-stage-height) - 8px);
}

.nadraw-page--fluid .nadraw-chat-card {
  height: 100%;
}

.nadraw-page--fluid .nadraw-board-shell {
  width: 100%;
  height: calc(var(--nadraw-fluid-stage-height) - 52px);
  min-height: 732px;
}

.nadraw-page--compact {
  flex: 1 1 auto !important;
  height: auto !important;
  min-height: 100dvh !important;
  overflow: visible;
  padding-bottom: 16px;
}

.nadraw-page--compact .nadraw-stage {
  width: 100%;
  height: auto;
  transform: none;
}

.nadraw-page--compact .nadraw-page__cloud {
  opacity: 0.16;
}

.nadraw-page--compact .nadraw-page__cloud--left {
  left: -210px;
  bottom: -130px;
}

.nadraw-page--compact .nadraw-page__cloud--right {
  top: -230px;
  right: -430px;
}

.nadraw-page--compact .nadraw-layout {
  display: flex;
  flex-direction: column;
  gap: 11px;
  width: 100%;
  height: auto;
  margin: 0;
  padding: 0 0 16px;
}

.nadraw-page--compact .nadraw-main {
  order: 1;
  padding-top: 11px;
}

.nadraw-page--compact .nadraw-main--toolbar {
  padding-top: 88px;
}

.nadraw-page--compact .nadraw-left {
  order: 2;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 11px;
  width: 100%;
  height: auto;
  padding-top: 0;
}

.nadraw-page--compact .nadraw-left > .nadraw-card {
  width: 100%;
  margin-left: 0;
}

.nadraw-page--compact .nadraw-camera-card,
.nadraw-page--compact .nadraw-word-card {
  height: 213px;
}

.nadraw-page--compact .nadraw-word-card__input {
  width: 100%;
}

.nadraw-page--compact .nadraw-chat-card {
  height: min(560px, 52dvh);
  min-height: 320px;
}

.nadraw-page--compact .nadraw-board-shell {
  width: 100%;
  height: clamp(420px, calc(100dvh - 120px), 640px);
  min-height: 0;
  aspect-ratio: auto;
}

.nadraw-page--compact .nadraw-board-inner :deep(.nadraw-board-toolbar) {
  top: -106px;
  left: 0;
  width: 100%;
}

.nadraw-page--compact .nadraw-setup-over-canvas,
.nadraw-page--compact :deep(.nadraw-setup-over-canvas) {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  transform-origin: center center;
}

@media (max-width: 680px) {
  .nadraw-page--compact .nadraw-left {
    grid-template-columns: 1fr;
  }

  .nadraw-page--compact .nadraw-chat-card {
    height: min(560px, 58dvh);
  }

  .nadraw-page--compact .nadraw-board-shell {
    height: clamp(420px, calc(100dvh - 120px), 640px);
    padding: 12px;
  }

  .nadraw-page--compact .nadraw-board-inner :deep(.nadraw-board-toolbar) {
    left: 0;
    width: 100%;
  }
}

@media (max-width: 560px) {
  .nadraw-page--compact .nadraw-main--toolbar {
    padding-top: 133px;
  }

  .nadraw-page--compact .nadraw-board-inner :deep(.nadraw-board-toolbar) {
    top: -151px;
  }

  .nadraw-page--compact .nadraw-board-shell {
    height: clamp(420px, calc(100dvh - 120px), 640px);
  }
}

@media (max-width: 680px) {
  .nadraw-page--compact .nadraw-setup-over-canvas,
  .nadraw-page--compact :deep(.nadraw-setup-over-canvas) {
    transform: translate(-50%, -50%) scale(0.9);
  }
}

@media (max-width: 560px) {
  .nadraw-page--compact .nadraw-setup-over-canvas,
  .nadraw-page--compact :deep(.nadraw-setup-over-canvas) {
    transform: translate(-50%, -50%) scale(0.78);
  }
}

@media (max-width: 420px) {
  .nadraw-page--compact .nadraw-setup-over-canvas,
  .nadraw-page--compact :deep(.nadraw-setup-over-canvas) {
    transform: translate(-50%, -50%) scale(0.74);
  }
}
</style>
