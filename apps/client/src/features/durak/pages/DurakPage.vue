<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppContainer from '@/components/ui/AppContainer.vue'
import type { DurakGameMode, DurakLobbyView, DurakPlayerCount } from '../core/durakModes'
import DurakGameTableSection from '../components/DurakGameTableSection.vue'
import DurakLobbyPanel from '../components/DurakLobbyPanel.vue'

const { t } = useI18n()

const lobbyView = ref<DurakLobbyView>('lobby')
const playerCount = ref<DurakPlayerCount>(2)
const friendRoomCode = ref('')
const tableSessionKey = ref(0)
const inviteCopied = ref(false)
let copyResetTimer: ReturnType<typeof setTimeout> | null = null

function generateRoomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  }
  return `durak${Date.now().toString(36)}`
}

function mockInviteUrl(code: string): string {
  const path = `/app/durak?room=${encodeURIComponent(code)}`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`
  }
  return path
}

const inviteUrl = computed(() => (friendRoomCode.value ? mockInviteUrl(friendRoomCode.value) : ''))

const pageSubtitle = computed(() => {
  switch (lobbyView.value) {
    case 'lobby':
      return t('durak.lobby.subtitle')
    case 'searching':
      return t('durak.searching.subtitle')
    case 'friend-room':
      return t('durak.friendRoom.subtitle')
    case 'demo-table':
    default:
      return t('durak.localPrototype')
  }
})

function onPickMode(mode: DurakGameMode) {
  if (mode === 'matchmaking') {
    lobbyView.value = 'searching'
    return
  }
  if (mode === 'friend') {
    friendRoomCode.value = generateRoomToken()
    lobbyView.value = 'friend-room'
    return
  }
  tableSessionKey.value += 1
  lobbyView.value = 'demo-table'
}

function backToLobby() {
  lobbyView.value = 'lobby'
  friendRoomCode.value = ''
  inviteCopied.value = false
  if (copyResetTimer) {
    clearTimeout(copyResetTimer)
    copyResetTimer = null
  }
}

async function copyInvite() {
  const text = inviteUrl.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    inviteCopied.value = true
    if (copyResetTimer) clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => {
      inviteCopied.value = false
      copyResetTimer = null
    }, 2000)
  } catch {
    inviteCopied.value = false
  }
}

onUnmounted(() => {
  if (copyResetTimer) clearTimeout(copyResetTimer)
})
</script>

<template>
  <div class="durak-page">
    <AppContainer wide flush class="durak-page__container">
      <header class="durak-page__header">
        <h1 class="durak-page__title">{{ t('routes.durak') }}</h1>
        <p class="durak-page__subtitle">{{ pageSubtitle }}</p>
      </header>

      <DurakLobbyPanel
        v-if="lobbyView === 'lobby'"
        v-model="playerCount"
        class="durak-page__lobby"
        @pick-mode="onPickMode"
      />

      <div v-else-if="lobbyView === 'searching'" class="durak-page__subview">
        <AppCard class="durak-page__subcard">
          <h2 class="durak-page__subheading">{{ t('durak.searching.title') }}</h2>
          <p class="durak-page__subtext">{{ t('durak.searching.body') }}</p>
          <p class="durak-page__subhint">{{ t('durak.searching.mockHint') }}</p>
          <AppButton variant="ghost" class="durak-page__subcta" @click="backToLobby">
            {{ t('durak.searching.cancel') }}
          </AppButton>
        </AppCard>
      </div>

      <div v-else-if="lobbyView === 'friend-room'" class="durak-page__subview">
        <AppCard class="durak-page__subcard">
          <h2 class="durak-page__subheading">{{ t('durak.friendRoom.title') }}</h2>
          <p class="durak-page__subtext">{{ t('durak.friendRoom.body') }}</p>
          <p class="durak-page__invite-label">{{ t('durak.friendRoom.inviteLabel') }}</p>
          <code class="durak-page__invite-url">{{ inviteUrl }}</code>
          <div class="durak-page__invite-actions">
            <AppButton variant="primary" @click="copyInvite">{{ t('durak.friendRoom.copy') }}</AppButton>
            <span v-if="inviteCopied" class="durak-page__copied" role="status">{{ t('durak.friendRoom.copied') }}</span>
          </div>
          <AppButton variant="ghost" class="durak-page__subcta" @click="backToLobby">
            {{ t('durak.friendRoom.back') }}
          </AppButton>
        </AppCard>
      </div>

      <DurakGameTableSection
        v-else-if="lobbyView === 'demo-table'"
        :key="tableSessionKey"
        class="durak-page__table"
        :roster-player-count="playerCount"
        @back="backToLobby"
      />
    </AppContainer>
  </div>
</template>

<style scoped>
.durak-page {
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  background: radial-gradient(120% 80% at 50% 0%, #1e1b4b 0%, #0f172a 42%, #020617 100%);
  color: var(--sa-color-text-main, #f1f5f9);
}

.durak-page__container {
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-4, 1rem);
  padding-bottom: var(--sa-space-6, 1.5rem);
}

.durak-page__header {
  text-align: center;
  padding-top: var(--sa-space-2, 0.5rem);
}

.durak-page__title {
  margin: 0;
  font-size: clamp(1.35rem, 2.5vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(90deg, #e2e8f0, #a5b4fc);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.durak-page__subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.65);
}

.durak-page__lobby {
  max-width: 40rem;
  margin: 0 auto;
  width: 100%;
}

.durak-page__subview {
  max-width: 32rem;
  margin: 0 auto;
  width: 100%;
  min-width: 0;
}

.durak-page__subcard {
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-3, 0.75rem);
  align-items: flex-start;
}

.durak-page__subheading {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--sa-color-text-main, #f1f5f9);
}

.durak-page__subtext {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: rgba(226, 232, 240, 0.78);
}

.durak-page__subhint {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.4;
  color: rgba(251, 191, 36, 0.85);
}

.durak-page__invite-label {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(167, 243, 208, 0.9);
}

.durak-page__invite-url {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.65rem;
  border-radius: var(--sa-radius-md, 10px);
  background: color-mix(in srgb, #0f172a 88%, transparent);
  border: 1px solid rgba(148, 163, 184, 0.22);
  font-size: 0.72rem;
  word-break: break-all;
  color: #e2e8f0;
}

.durak-page__invite-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}

.durak-page__copied {
  font-size: 0.8rem;
  color: #6ee7b7;
}

.durak-page__subcta {
  margin-top: 0.25rem;
}

.durak-page__table {
  min-width: 0;
}
</style>
