<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppContainer from '@/components/ui/AppContainer.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import NadleGlobalLeaderboardTable from '@/components/nadle/NadleGlobalLeaderboardTable.vue'
import TwitchRelayChatPanel from '@/components/twitch/TwitchRelayChatPanel.vue'
import NadleLocalBoardGrid from '@/components/nadle/NadleLocalBoardGrid.vue'
import NadleOnScreenKeyboard from '@/components/nadle/NadleOnScreenKeyboard.vue'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'
import { useNadleGlobalLeaderboard } from '@/composables/useNadleGlobalLeaderboard'
import { useNadleState } from '@/composables/useNadleState'
import { useNadleStatusBanners } from '@/composables/useNadleStatusBanners'
import { useNadleStreamerRoom } from '@/composables/useNadleStreamerRoom'
import { postNadleWin } from '@/nadle/nadleApi'
import type { Feedback } from '@/nadle/nadleLogic'
import { useNadleWs } from '@/nadle/ws'
import { createLogger } from '@/utils/logger'
import { useAuth } from '@/composables/useAuth'

const nadleLog = createLogger('nadle-ws')

const DEMO_TWITCH_CHANNEL = STREAMER_NICK

/** Ланцюг висоти як у `sa-call-route` — див. `style.css` (`html.sa-nadle-route`). */
const NADLE_ROUTE_HTML_CLASS = 'sa-nadle-route'

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
 * URL `/nadle/:name` targets a streamer room; if the signed-in user has a linked `Streamer` row,
 * their own room (chat + `streamerId`) is always used.
 */
const effectiveNadleSlug = computed((): string | null => {
  const u = user.value
  const fromAccount =
    u && typeof u.nadleStreamerName === 'string' ? normalizeTwitchLogin(u.nadleStreamerName) : null
  if (fromAccount) {
    return fromAccount
  }
  return normalizeTwitchLogin(String(route.params.streamer || ''))
})

/** Per-streamer local prefs (effective slug). */
const nadleStorageScope = computed(() => effectiveNadleSlug.value || 'default')

const {
  nadlePublicConfig,
  streamerProfile,
  streamerLoadError,
  effectiveTwitchChannel,
  loadStreamerCard,
  fetchNadlePublicConfig,
} = useNadleStreamerRoom({
  effectiveNadleSlug,
  demoFallbackChannel: DEMO_TWITCH_CHANNEL,
})

const lastError = ref<string | null>(null)

/** Unique per page load / tab — never from localStorage (avoids WS / UI collisions across tabs). */
const nadleTabPeerId =
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
} = useNadleGlobalLeaderboard({
  streamerProfile,
  effectiveNadleSlug,
  user,
})

const {
  gameState,
  leaderboard,
  chatLines,
  wsStatus,
  ircRelayStatus,
  connectWs,
  prepareNadleWsMount,
  disposeNadleWs,
} = useNadleWs({
  streamerProfile,
  lastError,
  nadleTabPeerId,
  log: nadleLog,
  onNewGame: () => {
    void loadGlobalLbActive()
  },
  afterChatLineAppended: () => {
    void nextTick(() => scrollChatToBottom())
  },
  isAuthenticated,
})

const {
  NADLE_MAX_ATTEMPTS,
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
  nadleGridRows,
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
} = useNadleState({ storageScope: nadleStorageScope, lastError })

const { topBanner, wsStatusLabel, ircRelayBanner } = useNadleStatusBanners({
  streamerLoadError,
  lastError,
  wsStatus,
  ircRelayStatus,
})

function formatCooldownHint(ms: number): string {
  const s = ms / 1000
  const label = Number.isInteger(s) ? String(s) : s.toFixed(1)
  return t('nadleUi.cooldownHint', { seconds: label })
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

const guessFieldId = 'nadle-guess-sr'
const guessInputEl = ref<HTMLInputElement | null>(null)

/** Довжина слова для підказки в чаті: з WS-стану раунду (як на сервері для Twitch), інакше локальна сітка. */
const chatTargetWordLength = computed(() => {
  const ws = gameState.value?.wordLength
  if (typeof ws === 'number' && Number.isFinite(ws) && ws > 0) {
    return Math.min(32, Math.max(1, Math.round(ws)))
  }
  return wordLength.value
})

watch(
  () => effectiveNadleSlug.value || 'default',
  async (scope) => {
    hydrateScope(scope)
    await loadStreamerCard()
    void fetchNadlePublicConfig()
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
    if (attempts < 1 || attempts > NADLE_MAX_ATTEMPTS) {
      return
    }
  } else if (attempts !== NADLE_MAX_ATTEMPTS) {
    return
  }
  soloLbPosted.value = true
  try {
    const ok = await postNadleWin({ streamerId, result, attempts })
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
    if (tag === 'BUTTON' && !el.closest('.nadle-page__kbd')) {
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

const NADLE_STREAM_CHAT_ANCHOR_ID = 'nadle-stream-chat-anchor'

function scrollNadleChatIntoView(): void {
  if (typeof document === 'undefined') {
    return
  }
  document.getElementById(NADLE_STREAM_CHAT_ANCHOR_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function focusNadleGuessInput(): void {
  if (localBoardLocked.value) {
    return
  }
  guessInputEl.value?.focus({ preventScroll: true })
}

onMounted(() => {
  prepareNadleWsMount()
  document.documentElement.classList.add(NADLE_ROUTE_HTML_CLASS)
  void ensureAuthLoaded()
  void loadGlobalLbActive()
  window.addEventListener('keydown', onWindowKeydown)
})

onUnmounted(() => {
  disposeNadleWs()
  document.documentElement.classList.remove(NADLE_ROUTE_HTML_CLASS)
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

<template>
  <div class="page-route">
    <AppContainer
      wide
      flush
      :class="['nadle-page', `nadle-page--len${wordLength}`]"
    >
      <p
        v-if="topBanner"
        class="nadle-page__banner"
        :class="{ 'nadle-page__banner--error': topBanner.variant === 'error' }"
      >
        {{ topBanner.text }}
      </p>

      <div class="nadle-page__grid">
        <AppCard class="nadle-page__stack nadle-page__stack--side nadle-page__stack--leader">
          <div class="nadle-page__leader-stack">
            <NadleGlobalLeaderboardTable
              v-model:tab="globalLbTab"
              :loading="globalLbLoading"
              :error="globalLbError"
              :rows="globalLbTableRows"
              :score-column-header="globalLbScoreLabel"
              :self-streak-summary="globalLbSelfStreakSummary"
              :section-aria-label="t('nadleUi.globalLeaderboard')"
              :title="t('nadleUi.globalLeaderboard')"
              :tabs-aria-label="t('nadleLeaderboard.tabsAria')"
              :tab-wins-label="t('nadleLeaderboard.tabWins')"
              :tab-streak-label="t('nadleLeaderboard.tabStreak')"
              :tab-rating-label="t('nadleLeaderboard.tabRating')"
              :loading-text="t('nadleLeaderboard.loading')"
              :empty-text="t('nadleLeaderboard.empty')"
              :col-rank="t('nadleLeaderboard.colRank')"
              :col-player="t('nadleLeaderboard.colPlayer')"
              :you-label="t('nadleLeaderboard.you')"
            />
          </div>

          <div
            v-if="gameStatus === 'playing' && isAdmin"
            class="nadle-page__side-tools"
            :aria-label="t('nadleUi.streamToolsAria')"
          >
            <div class="nadle-page__side-tools-row">
              <AppButton type="button" variant="ghost" class="nadle-page__peek-btn nadle-page__side-tool-btn" @click="toggleSecretPeek">
                {{ secretPeekVisible ? t('nadleUi.hideWord') : t('nadleUi.showWord') }}
              </AppButton>
            </div>
            <p v-if="secretPeekVisible" class="nadle-page__peek-word nadle-page__peek-word--side" aria-live="polite">
              {{ secretWord }}
            </p>
          </div>

        </AppCard>

        <AppCard class="nadle-page__stack nadle-page__stack--game">
          <div class="nadle-page__game" :style="{ '--nadle-len': String(wordLength) }">
            <NadleLocalBoardGrid
              :round-id="localRoundId"
              :word-length="wordLength"
              :max-attempts="NADLE_MAX_ATTEMPTS"
              :rows="nadleGridRows"
              @focus-input="focusNadleGuessInput"
            />

            <div
              v-if="gameStatus === 'won'"
              :key="`win-${localRoundId}`"
              class="nadle-page__game-panel-width nadle-page__celebrate"
              aria-live="polite"
            >
              <div class="nadle-page__confetti" aria-hidden="true">
                <span
                  v-for="n in CONFETTI_PIECES"
                  :key="`cf-${localRoundId}-${n}`"
                  class="nadle-page__confetti-bit"
                  :style="confettiStyle(n)"
                />
              </div>
              <p class="nadle-page__celebrate-title">{{ t('nadleUi.celebrateTitle') }}</p>
              <AppButton variant="primary" type="button" class="nadle-page__celebrate-btn" @click="newRoundSameLength">
                {{ t('nadleUi.newWord') }}
              </AppButton>
            </div>

            <div
              v-else-if="gameStatus === 'lost'"
              class="nadle-page__game-panel-width nadle-page__end-panel nadle-page__end-panel--lost"
            >
              <p class="nadle-page__end-panel-text">
                {{ t('nadleUi.lostWasWord') }} <strong class="nadle-page__secret">{{ secretWord }}</strong>
              </p>
              <AppButton variant="primary" type="button" @click="newRoundSameLength">{{
                t('nadleUi.newWord')
              }}</AppButton>
            </div>

            <NadleOnScreenKeyboard
              v-if="gameStatus === 'playing'"
              :word-length="wordLength"
              :row1="KBD_ROW1"
              :row2="KBD_ROW2"
              :row3="KBD_ROW3"
              :word-length-options="WORD_LENGTH_OPTIONS"
              :keys-disabled="localBoardLocked"
              :enter-disabled="localBoardLocked || wordGraphemeCount(normalizeWord(guessInput)) !== wordLength"
              :letter-class="kbdKeyFeedbackModifier"
              :screen-keyboard-aria="t('nadleUi.screenKeyboardAria')"
              :kbd-toolbar-aria="t('nadleUi.kbdToolbarAria')"
              :enter-label="t('nadleUi.enter')"
              @letter="kbdAppendLetter"
              @backspace="kbdBackspace"
              @enter="submitGuess"
              @set-word-length="setWordLength"
            />

            <form class="nadle-page__sr-form" @submit.prevent="submitGuess">
              <label class="nadle-page__sr-only" :for="guessFieldId">{{ t('nadleUi.guessLabel') }}</label>
              <input
                :id="guessFieldId"
                ref="guessInputEl"
                v-model="guessInput"
                class="nadle-page__sr-only"
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

        <div class="nadle-page__chat-mobile-trigger">
          <AppButton type="button" variant="secondary" @click="scrollNadleChatIntoView">
            {{ t('nadleUi.chatMobileOpen') }}
          </AppButton>
        </div>

        <AppCard
          :id="NADLE_STREAM_CHAT_ANCHOR_ID"
          class="nadle-page__stack nadle-page__stack--side nadle-page__stack--chat"
        >
          <TwitchRelayChatPanel
            ref="chatPanelRef"
            flex-rail
            :ws-status="wsStatus"
            :ws-status-label="wsStatusLabel"
            :chat-title="t('nadleUi.chatTitle')"
            :guess-len-hint="t('nadleUi.chatGuessLenHint', { n: chatTargetWordLength })"
            :channel-display="effectiveTwitchChannel"
            :twitch-watch-url="twitchWatchUrl"
            :open-twitch-label="t('nadleUi.chatOpenTwitch')"
            :irc-relay-banner="ircRelayBanner"
            :relay-aria-label="t('nadleUi.chatRelayAria')"
            :chat-empty-text="t('nadleUi.chatEmpty', { channel: effectiveTwitchChannel })"
            :guess-badge-label="t('nadleUi.chatGuessBadge')"
            :lines="chatLines"
            :default-cooldown-ms="nadlePublicConfig?.chatGuessCooldownMs ?? 1500"
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

.nadle-page {
  --nadle-cell: 61px;
  --nadle-gap: 11px;
  --nadle-len-css: 5;
  --nadle-panel-radius: 29px;
  --nadle-panel-bg: linear-gradient(105deg, rgba(124, 77, 219, 0.173) 0%, rgba(60, 36, 99, 0.169) 73.21%);
  --nadle-panel-border: rgba(255, 255, 255, 0.22);
  --nadle-control-bg: rgba(102, 56, 143, 0.47);
  --nadle-control-bg-muted: rgba(102, 56, 143, 0.11);
  --nadle-control-bg-soft: rgba(102, 56, 143, 0.05);
  --nadle-tile-bg: rgba(102, 56, 143, 0.33);
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

.nadle-page--len6 {
  --nadle-cell: 54px;
  --nadle-len-css: 6;
}

.nadle-page--len7 {
  --nadle-cell: 48px;
  --nadle-len-css: 7;
}

.nadle-page__hint {
  font-size: 0.78rem;
  color: var(--sa-color-text-body);
}

.nadle-page__banner {
  margin: 0;
  padding: 11px 15px;
  border-radius: var(--nadle-panel-radius);
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.16) 0 1px, transparent 1.7px),
    radial-gradient(circle at 34% 58%, rgba(102, 56, 143, 0.2), transparent 32%),
    var(--nadle-panel-bg);
  border: 1px solid var(--nadle-panel-border);
  color: var(--sa-color-text-main);
  font-family: "Marmelad", var(--sa-font-main);
  font-size: 0.85rem;
  font-weight: 400;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 12px 32px rgba(3, 1, 9, 0.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.18);
  backdrop-filter: blur(20px) saturate(1.18);
}

.nadle-page__banner--warn {
  background: color-mix(in srgb, var(--sa-color-warning) 14%, var(--sa-color-surface));
  border-color: color-mix(in srgb, var(--sa-color-warning) 45%, var(--sa-color-border));
}

.nadle-page__setup {
  font-size: 0.8rem;
  color: var(--sa-color-text-body);
}

.nadle-page__setup summary {
  cursor: pointer;
  color: var(--sa-color-text-main);
  font-weight: 600;
  padding: var(--sa-space-1) 0;
}

.nadle-page__demo-pill {
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

.nadle-page__channels-sync {
  margin: var(--sa-space-2) 0 0;
  font-size: 0.78rem;
  color: var(--sa-color-text-body);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sa-space-1) var(--sa-space-2);
}

.nadle-page__channels-sync-sep {
  color: var(--sa-color-border);
}

.nadle-page__sync-ok {
  margin-left: var(--sa-space-1);
  font-size: 0.7rem;
  color: var(--sa-color-success);
  font-weight: 600;
}

.nadle-page__cooldown-hint {
  margin: 0 0 var(--sa-space-2);
  font-size: 0.75rem;
  color: var(--sa-color-text-body);
}

.nadle-page__channel-bar {
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

.nadle-page__channel-line {
  margin: 0;
  font-size: 0.85rem;
  color: var(--sa-color-text-main);
}

.nadle-page__channel-tag {
  margin-left: var(--sa-space-1);
  font-size: 0.75rem;
  color: var(--sa-color-text-body);
  font-weight: normal;
}

.nadle-page__channel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sa-space-1);
}

.nadle-page__channel-form {
  margin: 0 0 var(--sa-space-3);
  padding: var(--sa-space-3);
  border-radius: var(--sa-radius-md);
  border: 1px solid var(--sa-color-primary-border);
  background: var(--sa-color-primary-soft);
}

.nadle-page__channel-label {
  display: block;
  margin-bottom: var(--sa-space-1);
  font-size: 0.8rem;
  color: var(--sa-color-text-main);
}

.nadle-page__channel-fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sa-space-2);
  align-items: center;
}

.nadle-page__input--channel {
  min-width: 10rem;
  max-width: 16rem;
  font: inherit;
  padding: 0.4rem 0.55rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 90%, transparent);
  color: var(--sa-color-text-main);
}

.nadle-page__hint--channel {
  margin: var(--sa-space-2) 0 0;
  word-break: break-all;
}

.nadle-page__hint--irc,
.nadle-page__hint--ws {
  margin: var(--sa-space-1) 0 0;
  font-size: 0.72rem;
}

.nadle-page__hint--embed {
  margin-top: var(--sa-space-1);
  font-size: 0.7rem;
}

.nadle-page__code {
  font-family: var(--sa-font-mono);
  font-size: 0.72rem;
  color: var(--sa-color-text-main);
}

.nadle-page__chat-mobile-trigger {
  display: none;
  justify-content: center;
  padding: var(--sa-space-1) 0;
  min-width: 0;
}

@media (max-width: 767px) {
  /* Кнопка прокрутки до чату в потоці документа; сам чат більше не fixed-оверлей (не наїжджає на поле/клавіатуру). */
  .nadle-page__chat-mobile-trigger {
    display: flex;
  }
}

.nadle-page__grid {
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
.nadle-page__grid :deep(.nadle-page__stack--leader),
.nadle-page__grid :deep(.nadle-page__stack--chat) {
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}

.nadle-page__grid :deep(.nadle-page__stack--leader) {
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

  .nadle-page {
    --nadle-gap: clamp(10px, 1.35vmin, 13px);
    padding-block: 18px 18px;
    padding-inline: clamp(6px, 0.75vw, 12px);
    max-width: min(1577px, 100%);
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  .nadle-page--len5 {
    --nadle-cell: clamp(48px, min(7.6vmin, 8.45dvh), 74px);
  }

  .nadle-page--len6 {
    --nadle-cell: clamp(41px, min(6.9vmin, 7.5dvh), 65px);
  }

  .nadle-page--len7 {
    --nadle-cell: clamp(36px, min(6.15vmin, 6.65dvh), 58px);
  }

  .nadle-page__grid {
    align-items: stretch;
    justify-content: center;
    flex: 1 1 auto;
    min-height: 0;
    height: min(725px, 100%);
    max-height: 725px;
    grid-template-columns:
      minmax(278px, 336px)
      minmax(0, 845px)
      minmax(278px, 336px);
    gap: 13px;
  }

  @media (max-height: 820px) {
    .nadle-page {
      --nadle-gap: 6px;
    }

    .nadle-page--len5 {
      --nadle-cell: clamp(34px, 5dvh, 38px);
    }

    .nadle-page--len6 {
      --nadle-cell: clamp(30px, 4.4dvh, 34px);
    }

    .nadle-page--len7 {
      --nadle-cell: clamp(27px, 4dvh, 31px);
    }

    .nadle-page__game {
      gap: 8px;
      padding-block: 12px;
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

  .nadle-page {
    flex: 0 1 auto;
    min-height: auto;
    height: auto;
    max-height: none;
    overflow: visible;
    padding-block: var(--sa-space-2) max(var(--sa-space-7), calc(var(--sa-space-5) + env(safe-area-inset-bottom, 0px)));
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

  .nadle-page__grid > .nadle-page__stack,
  .nadle-page__grid > .nadle-page__chat-mobile-trigger {
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

  .nadle-page__grid > .nadle-page__chat-mobile-trigger {
    order: 3;
    display: none;
  }

  .nadle-page__grid > .nadle-page__stack--chat {
    order: 4;
  }

  .nadle-page__grid > .nadle-page__stack--leader {
    flex: 0 0 auto;
    align-self: stretch;
    overflow: visible;
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

  .nadle-page__stack--leader > .nadle-page__leader-stack {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--sa-space-3);
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
  }

  .nadle-page__stack--chat > :deep(.nadle-page__chat-shell) {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
  }

  .nadle-page__grid :deep(.nadle-page__stack) {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
  }

  .nadle-page__grid :deep(.nadle-page__stack--chat) {
    flex: 0 0 auto;
    max-height: none;
    scroll-margin-top: var(--sa-space-4);
  }

  .nadle-page__leader-stack {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
    gap: var(--sa-space-3);
  }

  .nadle-page__leader-stack :deep(.nadle-page__global-lb) {
    flex: 0 0 auto;
    align-items: stretch;
  }

  .nadle-page__leader-stack :deep(.nadle-page__glb-scroll) {
    flex: 0 0 auto;
    min-height: auto;
    max-height: none;
    overflow-y: auto;
  }

  .nadle-page__grid :deep(.nadle-page__stack--game > .nadle-page__game) {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
  }

  .nadle-page__stack--leader > .nadle-page__side-tools {
    flex: 0 0 auto;
    margin: 0;
  }

}

@media (max-width: 1200px) {
  .nadle-page {
    padding-block: var(--sa-space-2) var(--sa-space-4);
    padding-inline: clamp(0.65rem, 2.8vw, var(--sa-space-3));
    --nadle-gap: clamp(4px, 1.2vw, 8px);
    overflow-x: clip;
  }

  .nadle-page__grid :deep(.nadle-page__stack--game) {
    max-width: 100%;
    overflow: visible;
  }
}

@supports (width: 1cqi) {
  @media (max-width: 1200px) {
    /* Один плавний режим для всіх <=1200px, без окремого "перелому" на 960px. */
    .nadle-page--len5 .nadle-page__game {
      --nadle-cell: min(
        clamp(3rem, 6.6vw, 4.75rem),
        calc((100cqi - (var(--nadle-len-css, 5) - 1) * var(--nadle-gap)) / var(--nadle-len-css, 5))
      );
    }

    .nadle-page--len6 .nadle-page__game {
      --nadle-cell: min(
        clamp(2.5rem, 5.5vw, 4rem),
        calc((100cqi - (var(--nadle-len-css, 6) - 1) * var(--nadle-gap)) / var(--nadle-len-css, 6))
      );
    }

    .nadle-page--len7 .nadle-page__game {
      --nadle-cell: min(
        clamp(2.1rem, 4.7vw, 3.4rem),
        calc((100cqi - (var(--nadle-len-css, 7) - 1) * var(--nadle-gap)) / var(--nadle-len-css, 7))
      );
    }
  }
}

@supports not (width: 1cqi) {
  @media (max-width: 1200px) {
    .nadle-page--len5 .nadle-page__game {
      --nadle-cell: min(
        clamp(3rem, 6.6vw, 4.75rem),
        calc((100% - (var(--nadle-len-css, 5) - 1) * var(--nadle-gap)) / var(--nadle-len-css, 5))
      );
    }

    .nadle-page--len6 .nadle-page__game {
      --nadle-cell: min(
        clamp(2.5rem, 5.5vw, 4rem),
        calc((100% - (var(--nadle-len-css, 6) - 1) * var(--nadle-gap)) / var(--nadle-len-css, 6))
      );
    }

    .nadle-page--len7 .nadle-page__game {
      --nadle-cell: min(
        clamp(2.1rem, 4.7vw, 3.4rem),
        calc((100% - (var(--nadle-len-css, 7) - 1) * var(--nadle-gap)) / var(--nadle-len-css, 7))
      );
    }
  }
}

@media (max-width: 520px) {
  .nadle-page {
    padding-inline: var(--sa-space-2);
  }

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

.nadle-page__grid :deep(.nadle-page__stack--game > p) {
  flex-shrink: 0;
}

.nadle-page__grid :deep(.nadle-page__stack--game > .nadle-page__game) {
  min-height: 0;
}

.nadle-page__grid :deep(.nadle-page__stack) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (min-width: 1201px) {
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
    justify-content: flex-start;
  }

  .nadle-page__grid :deep(.nadle-page__stack--leader > .nadle-page__leader-stack) {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
  }

  .nadle-page__stack--leader :deep(.nadle-page__global-lb) {
    flex: 1 1 auto;
    min-height: 0;
  }

  .nadle-page__stack--leader :deep(.nadle-page__glb-scroll) {
    flex: 1 1 auto;
    min-height: 0;
  }

  /* Триколонка: колонка чату тягнеться по висоті рядка; шапка fixed, повідомлення — scroll. */
  .nadle-page__grid :deep(.nadle-page__stack--chat) {
    min-height: 0;
    height: 100%;
  }

}

.nadle-page__grid :deep(.nadle-page__stack--chat) {
  gap: var(--sa-space-2);
}

.nadle-page__grid :deep(.nadle-page__stack--leader > .nadle-page__side-tools) {
  flex-shrink: 0;
}

.nadle-page__grid :deep(.nadle-page__stack--leader > .nadle-page__leader-stack) {
  /* `flex` лише в медіа: ≤1024 — за контентом; ≥1025 — тягнеться в колонці сітки (не перезаписувати пізнішим правилом). */
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

.nadle-page__side-tools {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--sa-space-2);
  margin: 0 10px 10px;
  padding: 0;
  border: 0;
  background: transparent;
}

.nadle-page__side-tools-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: var(--sa-space-2);
  width: 100%;
  min-width: 0;
}

.nadle-page__side-tool-btn {
  flex: 1 1 0;
  min-width: 0;
  width: auto;
  justify-content: center;
  min-height: 41px;
  border-radius: 29px;
  font-family: "Climate Crisis", var(--sa-font-display);
  font-size: 14px;
  letter-spacing: 0;
  padding-inline: 0.35rem;
  background: rgba(102, 56, 143, 0.66);
}

.nadle-page__peek-word--side {
  margin: 0;
  text-align: center;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--sa-color-warning);
  word-break: break-word;
}

.nadle-page__secret {
  letter-spacing: 0.06em;
  font-weight: 800;
  color: var(--sa-color-text-main);
}

.nadle-page__play-hint {
  margin: 0 0 var(--sa-space-3);
  font-size: 0.78rem;
  color: var(--sa-color-text-body);
  text-align: center;
}

.nadle-page__empty {
  padding: var(--sa-space-8);
  text-align: center;
  color: var(--sa-color-text-body);
}

.nadle-page__game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 13px;
  flex: 1 1 auto;
  width: 100%;
  max-width: 100%;
  justify-content: flex-start;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  padding: 22px 57px 18px;
  container-type: inline-size;
  container-name: nadle-game;
}

.nadle-page__game-panel-width {
  width: 100%;
  max-width: calc(
    var(--nadle-len, 5) * var(--nadle-cell) + (var(--nadle-len, 5) - 1) * var(--nadle-gap)
  );
  margin-inline: auto;
}

.nadle-page__celebrate {
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

.nadle-page__confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.nadle-page__confetti-bit {
  position: absolute;
  left: calc(50% + var(--cf-cx, 0px));
  top: -14px;
  width: 7px;
  height: 11px;
  border-radius: 2px;
  background: hsl(var(--cf-hue, 200) 82% 58%);
  opacity: 0.95;
  animation: nadle-confetti-fall var(--cf-dur, 1.6s) ease-out var(--cf-delay, 0s) forwards;
  will-change: transform, opacity;
}

@keyframes nadle-confetti-fall {
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
  .nadle-page__confetti-bit {
    animation: none;
    opacity: 0;
  }
}

.nadle-page__celebrate-title {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--sa-color-success);
  text-align: center;
}

.nadle-page__celebrate-btn {
  position: relative;
  z-index: 1;
}

.nadle-page__end-panel {
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

.nadle-page__end-panel-text {
  margin: 0;
  font-size: 0.88rem;
  color: var(--sa-color-text-body);
  text-align: center;
}

.nadle-page__peek-btn {
  font-size: 0.78rem;
  padding: 0.3rem 0.65rem;
}

.nadle-page__sr-only {
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

.nadle-page__sr-form {
  margin: 0;
  padding: 0;
  height: 0;
  overflow: hidden;
}

.nadle-page__others {
  width: 100%;
  max-width: 24rem;
  font-size: 0.8rem;
  color: var(--sa-color-text-body);
}

.nadle-page__others summary {
  cursor: pointer;
  color: var(--sa-color-text-main);
  font-weight: 600;
}

.nadle-page__others-count {
  font-weight: 500;
  color: var(--sa-color-text-body);
}

.nadle-page__others-list {
  list-style: none;
  margin: var(--sa-space-2) 0 0;
  padding: 0;
}

.nadle-page__others-item {
  display: flex;
  justify-content: space-between;
  gap: var(--sa-space-2);
  padding: var(--sa-space-1) 0;
  border-bottom: 1px solid var(--sa-color-border);
  font-size: 0.75rem;
}

.nadle-page__others-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--sa-color-text-main);
}

.nadle-page__others-stat {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: var(--sa-color-text-body);
}

@media (max-width: 640px) {
  .nadle-page__side-tools-row {
    flex-direction: column;
  }

  .nadle-page__grid > .nadle-page__stack {
    width: min(100%, calc(100vw - 16px));
    align-self: center;
  }
}

.nadle-page__admin-hint {
  font-size: 0.75rem;
  color: var(--sa-color-text-body);
  margin: var(--sa-space-2) 0 0;
}

@media (max-width: 1200px) {
  .nadle-page__stack--leader > .nadle-page__leader-stack {
    display: block;
    flex: none;
    min-height: auto;
    height: auto;
  }

  .nadle-page__stack--leader > .nadle-page__leader-stack :deep(.nadle-page__global-lb) {
    display: flex;
    flex: none;
    align-items: stretch;
    margin-top: 0;
    min-height: auto;
  }

  .nadle-page__stack--leader > .nadle-page__leader-stack :deep(.nadle-page__global-lb > .nadle-page__glb-scroll) {
    flex: none;
    min-height: auto;
    max-height: none;
  }

  .nadle-page__stack--leader > .nadle-page__side-tools {
    margin-top: var(--sa-space-3);
  }

  .nadle-page__stack--game > .nadle-page__game,
  .nadle-page__stack--chat > :deep(.nadle-page__chat-shell),
  .nadle-page__stack--chat :deep(.nadle-page__chat-feed) {
    flex: none;
    min-height: auto;
    height: auto;
    max-height: none;
  }
}

@media (min-width: 1201px) {
  .nadle-page__stack--chat {
    min-height: 0;
    height: 100%;
  }

  .nadle-page__stack--chat > :deep(.nadle-page__chat-shell) {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
  }

  .nadle-page__stack--chat :deep(.nadle-page__chat-feed) {
    flex: 1 1 auto;
    min-height: 0;
    height: auto;
    max-height: none;
    overflow-y: auto;
  }
}
</style>
