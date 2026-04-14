<script setup>
import { computed, inject, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ConnectionState } from 'livekit-client'
import { liveKitConfigured } from '../config/livekit.js'
import { useAudioControls } from '../composables/useAudioControls.js'

const props = defineProps({
  lkConnectionState: { type: String, required: true },
  lkError: { type: Object, default: null },
  /** liveKitConfigured && overlayReady && gameId && identity */
  lkRoomEnabled: { type: Boolean, default: false },
  overlayReady: { type: Boolean, default: false },
  /** Чи можна публікувати аудіо/відео (слот гравця, не spectator, не елімінація). */
  canPublish: { type: Boolean, default: false },
  /** Глобальний оверлей без ?player= — лише перегляд. */
  spectatorMode: { type: Boolean, default: false },
  speakerSlot: { type: String, default: '' },
  spotlightUnmuteMode: { type: Boolean, default: false },
  eliminatedLocal: { type: Boolean, default: false },
  localIdentity: { type: String, required: true },
})

const { t } = useI18n()

/** Не передаємо Room через prop — Vue полегковує Ref і ламає useAudioControls. */
const lkRoomRef = inject('liveKitOverlayRoom', null) ?? shallowRef(null)

/** Браузер блокує AudioContext до першого кліку — після успішного startAudio ховаємо CTA. */
const remoteAudioUnlocked = ref(false)

const isDev = import.meta.env.DEV

const configured = computed(() => liveKitConfigured())

const debugSnapshot = computed(() => ({
  configured: configured.value,
  overlayReady: props.overlayReady,
  lkRoomEnabled: props.lkRoomEnabled,
  connectionState: props.lkConnectionState,
  spectatorMode: props.spectatorMode,
  canPublish: props.canPublish,
}))

const statusMain = computed(() => {
  if (!configured.value) return t('overlayPage.liveKit.statusNotConfigured')
  if (!props.overlayReady) return t('overlayPage.liveKit.statusWaitingGame')
  if (props.lkError)
    return t('overlayPage.liveKit.statusError', {
      msg: String(props.lkError.message || props.lkError).slice(0, 120),
    })
  const s = props.lkConnectionState
  if (s === ConnectionState.Connected) return t('overlayPage.liveKit.statusConnected')
  if (s === ConnectionState.Connecting || s === ConnectionState.Reconnecting)
    return t('overlayPage.liveKit.statusConnecting')
  if (s === ConnectionState.Disconnected) return t('overlayPage.liveKit.statusDisconnected')
  return t('overlayPage.liveKit.statusIdle')
})

const statusHint = computed(() => {
  if (!configured.value) return t('overlayPage.liveKit.notConfiguredHint')
  if (!props.overlayReady) return t('overlayPage.liveKit.waitingHint')
  return ''
})

const canPublishRef = computed(() => props.canPublish)

const {
  micEnabled,
  cameraEnabled,
  audioInputDevices,
  audioOutputDevices,
  videoInputDevices,
  refreshDevices,
  setMicEnabled,
  setCameraEnabled,
  setAudioInput,
  setAudioOutput,
  setVideoInput,
} = useAudioControls(lkRoomRef, {
  canControl: canPublishRef,
})

watch(
  () => props.lkConnectionState,
  (s) => {
    if (s !== ConnectionState.Connected) remoteAudioUnlocked.value = false
  },
)

async function unlockRemoteAudio() {
  const r = lkRoomRef.value
  if (!r) return
  try {
    await r.startAudio()
    remoteAudioUnlocked.value = true
  } catch {
    /* NotAllowedError тощо — користувач може натиснути ще раз */
  }
}

/** Будь-який pointerdown на сторінці (лобі / оверлей) — валідний жест для AudioContext. */
let gestureUnlockTeardown = null

function armGestureUnlockIfNeeded() {
  if (typeof window === 'undefined') return
  if (gestureUnlockTeardown) return
  const onGesture = () => {
    void unlockRemoteAudio()
  }
  window.addEventListener('pointerdown', onGesture, { capture: true, passive: true })
  gestureUnlockTeardown = () => {
    window.removeEventListener('pointerdown', onGesture, { capture: true })
    gestureUnlockTeardown = null
  }
}

function disarmGestureUnlock() {
  gestureUnlockTeardown?.()
}

watch(
  () =>
    configured.value &&
    props.overlayReady &&
    !props.lkError &&
    props.lkConnectionState === ConnectionState.Connected &&
    !remoteAudioUnlocked.value,
  (needUnlock) => {
    if (needUnlock) armGestureUnlockIfNeeded()
    else disarmGestureUnlock()
  },
  { flush: 'post' },
)

watch(remoteAudioUnlocked, (unlocked) => {
  if (unlocked) disarmGestureUnlock()
})

onUnmounted(() => {
  disarmGestureUnlock()
})

async function onMicToggle() {
  await unlockRemoteAudio()
  await setMicEnabled(!micEnabled.value)
}

async function onCamToggle() {
  await unlockRemoteAudio()
  await setCameraEnabled(!cameraEnabled.value)
}

watch(
  () => props.eliminatedLocal,
  async (elim) => {
    if (elim && lkRoomRef.value) {
      await setMicEnabled(false).catch(() => {})
      await setCameraEnabled(false).catch(() => {})
    }
  },
)

watch(
  () => [props.spotlightUnmuteMode, props.speakerSlot, props.localIdentity, props.eliminatedLocal, props.canPublish],
  async () => {
    if (!lkRoomRef.value || props.eliminatedLocal || !props.canPublish) return
    if (!props.spotlightUnmuteMode) return
    const sp = String(props.speakerSlot || '').trim()
    const me = String(props.localIdentity || '').trim()
    if (sp && me && me !== sp) {
      await setMicEnabled(false).catch(() => {})
    }
  },
)
</script>

<template>
  <aside class="vvg" aria-label="Voice / video">
    <div class="vvg__head">
      <span class="vvg__status" :class="{ 'vvg__status--bad': !configured || (overlayReady && lkError) }">{{
        statusMain
      }}</span>
    </div>

    <p v-if="statusHint" class="vvg__hint vvg__hint--warn">{{ statusHint }}</p>

    <p v-else-if="overlayReady && configured" class="vvg__hint">{{ t('overlayPage.liveKit.hintControls') }}</p>

    <p v-if="spectatorMode && configured && overlayReady" class="vvg__callout">
      {{ t('overlayPage.liveKit.spectatorHint') }}
    </p>

    <button
      v-if="
        configured &&
        overlayReady &&
        !lkError &&
        lkConnectionState === ConnectionState.Connected &&
        !remoteAudioUnlocked
      "
      type="button"
      class="vvg__btn vvg__btn--primary"
      @click="unlockRemoteAudio"
    >
      {{ t('overlayPage.liveKit.enableSound') }}
    </button>
    <p
      v-if="
        configured &&
        overlayReady &&
        lkConnectionState === ConnectionState.Connected &&
        !remoteAudioUnlocked
      "
      class="vvg__hint"
    >
      {{ t('overlayPage.liveKit.enableSoundHint') }}
    </p>

    <p
      v-if="!spectatorMode && !canPublish && eliminatedLocal && overlayReady && configured"
      class="vvg__callout vvg__callout--muted"
    >
      {{ t('overlayPage.liveKit.eliminatedNoPublish') }}
    </p>

    <details v-if="isDev" class="vvg__debug">
      <summary>{{ t('overlayPage.liveKit.debugSummary') }}</summary>
      <pre class="vvg__pre">{{ JSON.stringify(debugSnapshot, null, 2) }}</pre>
    </details>

    <div v-if="canPublish" class="vvg__ctrl">
      <button
        type="button"
        class="vvg__btn"
        :class="{ 'vvg__btn--off': !micEnabled }"
        @click="onMicToggle"
      >
        {{ micEnabled ? 'Mic on' : 'Mic off' }}
      </button>
      <button
        type="button"
        class="vvg__btn"
        :class="{ 'vvg__btn--off': !cameraEnabled }"
        @click="onCamToggle"
      >
        {{ cameraEnabled ? 'Cam on' : 'Cam off' }}
      </button>
    </div>

    <div v-if="canPublish" class="vvg__devices">
      <label class="vvg__lbl"
        >In
        <select @change="setAudioInput(($event.target).value)">
          <option value="">Default mic</option>
          <option v-for="d in audioInputDevices" :key="d.deviceId" :value="d.deviceId">
            {{ d.label || d.deviceId }}
          </option>
        </select>
      </label>
      <label class="vvg__lbl"
        >Out
        <select @change="setAudioOutput(($event.target).value)">
          <option value="">Default speaker</option>
          <option v-for="d in audioOutputDevices" :key="d.deviceId" :value="d.deviceId">
            {{ d.label || d.deviceId }}
          </option>
        </select>
      </label>
      <label class="vvg__lbl"
        >Cam
        <select @change="setVideoInput(($event.target).value)">
          <option value="">Default camera</option>
          <option v-for="d in videoInputDevices" :key="d.deviceId" :value="d.deviceId">
            {{ d.label || d.deviceId }}
          </option>
        </select>
      </label>
      <button type="button" class="vvg__linkish" @click="refreshDevices()">Refresh devices</button>
    </div>
  </aside>
</template>

<style scoped>
.vvg {
  position: fixed;
  right: 0.6rem;
  bottom: 0.6rem;
  z-index: 60;
  width: min(22rem, 42vw);
  max-height: min(72vh, 28rem);
  overflow: auto;
  padding: 0.5rem;
  border-radius: 12px;
  background: rgba(8, 6, 14, 0.92);
  border: 1px solid rgba(167, 139, 250, 0.28);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  font-size: 0.72rem;
  color: rgba(245, 245, 250, 0.92);
}
.vvg__head {
  margin-bottom: 0.35rem;
  opacity: 0.85;
}
.vvg__status {
  font-variant-numeric: tabular-nums;
}
.vvg__status--bad {
  color: #fda4af;
}
.vvg__hint {
  margin: 0 0 0.4rem;
  opacity: 0.75;
  font-size: 0.65rem;
  line-height: 1.35;
}
.vvg__hint--warn {
  opacity: 0.9;
  color: #fde68a;
}
.vvg__callout {
  margin: 0 0 0.45rem;
  padding: 0.35rem 0.4rem;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(165, 180, 252, 0.35);
  font-size: 0.64rem;
  line-height: 1.4;
  color: rgba(224, 231, 255, 0.95);
}
.vvg__callout--muted {
  background: rgba(55, 48, 74, 0.55);
  border-color: rgba(167, 139, 250, 0.2);
  color: rgba(226, 232, 240, 0.82);
}
.vvg__debug {
  margin: 0 0 0.45rem;
  font-size: 0.6rem;
  opacity: 0.88;
}
.vvg__debug summary {
  cursor: pointer;
  color: #c4b5fd;
}
.vvg__pre {
  margin: 0.35rem 0 0;
  padding: 0.35rem;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.35);
  overflow: auto;
  max-height: 8rem;
  font-size: 0.58rem;
  line-height: 1.35;
}
.vvg__ctrl {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.45rem;
  flex-wrap: wrap;
}
.vvg__btn--primary {
  width: 100%;
  margin: 0.35rem 0 0.25rem;
  flex: none;
  min-width: unset;
  border-color: rgba(167, 139, 250, 0.55);
  background: rgba(124, 58, 237, 0.35);
}
.vvg__btn--primary:hover {
  background: rgba(124, 58, 237, 0.5);
}
.vvg__btn {
  flex: 1;
  min-width: 4.5rem;
  padding: 0.35rem 0.45rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(40, 32, 58, 0.95);
  color: inherit;
  cursor: pointer;
  font-size: 0.68rem;
}
.vvg__btn--off {
  opacity: 0.65;
  border-style: dashed;
}
.vvg__devices {
  margin-top: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.vvg__lbl {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.62rem;
  opacity: 0.9;
}
.vvg__lbl select {
  max-width: 100%;
  font-size: 0.65rem;
  padding: 0.2rem;
  border-radius: 6px;
}
.vvg__linkish {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: #c4b5fd;
  cursor: pointer;
  font-size: 0.62rem;
  text-decoration: underline;
}
</style>
