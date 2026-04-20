<script setup lang="ts">
import { ref } from 'vue'
import type { TwitchRelayChatLine, TwitchRelayChatWsStatus } from './twitchRelayChatTypes'

const props = withDefaults(
  defineProps<{
    wsStatus: TwitchRelayChatWsStatus
    wsStatusLabel: string
    chatTitle: string
    /** Shown when `showGuessHints` is true (e.g. Nadle word length). */
    guessLenHint: string
    channelDisplay: string
    twitchWatchUrl: string
    openTwitchLabel: string
    ircRelayBanner: string
    relayAriaLabel: string
    chatEmptyText: string
    guessBadgeLabel: string
    lines: TwitchRelayChatLine[]
    defaultCooldownMs: number
    formatCooldownHint: (ms: number) => string
    feedbackToEmojis: (fb: ('correct' | 'present' | 'absent')[]) => string
    /** Nadle: guess hints + badges. Nadraw / plain relay: false. */
    showGuessHints?: boolean
    /**
     * When true, the feed scrolls inside a fixed-height flex parent (sidebar rail).
     * Prevents chat content from stretching sibling columns (e.g. Nadraw canvas).
     */
    flexRail?: boolean
    /** When false, hides the WebSocket status pill (e.g. Nadraw uses a global link dot). */
    showWsPill?: boolean
  }>(),
  { showGuessHints: true, flexRail: false, showWsPill: true },
)

const feedEl = ref<HTMLElement | null>(null)

function avatarInitial(displayName: string): string {
  const s = displayName.trim()
  if (!s) {
    return '?'
  }
  const first = [...s][0]
  return first ? first.toUpperCase() : '?'
}

function scrollToBottom(): void {
  const el = feedEl.value
  if (!el) {
    return
  }
  el.scrollTop = el.scrollHeight
}

defineExpose({ scrollToBottom })
</script>

<template>
  <div class="twitch-relay-chat__shell" :class="{ 'twitch-relay-chat__shell--flex-rail': props.flexRail }">
    <header class="twitch-relay-chat__head">
      <div class="twitch-relay-chat__head-row">
        <h2 class="twitch-relay-chat__title">{{ props.chatTitle }}</h2>
        <span
          v-if="props.showWsPill"
          class="twitch-relay-chat__ws-pill"
          :data-state="props.wsStatus"
          >{{ props.wsStatusLabel }}</span
        >
      </div>
      <p v-if="props.showGuessHints && props.guessLenHint" class="twitch-relay-chat__len-hint" role="note">
        {{ props.guessLenHint }}
      </p>
      <div class="twitch-relay-chat__toolbar">
        <span class="twitch-relay-chat__channel-pill">#{{ props.channelDisplay }}</span>
        <a
          class="twitch-relay-chat__external"
          :href="props.twitchWatchUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ props.openTwitchLabel }}
        </a>
      </div>
      <p v-if="props.ircRelayBanner" class="twitch-relay-chat__irc-banner" role="status">{{ props.ircRelayBanner }}</p>
    </header>
    <div
      ref="feedEl"
      class="twitch-relay-chat__feed"
      role="log"
      aria-relevant="additions"
      :aria-label="props.relayAriaLabel"
    >
      <p v-if="props.lines.length === 0" class="twitch-relay-chat__empty">
        {{ props.chatEmptyText }}
      </p>
      <ul v-else class="twitch-relay-chat__lines">
        <li
          v-for="c in props.lines"
          :key="c._cid"
          class="twitch-relay-chat__line"
          :class="{
            'twitch-relay-chat__line--guess': c.validGuess && !c.system,
            'twitch-relay-chat__line--slow': c.rateLimited === true,
            'twitch-relay-chat__line--system': c.system === true,
          }"
        >
          <template v-if="c.system">
            <p class="twitch-relay-chat__system-text">{{ c.text }}</p>
          </template>
          <template v-else>
            <span class="twitch-relay-chat__avatar" aria-hidden="true">{{ avatarInitial(c.displayName) }}</span>
            <div class="twitch-relay-chat__line-body">
              <div class="twitch-relay-chat__line-meta">
                <span class="twitch-relay-chat__name">{{ c.displayName }}</span>
                <span v-if="c.validGuess" class="twitch-relay-chat__badge">{{ props.guessBadgeLabel }}</span>
              </div>
              <p class="twitch-relay-chat__text">
                <span class="twitch-relay-chat__text-inner">{{ c.text }}</span>
                <span
                  v-if="c.validGuess && c.guessFeedback?.length"
                  class="twitch-relay-chat__relay-emojis"
                  aria-hidden="true"
                  >{{ props.feedbackToEmojis(c.guessFeedback) }}</span
                >
              </p>
              <p v-if="c.rateLimited" class="twitch-relay-chat__cooldown">
                {{ props.formatCooldownHint(c.cooldownMs ?? props.defaultCooldownMs) }}
              </p>
            </div>
          </template>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.twitch-relay-chat__relay-emojis {
  margin-left: var(--sa-space-2);
  letter-spacing: 0.1em;
  font-size: 0.88rem;
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.4));
}

.twitch-relay-chat__shell {
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
}

/** Sidebar / split layout: never grow past parent; scroll messages inside the feed. */
.twitch-relay-chat__shell--flex-rail {
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
}

.twitch-relay-chat__shell--flex-rail .twitch-relay-chat__feed {
  flex: 1 1 0;
  min-height: 0;
  height: auto;
  max-height: none;
  overflow-y: auto;
}

.twitch-relay-chat__head {
  flex-shrink: 0;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.twitch-relay-chat__irc-banner {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: color-mix(in srgb, var(--sa-color-text-muted) 55%, #f59e0b 45%);
}

.twitch-relay-chat__head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sa-space-2);
}

.twitch-relay-chat__len-hint {
  margin: 0 0 var(--sa-space-2);
  font-size: 0.78rem;
  line-height: 1.45;
  color: color-mix(in srgb, var(--sa-color-text-body) 88%, var(--sa-color-primary) 12%);
}

.twitch-relay-chat__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--sa-color-text-main);
}

.twitch-relay-chat__ws-pill {
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 18%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-surface-raised) 78%, var(--sa-color-primary-soft) 22%);
  color: color-mix(in srgb, var(--sa-color-text-muted) 75%, var(--sa-color-primary) 25%);
}

.twitch-relay-chat__ws-pill[data-state='open'] {
  border-color: color-mix(in srgb, var(--sa-color-primary) 45%, transparent);
  color: var(--sa-color-primary);
  background: color-mix(in srgb, var(--sa-color-primary-soft) 75%, transparent);
}

.twitch-relay-chat__ws-pill[data-state='error'] {
  border-color: color-mix(in srgb, #f87171 45%, transparent);
  color: #fecaca;
}

.twitch-relay-chat__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sa-space-2);
  margin-top: 0.15rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.twitch-relay-chat__channel-pill {
  font-family: var(--sa-font-mono);
  font-size: 0.68rem;
  padding: 0.12rem 0.48rem;
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-primary-soft) 42%, var(--sa-color-surface-raised) 58%);
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 32%, var(--sa-color-border));
  color: var(--sa-color-text-main);
}

.twitch-relay-chat__external {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--sa-color-primary);
  text-decoration: none;
  padding: 0.18rem 0.5rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 38%, transparent);
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.twitch-relay-chat__external:hover {
  background: color-mix(in srgb, var(--sa-color-primary-soft) 85%, transparent);
  color: var(--sa-color-text-main);
}

@media (max-width: 640px) {
  .twitch-relay-chat__toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .twitch-relay-chat__external {
    margin-left: 0;
  }
}

.twitch-relay-chat__feed {
  flex: 0 1 auto;
  width: 100%;
  min-height: 8rem;
  overflow: auto;
  border-radius: var(--sa-radius-md);
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 24%, var(--sa-color-border));
  background: linear-gradient(
    165deg,
    color-mix(in srgb, var(--sa-color-surface-raised) 62%, var(--sa-color-primary) 14%) 0%,
    color-mix(in srgb, var(--sa-color-bg-deep, #0a0610) 82%, var(--sa-color-primary) 12%) 55%,
    color-mix(in srgb, var(--sa-color-bg-deep, #08050c) 90%, var(--sa-color-primary) 6%) 100%
  );
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.05),
    0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 8%, transparent);
}

.twitch-relay-chat__empty {
  margin: 0;
  margin-inline: auto;
  padding: var(--sa-space-5) var(--sa-space-4);
  max-width: 18rem;
  font-size: 0.84rem;
  line-height: 1.55;
  text-align: center;
  white-space: pre-line;
  color: color-mix(in srgb, var(--sa-color-text-body) 88%, var(--sa-color-primary) 12%);
}

.twitch-relay-chat__lines {
  list-style: none;
  margin: 0;
  padding: var(--sa-space-3) var(--sa-space-3) var(--sa-space-4);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.twitch-relay-chat__line {
  display: flex;
  align-items: flex-start;
  gap: 0.62rem;
  padding: 0.55rem 0.7rem 0.55rem 0.62rem;
  border-radius: var(--sa-radius-md);
  border: 1px solid color-mix(in srgb, var(--sa-color-border) 55%, var(--sa-color-primary) 28%);
  border-left: 3px solid color-mix(in srgb, var(--sa-color-primary) 72%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-surface-raised) 58%, rgb(12 10 22));
  box-shadow:
    0 2px 10px rgb(0 0 0 / 0.28),
    inset 0 1px 0 rgb(255 255 255 / 0.06);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
}

.twitch-relay-chat__line:nth-child(even) {
  background: color-mix(in srgb, var(--sa-color-surface-raised) 48%, rgb(10 8 18));
}

.twitch-relay-chat__line:hover {
  border-color: color-mix(in srgb, var(--sa-color-primary) 45%, var(--sa-color-border));
  box-shadow:
    0 4px 14px rgb(0 0 0 / 0.32),
    0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 22%, transparent),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

.twitch-relay-chat__line--guess {
  border-color: color-mix(in srgb, var(--sa-color-primary) 48%, transparent);
  border-left-color: var(--sa-color-primary, #a78bfa);
  background: linear-gradient(
    118deg,
    color-mix(in srgb, var(--sa-color-primary-soft) 52%, rgb(18 14 32)),
    color-mix(in srgb, rgb(15 12 28) 88%, var(--sa-color-primary) 12%)
  );
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 25%, transparent),
    0 3px 14px color-mix(in srgb, var(--sa-color-primary) 18%, rgb(0 0 0 / 0.5));
}

.twitch-relay-chat__line--slow {
  opacity: 0.9;
}

.twitch-relay-chat__line--system {
  border-left-color: color-mix(in srgb, var(--sa-color-primary) 35%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-surface-raised) 40%, rgb(8 12 24));
}

.twitch-relay-chat__system-text {
  margin: 0;
  width: 100%;
  font-size: 0.78rem;
  line-height: 1.45;
  font-style: italic;
  color: color-mix(in srgb, #7dd3fc 75%, var(--sa-color-text-body) 25%);
  word-break: break-word;
}

.twitch-relay-chat__avatar {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.74rem;
  font-weight: 800;
  color: #faf5ff;
  background: linear-gradient(
    150deg,
    color-mix(in srgb, var(--sa-color-primary) 55%, #2e1065),
    #0f0a1a
  );
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 55%, rgb(40 35 60));
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 0.35),
    0 2px 8px color-mix(in srgb, var(--sa-color-primary) 25%, transparent);
}

.twitch-relay-chat__line-body {
  min-width: 0;
  flex: 1 1 auto;
}

.twitch-relay-chat__line-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.twitch-relay-chat__name {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--sa-color-text-main) 94%, var(--sa-color-primary) 6%);
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.45);
}

.twitch-relay-chat__badge {
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
  color: var(--sa-color-primary);
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 42%, transparent);
  background: color-mix(in srgb, var(--sa-color-primary-soft) 55%, transparent);
}

.twitch-relay-chat__text {
  margin: 0.28rem 0 0;
  font-size: 0.8rem;
  line-height: 1.48;
  color: color-mix(in srgb, #f0ecf8 82%, var(--sa-color-text-body) 18%);
  word-break: break-word;
}

.twitch-relay-chat__text-inner {
  white-space: pre-wrap;
}

.twitch-relay-chat__cooldown {
  margin: 0.28rem 0 0;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sa-color-text-muted);
}

@media (max-width: 1200px) {
  .twitch-relay-chat__feed {
    flex: 0 0 auto;
    min-height: 12rem;
    height: auto;
  }
}

@media (max-width: 520px) {
  .twitch-relay-chat__feed {
    min-height: 10rem;
    max-height: none;
    height: auto;
  }
}

@media (min-width: 1201px) {
  .twitch-relay-chat__shell {
    flex: 1 1 0;
    min-height: 0;
    height: 100%;
  }

  .twitch-relay-chat__feed {
    flex: 1 1 0;
    min-height: min(12rem, 42dvh);
    overflow-y: auto;
  }
}
</style>
