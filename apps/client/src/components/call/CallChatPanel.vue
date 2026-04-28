<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { CallChatLine } from 'call-core'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'

const props = defineProps<{
  open: boolean
  messages: readonly CallChatLine[]
  selfPeerId: string
  panelClass: Record<string, boolean>
  panelStyle?: Record<string, string>
  displayNameForPeer: (peerId: string) => string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  send: [text: string]
  'drag-pointer-down': [event: PointerEvent]
  'resize-pointer-down': [event: PointerEvent]
}>()

const { t } = useI18n()
const chatDraft = ref('')
const chatScrollRef = ref<HTMLElement | null>(null)

function sendChatFromForm(): void {
  const raw = chatDraft.value.trim()
  if (!raw) {
    return
  }
  emit('send', raw)
  chatDraft.value = ''
}

function formatChatTime(at: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(at))
  } catch {
    return ''
  }
}

function isSelfChatLine(line: CallChatLine): boolean {
  return line.peerId === props.selfPeerId
}

watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    const el = chatScrollRef.value
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' })
    }
  },
)
</script>

<template>
  <aside
    class="call-page__chat"
    :class="panelClass"
    :style="panelStyle"
    :aria-label="t('callPage.chatTitle')"
    :aria-hidden="open ? 'false' : 'true'"
  >
    <div class="call-page__chat-head" @pointerdown="emit('drag-pointer-down', $event)">
      <span class="call-page__chat-title">{{ t('callPage.chatTitle') }}</span>
      <button type="button" class="call-page__chat-close" @click="emit('update:open', false)">
        {{ t('callPage.chatClose') }}
      </button>
    </div>
    <div ref="chatScrollRef" class="call-page__chat-scroll sa-scrollbar">
      <ul class="call-page__chat-list" role="list">
        <template v-if="messages.length === 0">
          <li key="chat-empty" class="call-page__chat-li call-page__chat-li--empty">
            {{ t('callPage.chatEmpty') }}
          </li>
        </template>
        <template v-else>
          <li
            v-for="line in messages"
            :key="line.id"
            class="call-page__chat-li"
            :class="{ 'call-page__chat-li--self': isSelfChatLine(line) }"
          >
            <span class="call-page__chat-meta">
              <span class="call-page__chat-name">{{ displayNameForPeer(line.peerId) }}</span>
              <time class="call-page__chat-time" :datetime="String(line.at)">{{ formatChatTime(line.at) }}</time>
            </span>
            <span class="call-page__chat-text">{{ line.text }}</span>
          </li>
        </template>
      </ul>
    </div>
    <form class="call-page__chat-form" @submit.prevent="sendChatFromForm">
      <input
        v-model="chatDraft"
        class="call-page__chat-input"
        type="text"
        maxlength="500"
        autocomplete="off"
        :placeholder="t('callPage.chatPlaceholder')"
      />
      <AppButton type="submit" variant="secondary" class="call-page__chat-send">{{
        t('callPage.chatSend')
      }}</AppButton>
    </form>
    <span
      class="call-page__chat-resize"
      aria-hidden="true"
      @pointerdown="emit('resize-pointer-down', $event)"
    />
  </aside>
</template>
