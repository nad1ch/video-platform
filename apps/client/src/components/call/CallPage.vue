<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useCallEngine,
  VIDEO_QUALITY_PRESETS,
  type InboundVideoDebugRow,
  type VideoQualityPreset,
} from 'call-core'
import { useAuth } from '@/composables/useAuth'
import ParticipantTile from './ParticipantTile.vue'
import AppContainer from '@/components/ui/AppContainer.vue'
import AppButton from '@/components/ui/AppButton.vue'

type VideoQualityUiChoice = 'auto' | VideoQualityPreset

const { t } = useI18n()
const { user, ensureAuthLoaded, isAdmin } = useAuth()

/** Manual video quality: backend `role === 'admin'` (see ADMIN_EMAILS / ADMIN_TWITCH_IDS on server). */
const allowManualVideoQuality = computed(() => isAdmin.value)

/** Debug overlay UI: admins always; in dev also local engineers (no secret in URL). */
const showCallDebugControls = computed(() => isAdmin.value || import.meta.env.DEV)

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
  callDebugSnapshot,
  refreshInboundVideoDebugStats,
  callPresenceMessages,
  setRemoteListenVolume,
  setRemoteListenMuted,
} = useCallEngine({ allowManualVideoQuality })

const videoQualityChoice = computed({
  get(): VideoQualityUiChoice {
    return session.videoQualityExplicit ? session.videoQualityPreset : 'auto'
  },
  set(v: VideoQualityUiChoice) {
    if (v === 'auto') {
      session.setVideoQualityImplicitDefault()
    } else {
      session.setVideoQualityPreset(v)
    }
  },
})

const callDebugOverlay = computed({
  get: () => session.callDebugOverlay,
  set: (v: boolean) => session.setCallDebugOverlay(v),
})

const qualityPresets = VIDEO_QUALITY_PRESETS

const inboundDebugRows = ref<InboundVideoDebugRow[]>([])
const inboundDebugBusy = ref(false)

async function refreshInboundDebug(): Promise<void> {
  inboundDebugBusy.value = true
  try {
    inboundDebugRows.value = await refreshInboundVideoDebugStats()
  } finally {
    inboundDebugBusy.value = false
  }
}

onMounted(() => {
  void (async () => {
    await ensureAuthLoaded()
    const authName = user.value?.displayName?.trim()
    const cur = String(session.selfDisplayName ?? '').trim()
    if (authName && (!cur || cur === 'You')) {
      session.selfDisplayName = authName
    }
  })()
  try {
    const q = new URLSearchParams(window.location.search).get('callDebug')
    if (q === '1' || q === 'true') {
      session.setCallDebugOverlay(true)
    }
  } catch {
    /* ignore */
  }
})
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
        <fieldset v-if="allowManualVideoQuality" class="call-page__fieldset">
          <legend class="call-page__legend">{{ t('callPage.qualityPreset') }}</legend>
          <p class="call-page__hint call-page__hint--small">{{ t('callPage.qualityAdminHint') }}</p>
          <div class="call-page__preset-row">
            <label class="call-page__preset">
              <input v-model="videoQualityChoice" type="radio" name="video-quality" value="auto" />
              <span>{{ t('callPage.quality.auto') }}</span>
            </label>
            <label
              v-for="p in qualityPresets"
              :key="p"
              class="call-page__preset"
            >
              <input v-model="videoQualityChoice" type="radio" name="video-quality" :value="p" />
              <span>{{ t(`callPage.quality.${p}`) }}</span>
            </label>
          </div>
        </fieldset>
        <label v-if="showCallDebugControls" class="call-page__check">
          <input v-model="callDebugOverlay" type="checkbox" />
          <span>{{ t('callPage.debugOverlay') }}</span>
        </label>
        <p v-if="joinError" class="call-page__error" role="alert">{{ joinError }}</p>
        <p class="call-page__meta">{{ t('callPage.wsStatus', { status: wsStatus }) }}</p>
        <AppButton variant="primary" :disabled="joining" @click="joinCall">
          {{ joining ? t('callPage.joining') : t('callPage.join') }}
        </AppButton>
      </section>

      <section v-else class="call-page__active">
        <ul v-if="callPresenceMessages.length" class="call-page__presence" aria-live="polite">
          <li v-for="m in callPresenceMessages" :key="m.id" class="call-page__presence-li">
            <template v-if="m.kind === 'join'">{{ t('callPage.presenceJoined', { name: m.displayName }) }}</template>
            <template v-else>{{ t('callPage.presenceLeft', { name: m.displayName }) }}</template>
          </li>
        </ul>
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
            v-for="tile in tiles"
            :key="tile.peerId"
            :display-name="tile.displayName"
            :stream="tile.stream"
            :is-local="tile.isLocal"
            :video-enabled="tile.videoEnabled"
            :audio-enabled="tile.audioEnabled"
            :play-rev="tile.playRev"
            :size-tier="sizeTier"
            :active-speaker="activeSpeakerPeerId === tile.peerId"
            :remote-listen-volume="tile.remoteListenVolume"
            :remote-listen-muted="tile.remoteListenMuted"
            @update:listen-volume="setRemoteListenVolume(tile.peerId, $event)"
            @update:listen-muted="setRemoteListenMuted(tile.peerId, $event)"
          />
        </div>

        <aside
          v-if="session.callDebugOverlay && showCallDebugControls"
          class="call-page__debug"
          aria-label="Call debug"
        >
          <div class="call-page__debug-head">
            <span class="call-page__debug-title">{{ t('callPage.debugTitle') }}</span>
            <AppButton variant="secondary" :disabled="inboundDebugBusy" @click="refreshInboundDebug">
              {{ inboundDebugBusy ? t('callPage.debugRefreshing') : t('callPage.debugRefresh') }}
            </AppButton>
          </div>
          <dl class="call-page__debug-dl">
            <dt>preset</dt>
            <dd>{{ callDebugSnapshot.videoQualityPreset }}</dd>
            <dt>explicit</dt>
            <dd>{{ callDebugSnapshot.videoQualityExplicit }}</dd>
            <dt>publish tier</dt>
            <dd>{{ callDebugSnapshot.videoPublishTier }}</dd>
            <dt>active cameras @ wire</dt>
            <dd>{{ callDebugSnapshot.activeCameraPublishersAtWire }}</dd>
            <dt>peers @ wire</dt>
            <dd>{{ callDebugSnapshot.peerCountAtWire }}</dd>
            <dt>publish simulcast</dt>
            <dd>{{ callDebugSnapshot.publishSimulcast }}</dd>
            <dt>active speaker</dt>
            <dd>{{ callDebugSnapshot.activeSpeakerPeerId ?? '—' }}</dd>
          </dl>
          <ul v-if="inboundDebugRows.length" class="call-page__debug-list">
            <li v-for="row in inboundDebugRows" :key="row.producerId" class="call-page__debug-li">
              <span class="call-page__debug-peer">{{ row.peerId.slice(0, 8) }}…</span>
              {{ row.frameWidth ?? '?' }}×{{ row.frameHeight ?? '?' }}
              <span v-if="row.framesPerSecond != null" class="call-page__debug-fps"> ~{{ row.framesPerSecond.toFixed(1) }} fps</span>
              <span class="call-page__debug-loss"> loss {{ row.packetsLost ?? '—' }}</span>
            </li>
          </ul>
        </aside>
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

.call-page__hint--small {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  opacity: 0.8;
}

.call-page__presence {
  list-style: none;
  margin: 0 0 0.75rem;
  padding: 0;
  font-size: 0.8rem;
  color: var(--sa-color-text-muted, #9ca3af);
}

.call-page__presence-li {
  padding: 0.15rem 0;
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

.call-page__fieldset {
  margin: 0;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--sa-color-border);
  border-radius: var(--sa-radius-sm);
}

.call-page__legend {
  padding: 0 0.25rem;
  font-size: 0.9rem;
}

.call-page__preset-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.call-page__preset {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  cursor: pointer;
}

.call-page__check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  cursor: pointer;
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
  position: relative;
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

.call-page__debug {
  position: fixed;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 50;
  max-width: min(420px, calc(100vw - 1.5rem));
  padding: 0.65rem 0.75rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-bg-main) 92%, #000);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
  font-size: 0.75rem;
  font-family: var(--sa-font-mono, ui-monospace, monospace);
}

.call-page__debug-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.call-page__debug-title {
  font-weight: 700;
  color: var(--sa-color-text-main);
}

.call-page__debug-dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.15rem 0.65rem;
  margin: 0 0 0.5rem;
}

.call-page__debug-dl dt {
  margin: 0;
  opacity: 0.75;
}

.call-page__debug-dl dd {
  margin: 0;
}

.call-page__debug-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.call-page__debug-li {
  margin-top: 0.25rem;
  padding-top: 0.25rem;
  border-top: 1px solid var(--sa-color-border);
}

.call-page__debug-peer {
  font-weight: 600;
  margin-right: 0.35rem;
}

.call-page__debug-fps,
.call-page__debug-loss {
  opacity: 0.85;
}
</style>
