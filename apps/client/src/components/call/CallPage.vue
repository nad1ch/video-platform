<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useCallEngine } from 'call-core'
import ParticipantTile from './ParticipantTile.vue'
import AppContainer from '@/components/ui/AppContainer.vue'
import AppButton from '@/components/ui/AppButton.vue'

const { t } = useI18n()

const {
  session,
  joining,
  joinError,
  joinCall,
  leaveCall,
  tiles,
  sizeTier,
  gridModifier,
  activeSpeakerPeerId,
  micEnabled,
  camEnabled,
  toggleMic,
  toggleCam,
  wsStatus,
} = useCallEngine()
</script>

<template>
  <div class="page-route">
    <AppContainer class="call-page" :class="{ 'call-page--prejoin': !session.inCall }">
    <div class="call-page__shell">
      <header class="call-page__header">
        <h1 class="call-page__title">{{ t('callPage.title') }}</h1>
        <p v-if="!session.inCall" class="call-page__hint">
          {{ t('callPage.hintPrejoin') }}
        </p>
      </header>

      <section v-if="!session.inCall" class="call-page__pre">
        <label class="call-page__field">
          <span>{{ t('callPage.fieldRoom') }}</span>
          <input
            v-model="session.roomId"
            type="text"
            autocomplete="off"
            :placeholder="t('callPage.placeholderRoom')"
          />
        </label>
        <label class="call-page__field">
          <span>{{ t('callPage.fieldName') }}</span>
          <input
            v-model="session.selfDisplayName"
            type="text"
            autocomplete="name"
            :placeholder="t('callPage.placeholderName')"
          />
        </label>
        <p v-if="joinError" class="call-page__error" role="alert">{{ joinError }}</p>
        <p class="call-page__meta">{{ t('callPage.wsStatus', { status: wsStatus }) }}</p>
        <AppButton variant="primary" :disabled="joining" @click="joinCall">
          {{ joining ? t('callPage.joining') : t('callPage.join') }}
        </AppButton>
      </section>

      <section v-else class="call-page__active">
        <div class="call-page__toolbar">
          <AppButton variant="secondary" @click="leaveCall">{{ t('callPage.leave') }}</AppButton>
          <AppButton
            variant="secondary"
            :class="{ 'call-page__btn--muted': !micEnabled }"
            @click="toggleMic"
          >
            {{ micEnabled ? t('callPage.muteMic') : t('callPage.unmute') }}
          </AppButton>
          <AppButton
            variant="secondary"
            :class="{ 'call-page__btn--muted': !camEnabled }"
            @click="toggleCam"
          >
            {{ camEnabled ? t('callPage.cameraOff') : t('callPage.cameraOn') }}
          </AppButton>
        </div>

        <div class="call-page__grid" :class="gridModifier">
          <ParticipantTile
            v-for="t in tiles"
            :key="t.peerId"
            :display-name="t.displayName"
            :stream="t.stream"
            :is-local="t.isLocal"
            :video-enabled="t.videoEnabled"
            :audio-enabled="t.audioEnabled"
            :play-rev="t.playRev"
            :size-tier="sizeTier"
            :active-speaker="activeSpeakerPeerId === t.peerId"
          />
        </div>
      </section>
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

.call-page {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: var(--sa-color-bg-main);
  color: var(--sa-color-text-body);
  padding-block: 0 var(--sa-space-6);
}

.call-page__shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 1rem 1.25rem 2rem;
  box-sizing: border-box;
}

.call-page--prejoin .call-page__shell {
  justify-content: center;
  align-items: center;
}

.call-page__header {
  margin-bottom: 1rem;
  width: 100%;
}

.call-page--prejoin .call-page__header {
  text-align: center;
  max-width: 420px;
  margin-bottom: 1.5rem;
}

.call-page__title {
  margin: 0 0 0.35rem;
  font-family: var(--sa-font-display);
  font-size: 1.35rem;
  color: var(--sa-color-text-main);
}

.call-page__hint {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.85;
}

.call-page__pre {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 420px;
}

.call-page__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}

.call-page__field input {
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--sa-color-border);
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-surface) 88%, transparent);
  color: var(--sa-color-text-main);
  font: inherit;
}

.call-page__error {
  margin: 0;
  color: #f87171;
  font-size: 0.9rem;
}

.call-page__meta {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.7;
  font-family: var(--sa-font-mono, monospace);
}

.call-page__btn--muted {
  opacity: 0.75;
}

.call-page__active {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  width: 100%;
}

.call-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.call-page__grid {
  display: grid;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
  align-content: start;
}

.call-page__grid--1 {
  grid-template-columns: 1fr;
  max-width: 920px;
  margin: 0 auto;
  width: 100%;
}

.call-page__grid--4 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.call-page__grid--9 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.call-page__grid--12 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 720px) {
  .call-page__grid--4,
  .call-page__grid--9,
  .call-page__grid--12 {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 721px) and (max-width: 1100px) {
  .call-page__grid--9,
  .call-page__grid--12 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
