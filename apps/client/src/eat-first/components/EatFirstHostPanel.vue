<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { createLogger } from '@/utils/logger'

const log = createLogger('eat-first:host-panel')

const copyHint = ref<'idle' | 'ok' | 'err'>('idle')
let copyHintTimer: ReturnType<typeof setTimeout> | null = null

const props = defineProps<{
  gameId: string
}>()

const { t } = useI18n()
const router = useRouter()

const overlayHref = computed(() => {
  if (!props.gameId.trim()) return ''
  return router.resolve({
    name: 'eat',
    query: { view: 'overlay', game: props.gameId.trim() },
  }).href
})

const overlayAbsoluteUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  const h = overlayHref.value
  if (!h) return ''
  return `${window.location.origin}${h.startsWith('/') ? h : `/${h}`}`
})

function setCopyHint(next: 'idle' | 'ok' | 'err'): void {
  copyHint.value = next
  if (copyHintTimer != null) {
    clearTimeout(copyHintTimer)
    copyHintTimer = null
  }
  if (next === 'idle') return
  copyHintTimer = setTimeout(() => {
    copyHint.value = 'idle'
    copyHintTimer = null
  }, 2200)
}

async function copyOverlayUrl(): Promise<void> {
  const text = overlayAbsoluteUrl.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    setCopyHint('ok')
  } catch (e) {
    log.warn('clipboard copy failed', e)
    setCopyHint('err')
  }
}
</script>

<template>
  <aside class="eat-first-host-panel" :aria-label="t('eatFirstCall.hostPanelTitle')">
    <div class="eat-first-host-panel__title">{{ t('eatFirstCall.hostPanelTitle') }}</div>
    <div class="eat-first-host-panel__meta">
      <span class="eat-first-host-panel__label">{{ t('eatFirstCall.gameId') }}</span>
      <code class="eat-first-host-panel__code">{{ gameId || '—' }}</code>
    </div>
    <p class="eat-first-host-panel__role">{{ t('eatFirstCall.hostRoleLine') }}</p>
    <div class="eat-first-host-panel__actions">
      <button type="button" class="eat-first-host-panel__btn" disabled :title="t('eatFirstCall.btnDisabledHint')">
        {{ t('eatFirstCall.btnStartGame') }}
      </button>
      <button type="button" class="eat-first-host-panel__btn" disabled :title="t('eatFirstCall.btnDisabledHint')">
        {{ t('eatFirstCall.btnTimer') }}
      </button>
      <button
        type="button"
        class="eat-first-host-panel__btn eat-first-host-panel__btn--primary"
        :disabled="!gameId.trim()"
        @click="copyOverlayUrl"
      >
        {{ t('eatFirstCall.btnObsHelp') }}
      </button>
      <p v-if="copyHint === 'ok'" class="eat-first-host-panel__hint eat-first-host-panel__hint--ok" role="status">
        {{ t('eatFirstCall.obsCopied') }}
      </p>
      <p v-else-if="copyHint === 'err'" class="eat-first-host-panel__hint eat-first-host-panel__hint--err" role="alert">
        {{ t('eatFirstCall.obsCopyFailed') }}
      </p>
    </div>
  </aside>
</template>

<style scoped>
.eat-first-host-panel {
  pointer-events: auto;
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 45;
  width: min(300px, calc(100vw - 24px));
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(18, 20, 32, 0.92);
  border: 1px solid rgba(255, 200, 120, 0.28);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  color: #f8f6f2;
  font-size: 0.85rem;
}

.eat-first-host-panel__title {
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 8px;
}

.eat-first-host-panel__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.eat-first-host-panel__label {
  opacity: 0.75;
}

.eat-first-host-panel__code {
  font-size: 0.8em;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
}

.eat-first-host-panel__role {
  margin: 0 0 10px;
  opacity: 0.88;
  font-size: 0.82rem;
}

.eat-first-host-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.eat-first-host-panel__btn {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  padding: 8px 10px;
  font-size: 0.82rem;
  cursor: not-allowed;
}

.eat-first-host-panel__btn:disabled {
  opacity: 0.55;
}

.eat-first-host-panel__btn--primary:not(:disabled) {
  cursor: pointer;
  opacity: 1;
  background: rgba(255, 180, 80, 0.22);
  border-color: rgba(255, 200, 120, 0.45);
}

.eat-first-host-panel__btn--primary:disabled {
  cursor: not-allowed;
}

.eat-first-host-panel__hint {
  margin: 0;
  font-size: 0.78rem;
}

.eat-first-host-panel__hint--ok {
  color: #9be7a8;
}

.eat-first-host-panel__hint--err {
  color: #ffb4b4;
}
</style>
