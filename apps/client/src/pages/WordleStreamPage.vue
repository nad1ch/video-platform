<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppContainer from '@/components/ui/AppContainer.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import WordleGlobalLeaderboardTable from '@/components/wordle/WordleGlobalLeaderboardTable.vue'
import TwitchRelayChatPanel from '@/components/twitch/TwitchRelayChatPanel.vue'
import WordleLocalBoardGrid from '@/components/wordle/WordleLocalBoardGrid.vue'
import WordleOnScreenKeyboard from '@/components/wordle/WordleOnScreenKeyboard.vue'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'
import { useWordleGlobalLeaderboard } from '@/composables/useWordleGlobalLeaderboard'
import { useWordleState } from '@/composables/useWordleState'
import { useWordleStatusBanners } from '@/composables/useWordleStatusBanners'
import { useWordleStreamerRoom } from '@/composables/useWordleStreamerRoom'
import { postWordleWin } from '@/wordle/wordleApi'
import type { Feedback } from '@/wordle/wordleLogic'
import { useWordleWs } from '@/wordle/ws'
import { createLogger } from '@/utils/logger'
import { useAuth } from '@/composables/useAuth'

const wordleLog = createLogger('wordle-ws')

const DEMO_TWITCH_CHANNEL = STREAMER_NICK

/** Ланцюг висоти як у `sa-call-route` — див. `style.css` (`html.sa-wordle-route`). */
const WORDLE_ROUTE_HTML_CLASS = 'sa-wordle-route'

function normalizeTwitchLogin(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') {
    return null
  }
  const t = raw.trim().replace(/^#/, '').toLowerCase()
  if (t.length < 2 || t.length > 25) {
    return null
  }
  if (!/^[a-z0-9_]+$/.test(t)) {
    return null
  }
  return t
}

const route = useRoute()
const { t } = useI18n()
const { isAuthenticated, user, isAdmin, ensureAuthLoaded } = useAuth()

/**
 * URL `/wordle/:name` targets a streamer room; if the signed-in user has a linked `Streamer` row,
 * their own room (chat + `streamerId`) is always used.
 */
const effectiveWordleSlug = computed((): string | null => {
  const u = user.value
  const fromAccount =
    u && typeof u.wordleStreamerName === 'string' ? normalizeTwitchLogin(u.wordleStreamerName) : null
  if (fromAccount) {
    return fromAccount
  }
  return normalizeTwitchLogin(String(route.params.streamer || ''))
})

/** Per-streamer local prefs (effective slug). */
const wordleStorageScope = computed(() => effectiveWordleSlug.value || 'default')

const {
  wordlePublicConfig,
  streamerProfile,
  streamerLoadError,
  effectiveTwitchChannel,
  loadStreamerCard,
  fetchWordlePublicConfig,
} = useWordleStreamerRoom({
  effectiveWordleSlug,
  demoFallbackChannel: DEMO_TWITCH_CHANNEL,
})

const lastError = ref<string | null>(null)

/** Unique per page load / tab — never from localStorage (avoids WS / UI collisions across tabs). */
const wordleTabPeerId =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`

const chatPanelRef = ref<InstanceType<typeof TwitchRelayChatPanel> | null>(null)

function scrollChatToBottom(): void {
  chatPanelRef.value?.scrollToBottom()
}

const {
  globalLbTab,
  globalLbLoading,
  globalLbError,
  globalLbTableRows,
  globalLbScoreLabel,
  globalLbSelfStreakSummary,
  loadGlobalLbActive,
} = useWordleGlobalLeaderboard({
  streamerProfile,
  effectiveWordleSlug,
  user,
})

const {
  gameState,
  leaderboard,
  chatLines,
  wsStatus,
  ircRelayStatus,
  connectWs,
  prepareWordleWsMount,
  disposeWordleWs,
} = useWordleWs({
  streamerProfile,
  lastError,
  wordleTabPeerId,
  log: wordleLog,
  onNewGame: () => {
    void loadGlobalLbActive()
  },
  afterChatLineAppended: () => {
    void nextTick(() => scrollChatToBottom())
  },
  isAuthenticated,
})

const {
  WORDLE_MAX_ATTEMPTS,
  WORD_LENGTH_OPTIONS,
  KBD_ROW1,
  KBD_ROW2,
  KBD_ROW3,
  wordLength,
  secretWord,
  localGuesses,
  gameStatus,
  localRoundId,
  soloLbPosted,
  localStats,
  secretPeekVisible,
  guessInput,
  localBoardLocked,
  wordleGridRows,
  kbdKeyFeedbackModifier,
  kbdAppendLetter,
  clampGuessSrInput,
  kbdBackspace,
  submitGuess,
  newRoundSameLength,
  setWordLength,
  toggleSecretPeek,
  hydrateScope,
  persistCurrentLocalStats,
  normalizeWord,
  wordGraphemeCount,
} = useWordleState({ storageScope: wordleStorageScope, lastError })

const { topBanner, wsStatusLabel, ircRelayBanner } = useWordleStatusBanners({
  streamerLoadError,
  lastError,
  wsStatus,
  ircRelayStatus,
})

function formatCooldownHint(ms: number): string {
  const s = ms / 1000
  const label = Number.isInteger(s) ? String(s) : s.toFixed(1)
  return t('wordleUi.cooldownHint', { seconds: label })
}

function feedbackToEmojis(fb: Feedback[]): string {
  return fb
    .map((f) => (f === 'correct' ? '🟩' : f === 'present' ? '🟨' : '⬛'))
    .join(' ')
}

const twitchWatchUrl = computed(
  () => `https://www.twitch.tv/${encodeURIComponent(effectiveTwitchChannel.value)}`,
)

const CONFETTI_PIECES = 32

function confettiStyle(i: number): Record<string, string> {
  const seed = i * 1103
  const cx = `${((seed % 160) - 80).toFixed(0)}px`
  const dx = `${(((seed * 7) % 200) - 100).toFixed(0)}px`
  const hue = String((seed * 13) % 360)
  const delay = `${((i * 17) % 450) / 1000}s`
  const dur = `${1.4 + ((seed % 80) / 100)}s`
  return {
    '--cf-cx': cx,
    '--cf-dx': dx,
    '--cf-hue': hue,
    '--cf-delay': delay,
    '--cf-dur': dur,
  }
}

const guessFieldId = 'wordle-guess-sr'

/** Довжина слова для підказки в чаті: з WS-стану раунду (як на сервері для Twitch), інакше локальна сітка. */
const chatTargetWordLength = computed(() => {
  const ws = gameState.value?.wordLength
  if (typeof ws === 'number' && Number.isFinite(ws) && ws > 0) {
    return Math.min(32, Math.max(1, Math.round(ws)))
  }
  return wordLength.value
})

watch(
  () => effectiveWordleSlug.value || 'default',
  async (scope) => {
    hydrateScope(scope)
    await loadStreamerCard()
    void fetchWordlePublicConfig()
    connectWs()
  },
  { immediate: true },
)

async function postSoloRoundToLeaderboard(result: 'win' | 'lose'): Promise<void> {
  if (!isAuthenticated.value || soloLbPosted.value) {
    return
  }
  const streamerId = streamerProfile.value?.id
  if (typeof streamerId !== 'string' || streamerId.length === 0) {
    return
  }
  const attempts = localGuesses.value.length
  if (result === 'win') {
    if (attempts < 1 || attempts > WORDLE_MAX_ATTEMPTS) {
      return
    }
  } else if (attempts !== WORDLE_MAX_ATTEMPTS) {
    return
  }
  soloLbPosted.value = true
  try {
    const ok = await postWordleWin({ streamerId, result, attempts })
    if (!ok) {
      soloLbPosted.value = false
      return
    }
    void loadGlobalLbActive()
  } catch {
    soloLbPosted.value = false
  }
}

function onWindowKeydown(e: KeyboardEvent): void {
  if (localBoardLocked.value) {
    return
  }
  const el = e.target
  if (el instanceof HTMLElement) {
    if (el.isContentEditable) {
      return
    }
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return
    }
    if (tag === 'A') {
      return
    }
    if (tag === 'BUTTON' && !el.closest('.wordle-page__kbd')) {
      return
    }
  }
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return
  }
  if (e.key === 'Backspace') {
    e.preventDefault()
    kbdBackspace()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    submitGuess()
    return
  }
  if (e.key.length === 1 && /\p{Script=Cyrillic}/u.test(e.key)) {
    e.preventDefault()
    kbdAppendLetter(normalizeWord(e.key))
    return
  }
}

/** WS оновлює стан сервера для майбутнього мультиплеєра; локальна гра їх не читає. */
watch(
  [gameState, leaderboard],
  ([gs, lb]) => {
    void gs
    void lb
  },
  { deep: true },
)

watch(gameStatus, (next, prev) => {
  if (prev !== 'playing') {
    return
  }
  if (next === 'won') {
    const s = { ...localStats.value, won: localStats.value.won + 1 }
    localStats.value = s
    persistCurrentLocalStats(s)
    void postSoloRoundToLeaderboard('win')
  } else if (next === 'lost') {
    const s = { ...localStats.value, lost: localStats.value.lost + 1 }
    localStats.value = s
    persistCurrentLocalStats(s)
    void postSoloRoundToLeaderboard('lose')
  }
})

const WORDLE_STREAM_CHAT_ANCHOR_ID = 'wordle-stream-chat-anchor'

function scrollWordleChatIntoView(): void {
  if (typeof document === 'undefined') {
    return
  }
  document.getElementById(WORDLE_STREAM_CHAT_ANCHOR_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  prepareWordleWsMount()
  document.documentElement.classList.add(WORDLE_ROUTE_HTML_CLASS)
  void ensureAuthLoaded()
  void loadGlobalLbActive()
  window.addEventListener('keydown', onWindowKeydown)
})

onUnmounted(() => {
  disposeWordleWs()
  document.documentElement.classList.remove(WORDLE_ROUTE_HTML_CLASS)
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

<template>
  <div class="page-route">
    <AppContainer
      wide
      flush
      :class="['wordle-page', `wordle-page--len${wordLength}`]"
    >
      <p
        v-if="topBanner"
        class="wordle-page__banner"
        :class="{ 'wordle-page__banner--error': topBanner.variant === 'error' }"
      >
        {{ topBanner.text }}
      </p>

      <div class="wordle-page__grid">
        <AppCard class="wordle-page__stack wordle-page__stack--side wordle-page__stack--leader">
          <div class="wordle-page__leader-stack">
            <WordleGlobalLeaderboardTable
              v-model:tab="globalLbTab"
              :loading="globalLbLoading"
              :error="globalLbError"
              :rows="globalLbTableRows"
              :score-column-header="globalLbScoreLabel"
              :self-streak-summary="globalLbSelfStreakSummary"
              :section-aria-label="t('wordleUi.globalLeaderboard')"
              :title="t('wordleUi.globalLeaderboard')"
              :tabs-aria-label="t('wordleLeaderboard.tabsAria')"
              :tab-wins-label="t('wordleLeaderboard.tabWins')"
              :tab-streak-label="t('wordleLeaderboard.tabStreak')"
              :tab-rating-label="t('wordleLeaderboard.tabRating')"
              :loading-text="t('wordleLeaderboard.loading')"
              :empty-text="t('wordleLeaderboard.empty')"
              :col-rank="t('wordleLeaderboard.colRank')"
              :col-player="t('wordleLeaderboard.colPlayer')"
              :you-label="t('wordleLeaderboard.you')"
            />
          </div>

          <div
            v-if="gameStatus === 'playing' && isAdmin"
            class="wordle-page__side-tools"
            :aria-label="t('wordleUi.streamToolsAria')"
          >
            <div class="wordle-page__side-tools-row">
              <AppButton type="button" variant="ghost" class="wordle-page__peek-btn wordle-page__side-tool-btn" @click="toggleSecretPeek">
                {{ secretPeekVisible ? t('wordleUi.hideWord') : t('wordleUi.showWord') }}
              </AppButton>
            </div>
            <p v-if="secretPeekVisible" class="wordle-page__peek-word wordle-page__peek-word--side" aria-live="polite">
              {{ secretWord }}
            </p>
          </div>

        </AppCard>

        <AppCard class="wordle-page__stack wordle-page__stack--game">
          <div class="wordle-page__game" :style="{ '--wordle-len': String(wordLength) }">
            <WordleLocalBoardGrid
              :round-id="localRoundId"
              :word-length="wordLength"
              :max-attempts="WORDLE_MAX_ATTEMPTS"
              :rows="wordleGridRows"
            />

            <div
              v-if="gameStatus === 'won'"
              :key="`win-${localRoundId}`"
              class="wordle-page__game-panel-width wordle-page__celebrate"
              aria-live="polite"
            >
              <div class="wordle-page__confetti" aria-hidden="true">
                <span
                  v-for="n in CONFETTI_PIECES"
                  :key="`cf-${localRoundId}-${n}`"
                  class="wordle-page__confetti-bit"
                  :style="confettiStyle(n)"
                />
              </div>
              <p class="wordle-page__celebrate-title">{{ t('wordleUi.celebrateTitle') }}</p>
              <AppButton variant="primary" type="button" class="wordle-page__celebrate-btn" @click="newRoundSameLength">
                {{ t('wordleUi.newWord') }}
              </AppButton>
            </div>

            <div
              v-else-if="gameStatus === 'lost'"
              class="wordle-page__game-panel-width wordle-page__end-panel wordle-page__end-panel--lost"
            >
              <p class="wordle-page__end-panel-text">
                {{ t('wordleUi.lostWasWord') }} <strong class="wordle-page__secret">{{ secretWord }}</strong>
              </p>
              <AppButton variant="primary" type="button" @click="newRoundSameLength">{{
                t('wordleUi.newWord')
              }}</AppButton>
            </div>

            <WordleOnScreenKeyboard
              v-if="gameStatus === 'playing'"
              :word-length="wordLength"
              :row1="KBD_ROW1"
              :row2="KBD_ROW2"
              :row3="KBD_ROW3"
              :word-length-options="WORD_LENGTH_OPTIONS"
              :keys-disabled="localBoardLocked"
              :enter-disabled="localBoardLocked || wordGraphemeCount(normalizeWord(guessInput)) !== wordLength"
              :letter-class="kbdKeyFeedbackModifier"
              :screen-keyboard-aria="t('wordleUi.screenKeyboardAria')"
              :kbd-toolbar-aria="t('wordleUi.kbdToolbarAria')"
              :enter-label="t('wordleUi.enter')"
              @letter="kbdAppendLetter"
              @backspace="kbdBackspace"
              @enter="submitGuess"
              @set-word-length="setWordLength"
            />

            <form class="wordle-page__sr-form" @submit.prevent="submitGuess">
              <label class="wordle-page__sr-only" :for="guessFieldId">{{ t('wordleUi.guessLabel') }}</label>
              <input
                :id="guessFieldId"
                v-model="guessInput"
                class="wordle-page__sr-only"
                type="text"
                inputmode="text"
                autocapitalize="off"
                spellcheck="false"
                :disabled="localBoardLocked"
                autocomplete="off"
                lang="uk"
                @input="clampGuessSrInput"
              />
            </form>

          </div>
        </AppCard>

        <div class="wordle-page__chat-mobile-trigger">
          <AppButton type="button" variant="secondary" @click="scrollWordleChatIntoView">
            {{ t('wordleUi.chatMobileOpen') }}
          </AppButton>
        </div>

        <AppCard
          :id="WORDLE_STREAM_CHAT_ANCHOR_ID"
          class="wordle-page__stack wordle-page__stack--side wordle-page__stack--chat"
        >
          <TwitchRelayChatPanel
            ref="chatPanelRef"
            :ws-status="wsStatus"
            :ws-status-label="wsStatusLabel"
            :chat-title="t('wordleUi.chatTitle')"
            :guess-len-hint="t('wordleUi.chatGuessLenHint', { n: chatTargetWordLength })"
            :channel-display="effectiveTwitchChannel"
            :twitch-watch-url="twitchWatchUrl"
            :open-twitch-label="t('wordleUi.chatOpenTwitch')"
            :irc-relay-banner="ircRelayBanner"
            :relay-aria-label="t('wordleUi.chatRelayAria')"
            :chat-empty-text="t('wordleUi.chatEmpty', { channel: effectiveTwitchChannel })"
            :guess-badge-label="t('wordleUi.chatGuessBadge')"
            :lines="chatLines"
            :default-cooldown-ms="wordlePublicConfig?.chatGuessCooldownMs ?? 1500"
            :format-cooldown-hint="formatCooldownHint"
            :feedback-to-emojis="feedbackToEmojis"
          />
        </AppCard>
      </div>

    </AppContainer>
  </div>
</template>

<style scoped>
.page-route {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

/* Десктоп-сітка з `min-width: 1201px`; нижче — планшет/мобільна колонка. */
@media (max-width: 1200px) {
  .page-route {
    flex: 0 1 auto;
  }
}

.wordle-page {
  --wordle-cell: 78px;
  --wordle-gap: 10px;
  --wordle-len-css: 5;
  flex: 1 1 auto;
  padding-block: var(--sa-space-2) var(--sa-space-5);
  /* AppContainer `flush` прибирає зовнішній padding — відступи лише тут */
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
}

.wordle-page--len6 {
  --wordle-cell: 66px;
  --wordle-len-css: 6;
}

.wordle-page--len7 {
  --wordle-cell: 56px;
  --wordle-len-css: 7;
}

.wordle-page__hint {
  font-size: 0.78rem;
  color: var(--sa-color-text-body);
}

.wordle-page__banner {
  margin: 0;
  padding: var(--sa-space-2) var(--sa-space-3);
  border-radius: var(--sa-radius-sm);
  background: var(--sa-color-primary-soft);
  border: 1px solid var(--sa-color-primary-border);
  color: var(--sa-color-text-main);
  font-size: 0.85rem;
}

.wordle-page__banner--warn {
  background: color-mix(in srgb, var(--sa-color-warning) 14%, var(--sa-color-surface));
  border-color: color-mix(in srgb, var(--sa-color-warning) 45%, var(--sa-color-border));
}

.wordle-page__setup {
  font-size: 0.8rem;
  color: var(--sa-color-text-body);
}

.wordle-page__setup summary {
  cursor: pointer;
  color: var(--sa-color-text-main);
  font-weight: 600;
  padding: var(--sa-space-1) 0;
}

.wordle-page__demo-pill {
  display: inline-block;
  margin-right: var(--sa-space-2);
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: var(--sa-color-primary-soft);
  border: 1px solid var(--sa-color-primary-border);
  color: var(--sa-color-text-main);
  vertical-align: middle;
}

.wordle-page__channels-sync {
  margin: var(--sa-space-2) 0 0;
  font-size: 0.78rem;
  color: var(--sa-color-text-body);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sa-space-1) var(--sa-space-2);
}

.wordle-page__channels-sync-sep {
  color: var(--sa-color-border);
}

.wordle-page__sync-ok {
  margin-left: var(--sa-space-1);
  font-size: 0.7rem;
  color: var(--sa-color-success);
  font-weight: 600;
}

.wordle-page__cooldown-hint {
  margin: 0 0 var(--sa-space-2);
  font-size: 0.75rem;
  color: var(--sa-color-text-body);
}

.wordle-page__channel-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sa-space-2);
  margin: var(--sa-space-2) 0;
  padding: var(--sa-space-2) var(--sa-space-3);
  border-radius: var(--sa-radius-md);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-bg-card) 88%, transparent);
}

.wordle-page__channel-line {
  margin: 0;
  font-size: 0.85rem;
  color: var(--sa-color-text-main);
}

.wordle-page__channel-tag {
  margin-left: var(--sa-space-1);
  font-size: 0.75rem;
  color: var(--sa-color-text-body);
  font-weight: normal;
}

.wordle-page__channel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sa-space-1);
}

.wordle-page__channel-form {
  margin: 0 0 var(--sa-space-3);
  padding: var(--sa-space-3);
  border-radius: var(--sa-radius-md);
  border: 1px solid var(--sa-color-primary-border);
  background: var(--sa-color-primary-soft);
}

.wordle-page__channel-label {
  display: block;
  margin-bottom: var(--sa-space-1);
  font-size: 0.8rem;
  color: var(--sa-color-text-main);
}

.wordle-page__channel-fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sa-space-2);
  align-items: center;
}

.wordle-page__input--channel {
  min-width: 10rem;
  max-width: 16rem;
  font: inherit;
  padding: 0.4rem 0.55rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 90%, transparent);
  color: var(--sa-color-text-main);
}

.wordle-page__hint--channel {
  margin: var(--sa-space-2) 0 0;
  word-break: break-all;
}

.wordle-page__hint--irc,
.wordle-page__hint--ws {
  margin: var(--sa-space-1) 0 0;
  font-size: 0.72rem;
}

.wordle-page__hint--embed {
  margin-top: var(--sa-space-1);
  font-size: 0.7rem;
}

.wordle-page__code {
  font-family: var(--sa-font-mono);
  font-size: 0.72rem;
  color: var(--sa-color-text-main);
}

.wordle-page__chat-mobile-trigger {
  display: none;
  justify-content: center;
  padding: var(--sa-space-1) 0;
  min-width: 0;
}

@media (max-width: 767px) {
  /* Кнопка прокрутки до чату в потоці документа; сам чат більше не fixed-оверлей (не наїжджає на поле/клавіатуру). */
  .wordle-page__chat-mobile-trigger {
    display: flex;
  }
}

.wordle-page__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--sa-space-4);
  align-items: stretch;
  /* `minmax(min-content, max-content)` ламав flow на одній колонці (планшет). */
  grid-auto-rows: auto;
}

/* Триколонка: лідерборд/чат не розтягуються ширше за клітинку grid, горизонтальний вміст не «протікає». */
.wordle-page__grid :deep(.wordle-page__stack--leader),
.wordle-page__grid :deep(.wordle-page__stack--chat) {
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}

.wordle-page__grid :deep(.wordle-page__stack--leader) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

@media (min-width: 1201px) {
  /* Одна висота колонок, скрол лише всередині (чат / таблиця), без скролу body. */
  .page-route {
    height: 100%;
    max-height: 100%;
    overflow: hidden;
    flex: 1 1 auto;
    min-height: 0;
  }

  .wordle-page {
    --wordle-gap: clamp(6px, 1vmin, 10px);
    max-width: min(87.5rem, 100%);
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  .wordle-page--len5 {
    --wordle-cell: clamp(40px, min(7.2vmin, 7dvh), 78px);
  }

  .wordle-page--len6 {
    --wordle-cell: clamp(34px, min(6.2vmin, 6.2dvh), 66px);
  }

  .wordle-page--len7 {
    --wordle-cell: clamp(30px, min(5.4vmin, 5.5dvh), 56px);
  }

  .wordle-page__grid {
    align-items: stretch;
    justify-content: center;
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    /* Було: боки min 260px + центр minmax(0,720px) — усе стискання «їло» лише центр.
       Співвідношення ~ як колишні max: 300 : 720 : 320 → 15fr : 36fr : 16fr. */
    grid-template-columns:
      minmax(10.25rem, 15fr)
      minmax(18.5rem, 36fr)
      minmax(10.25rem, 16fr);
  }

  @media (max-height: 820px) {
    .wordle-page__game {
      gap: var(--sa-space-2);
    }
  }
}

/* Мобільний / планшетний стек: одна колонка, скрол сторінки; порядок блоків фіксований. */
@media (max-width: 1200px) {
  .page-route {
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .wordle-page {
    flex: 0 1 auto;
    min-height: auto;
    height: auto;
    max-height: none;
    overflow: visible;
    padding-block: var(--sa-space-2) max(var(--sa-space-7), calc(var(--sa-space-5) + env(safe-area-inset-bottom, 0px)));
    max-width: min(68rem, 100%);
  }

  .wordle-page__grid {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
    gap: 16px;
  }

  .wordle-page__grid > .wordle-page__stack,
  .wordle-page__grid > .wordle-page__chat-mobile-trigger {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
    max-height: none;
    width: 100%;
    max-width: 100%;
    overflow-x: clip;
    overflow-y: visible;
  }

  .wordle-page__grid > .wordle-page__stack--leader {
    order: 1;
  }

  .wordle-page__grid > .wordle-page__stack--game {
    order: 2;
  }

  .wordle-page__grid > .wordle-page__chat-mobile-trigger {
    order: 3;
    display: none;
  }

  .wordle-page__grid > .wordle-page__stack--chat {
    order: 4;
  }

  .wordle-page__grid > .wordle-page__stack--leader {
    flex: 0 0 auto;
    align-self: stretch;
    overflow: visible;
  }

  .wordle-page__game {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
    justify-content: flex-start;
    max-width: 100%;
    overflow: visible;
  }

  .wordle-page__stack--leader > .wordle-page__leader-stack {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--sa-space-3);
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
  }

  .wordle-page__stack--chat > :deep(.wordle-page__chat-shell) {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
  }

  .wordle-page__grid :deep(.wordle-page__stack) {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
  }

  .wordle-page__grid :deep(.wordle-page__stack--chat) {
    flex: 0 0 auto;
    max-height: none;
    scroll-margin-top: var(--sa-space-4);
  }

  .wordle-page__leader-stack {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
    gap: var(--sa-space-3);
  }

  .wordle-page__leader-stack :deep(.wordle-page__global-lb) {
    flex: 0 0 auto;
    align-items: stretch;
  }

  .wordle-page__leader-stack :deep(.wordle-page__glb-scroll) {
    flex: 0 0 auto;
    min-height: auto;
    max-height: none;
    overflow-y: auto;
  }

  .wordle-page__grid :deep(.wordle-page__stack--game > .wordle-page__game) {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
  }

  .wordle-page__stack--leader > .wordle-page__side-tools {
    flex: 0 0 auto;
    margin: 0;
  }

}

@media (max-width: 1200px) {
  .wordle-page {
    padding-block: var(--sa-space-2) var(--sa-space-4);
    padding-inline: clamp(0.65rem, 2.8vw, var(--sa-space-3));
    --wordle-gap: clamp(4px, 1.2vw, 8px);
    overflow-x: clip;
  }

  .wordle-page__grid :deep(.wordle-page__stack--game) {
    max-width: 100%;
    overflow: visible;
  }
}

@supports (width: 1cqi) {
  @media (max-width: 1200px) {
    /* Один плавний режим для всіх <=1200px, без окремого "перелому" на 960px. */
    .wordle-page--len5 .wordle-page__game {
      --wordle-cell: min(
        clamp(3rem, 6.6vw, 4.75rem),
        calc((100cqi - (var(--wordle-len-css, 5) - 1) * var(--wordle-gap)) / var(--wordle-len-css, 5))
      );
    }

    .wordle-page--len6 .wordle-page__game {
      --wordle-cell: min(
        clamp(2.5rem, 5.5vw, 4rem),
        calc((100cqi - (var(--wordle-len-css, 6) - 1) * var(--wordle-gap)) / var(--wordle-len-css, 6))
      );
    }

    .wordle-page--len7 .wordle-page__game {
      --wordle-cell: min(
        clamp(2.1rem, 4.7vw, 3.4rem),
        calc((100cqi - (var(--wordle-len-css, 7) - 1) * var(--wordle-gap)) / var(--wordle-len-css, 7))
      );
    }
  }
}

@supports not (width: 1cqi) {
  @media (max-width: 1200px) {
    .wordle-page--len5 .wordle-page__game {
      --wordle-cell: min(
        clamp(3rem, 6.6vw, 4.75rem),
        calc((100% - (var(--wordle-len-css, 5) - 1) * var(--wordle-gap)) / var(--wordle-len-css, 5))
      );
    }

    .wordle-page--len6 .wordle-page__game {
      --wordle-cell: min(
        clamp(2.5rem, 5.5vw, 4rem),
        calc((100% - (var(--wordle-len-css, 6) - 1) * var(--wordle-gap)) / var(--wordle-len-css, 6))
      );
    }

    .wordle-page--len7 .wordle-page__game {
      --wordle-cell: min(
        clamp(2.1rem, 4.7vw, 3.4rem),
        calc((100% - (var(--wordle-len-css, 7) - 1) * var(--wordle-gap)) / var(--wordle-len-css, 7))
      );
    }
  }
}

@media (max-width: 520px) {
  .wordle-page {
    padding-inline: var(--sa-space-2);
  }

}

.wordle-page__stack {
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.wordle-page__stack--game {
  justify-content: flex-start;
}

.wordle-page__grid :deep(.wordle-page__stack--game > p) {
  flex-shrink: 0;
}

.wordle-page__grid :deep(.wordle-page__stack--game > .wordle-page__game) {
  min-height: 0;
}

.wordle-page__grid :deep(.wordle-page__stack) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (min-width: 1201px) {
  .wordle-page__grid :deep(.wordle-page__stack--leader),
  .wordle-page__grid :deep(.wordle-page__stack--chat) {
    flex: 0 0 auto;
    width: 100%;
  }

  .wordle-page__grid :deep(.wordle-page__stack) {
    min-height: 0;
    height: 100%;
  }

  .wordle-page__grid :deep(.wordle-page__stack--game) {
    max-width: 100%;
    overflow: visible;
    min-height: 0;
  }

  .wordle-page__grid :deep(.wordle-page__stack--game > .wordle-page__game) {
    flex: 1 1 auto;
    min-height: 0;
    justify-content: center;
  }

  .wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__leader-stack) {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
  }

  .wordle-page__stack--leader :deep(.wordle-page__global-lb) {
    flex: 1 1 auto;
    min-height: 0;
  }

  .wordle-page__stack--leader :deep(.wordle-page__glb-scroll) {
    flex: 1 1 auto;
    min-height: 0;
  }

  /* Триколонка: колонка чату тягнеться по висоті рядка; шапка fixed, повідомлення — scroll. */
  .wordle-page__grid :deep(.wordle-page__stack--chat) {
    min-height: 0;
    height: 100%;
  }

}

.wordle-page__grid :deep(.wordle-page__stack--chat) {
  gap: var(--sa-space-2);
}

.wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__side-tools) {
  flex-shrink: 0;
}

.wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__leader-stack) {
  /* `flex` лише в медіа: ≤1024 — за контентом; ≥1025 — тягнеться в колонці сітки (не перезаписувати пізнішим правилом). */
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
}

.wordle-page__card-title {
  margin: 0 0 var(--sa-space-2);
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--sa-color-text-main);
}

.wordle-page__side-tools {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--sa-space-2);
  margin: 0 0 var(--sa-space-2);
  padding: var(--sa-space-2);
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 45%, transparent);
}

.wordle-page__side-tools-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: var(--sa-space-2);
  width: 100%;
  min-width: 0;
}

.wordle-page__side-tool-btn {
  flex: 1 1 0;
  min-width: 0;
  width: auto;
  justify-content: center;
  font-size: 0.72rem;
  padding-inline: 0.35rem;
}

.wordle-page__peek-word--side {
  margin: 0;
  text-align: center;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--sa-color-warning);
  word-break: break-word;
}

.wordle-page__secret {
  letter-spacing: 0.06em;
  font-weight: 800;
  color: var(--sa-color-text-main);
}

.wordle-page__play-hint {
  margin: 0 0 var(--sa-space-3);
  font-size: 0.78rem;
  color: var(--sa-color-text-body);
  text-align: center;
}

.wordle-page__empty {
  padding: var(--sa-space-8);
  text-align: center;
  color: var(--sa-color-text-body);
}

.wordle-page__game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sa-space-3);
  flex: 1 1 auto;
  width: 100%;
  max-width: 100%;
  justify-content: center;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  container-type: inline-size;
  container-name: wordle-game;
}

.wordle-page__game-panel-width {
  width: 100%;
  max-width: calc(
    var(--wordle-len, 5) * var(--wordle-cell) + (var(--wordle-len, 5) - 1) * var(--wordle-gap)
  );
  margin-inline: auto;
}

.wordle-page__celebrate {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sa-space-2);
  min-height: 7.5rem;
  padding: var(--sa-space-3) var(--sa-space-2);
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--sa-color-success) 35%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-success) 12%, var(--sa-color-surface-raised));
}

.wordle-page__confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.wordle-page__confetti-bit {
  position: absolute;
  left: calc(50% + var(--cf-cx, 0px));
  top: -14px;
  width: 7px;
  height: 11px;
  border-radius: 2px;
  background: hsl(var(--cf-hue, 200) 82% 58%);
  opacity: 0.95;
  animation: wordle-confetti-fall var(--cf-dur, 1.6s) ease-out var(--cf-delay, 0s) forwards;
  will-change: transform, opacity;
}

@keyframes wordle-confetti-fall {
  0% {
    transform: translate3d(0, 0, 0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translate3d(var(--cf-dx, 0px), 150px, 0) rotate(620deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wordle-page__confetti-bit {
    animation: none;
    opacity: 0;
  }
}

.wordle-page__celebrate-title {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--sa-color-success);
  text-align: center;
}

.wordle-page__celebrate-btn {
  position: relative;
  z-index: 1;
}

.wordle-page__end-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sa-space-2);
  padding: var(--sa-space-3) var(--sa-space-2);
  border-radius: 10px;
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 88%, transparent);
}

.wordle-page__end-panel-text {
  margin: 0;
  font-size: 0.88rem;
  color: var(--sa-color-text-body);
  text-align: center;
}

.wordle-page__peek-btn {
  font-size: 0.78rem;
  padding: 0.3rem 0.65rem;
}

.wordle-page__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.wordle-page__sr-form {
  margin: 0;
  padding: 0;
  height: 0;
  overflow: hidden;
}

.wordle-page__others {
  width: 100%;
  max-width: 24rem;
  font-size: 0.8rem;
  color: var(--sa-color-text-body);
}

.wordle-page__others summary {
  cursor: pointer;
  color: var(--sa-color-text-main);
  font-weight: 600;
}

.wordle-page__others-count {
  font-weight: 500;
  color: var(--sa-color-text-body);
}

.wordle-page__others-list {
  list-style: none;
  margin: var(--sa-space-2) 0 0;
  padding: 0;
}

.wordle-page__others-item {
  display: flex;
  justify-content: space-between;
  gap: var(--sa-space-2);
  padding: var(--sa-space-1) 0;
  border-bottom: 1px solid var(--sa-color-border);
  font-size: 0.75rem;
}

.wordle-page__others-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--sa-color-text-main);
}

.wordle-page__others-stat {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: var(--sa-color-text-body);
}

@media (max-width: 640px) {
  .wordle-page__side-tools-row {
    flex-direction: column;
  }
}

.wordle-page__admin-hint {
  font-size: 0.75rem;
  color: var(--sa-color-text-body);
  margin: var(--sa-space-2) 0 0;
}

@media (max-width: 1200px) {
  .wordle-page__stack--leader > .wordle-page__leader-stack {
    display: block;
    flex: none;
    min-height: auto;
    height: auto;
  }

  .wordle-page__stack--leader > .wordle-page__leader-stack :deep(.wordle-page__global-lb) {
    display: flex;
    flex: none;
    align-items: stretch;
    margin-top: 0;
    min-height: auto;
  }

  .wordle-page__stack--leader > .wordle-page__leader-stack :deep(.wordle-page__global-lb > .wordle-page__glb-scroll) {
    flex: none;
    min-height: auto;
    max-height: none;
  }

  .wordle-page__stack--leader > .wordle-page__side-tools {
    margin-top: var(--sa-space-3);
  }

  .wordle-page__stack--game > .wordle-page__game,
  .wordle-page__stack--chat > :deep(.wordle-page__chat-shell),
  .wordle-page__stack--chat :deep(.wordle-page__chat-feed) {
    flex: none;
    min-height: auto;
    height: auto;
    max-height: none;
  }
}

@media (min-width: 1201px) {
  .wordle-page__stack--chat {
    min-height: 0;
    height: 100%;
  }

  .wordle-page__stack--chat > :deep(.wordle-page__chat-shell) {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
  }

  .wordle-page__stack--chat :deep(.wordle-page__chat-feed) {
    flex: 1 1 auto;
    min-height: 0;
    height: auto;
    max-height: none;
    overflow-y: auto;
  }
}
</style>
