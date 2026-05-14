<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CallChatInboundToast } from '@/composables/game-room/useCallChatInboundToasts'

/**
 * Block 28 — presentational shell for the chat-inbound-toast stack.
 * The wrapping `<div class="call-page__chat-toasts">` +
 * `<TransitionGroup name="call-chat-toast">` skeleton was
 * byte-identical between `CallPage.vue` and
 * `GameTemplateCallPage.vue`; the toast data + dismiss / open-chat
 * helpers are owned by `useCallChatInboundToasts` (Block 25).
 *
 * CSS classes preserved verbatim against `CallPage.css`:
 *   - `.call-page__chat-toasts`
 *   - `.call-page__chat-toasts-stack`
 *   - `.call-page__chat-toast`
 *   - `.call-page__chat-toast-main`
 *   - `.call-page__chat-toast-title`
 *   - `.call-page__chat-toast-preview`
 *   - `.call-page__chat-toast-dismiss`
 *
 * The page wraps this component with its own route-specific `v-if`
 * (`session.inCall && !isViewMode && toasts.length > 0`).
 */

defineProps<{
  toasts: readonly CallChatInboundToast[]
}>()

const emit = defineEmits<{
  (e: 'open', toastId: string): void
  (e: 'dismiss', toastId: string): void
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="call-page__chat-toasts"
    role="region"
    :aria-label="t('callPage.chatInboundToastAria')"
  >
    <TransitionGroup
      name="call-chat-toast"
      tag="div"
      class="call-page__chat-toasts-stack"
      aria-live="polite"
    >
      <div
        v-for="row in toasts"
        :key="row.toastId"
        class="call-page__chat-toast"
        role="article"
      >
        <button
          type="button"
          class="call-page__chat-toast-main"
          :aria-label="t('callPage.chatInboundToastOpenChat')"
          @click="emit('open', row.toastId)"
        >
          <span class="call-page__chat-toast-title">{{ row.title }}</span>
          <span class="call-page__chat-toast-preview">{{ row.preview }}</span>
        </button>
        <button
          type="button"
          class="call-page__chat-toast-dismiss"
          :aria-label="t('callPage.chatInboundToastDismiss')"
          @click.stop="emit('dismiss', row.toastId)"
        >
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
