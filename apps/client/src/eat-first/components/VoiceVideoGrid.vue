<script setup>
import { computed, inject, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
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

/** Mediasoup / call-core: provide з OverlayPage (`useEatOverlayMediasoup`). */
const eatVoice = inject('eatOverlayVoiceUi', null)

/** Браузер блокує AudioContext до першого кліку — після unlock ховаємо CTA. */
const remoteAudioUnlocked = ref(false)

const isDev = import.meta.env.DEV

const configured = computed(() => Boolean(eatVoice?.configured))

const isMediaConnected = computed(() => eatVoice?.connectionState === 'connected')

const debugSnapshot = computed(() => ({
  transport: 'mediasoup',
  configured: configured.value,
  overlayReady: props.overlayReady,
  connectionState: eatVoice?.connectionState,
  spectatorMode: props.spectatorMode,
  canPublish: props.canPublish,
}))

const statusMain = computed(() => {
  if (!eatVoice)
    return t('overlayPage.voiceMedia.statusNotWired')
  if (!eatVoice.configured) return t('overlayPage.voiceMedia.statusNotConfigured')
  if (!props.overlayReady) return t('overlayPage.voiceMedia.statusWaitingGame')
  if (eatVoice.joinError)
    return t('overlayPage.voiceMedia.statusError', {
      msg: String(eatVoice.joinError).slice(0, 120),
    })
  switch (eatVoice.connectionState) {
    case 'connected':
      return t('overlayPage.voiceMedia.statusConnected')
    case 'connecting':
      return t('overlayPage.voiceMedia.statusConnecting')
    case 'error':
      return t('overlayPage.voiceMedia.statusDisconnected')
    default:
      return t('overlayPage.voiceMedia.statusIdle')
  }
})

const statusHint = computed(() => {
  if (!eatVoice) return ''
  if (!configured.value) return t('overlayPage.voiceMedia.notConfiguredHint')
  if (!props.overlayReady) return t('overlayPage.voiceMedia.waitingHint')
  return ''
})

const micEnabled = computed(() => Boolean(eatVoice?.micEnabled))
const cameraEnabled = computed(() => Boolean(eatVoice?.camEnabled))

watch(
  () => eatVoice?.connectionState,
  (s) => {
    if (s !== 'connected') remoteAudioUnlocked.value = false
  },
)

async function unlockRemoteAudio() {
  if (!eatVoice) return
  try {
    eatVoice.unlockAudio()
    remoteAudioUnlocked.value = true
  } catch {
    /* */
  }
}

/** Будь-який pointerdown на сторінці — валідний жест для AudioContext. */
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
  () => {
    if (!eatVoice || !configured.value || !props.overlayReady || remoteAudioUnlocked.value)
      return false
    return eatVoice.connectionState === 'connected' && !eatVoice.joinError
  },
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

async function msSetMic(on) {
  if (!eatVoice) return
  const cur = eatVoice.micEnabled
  if (Boolean(on) !== Boolean(cur)) eatVoice.toggleMic()
}

async function msSetCam(on) {
  if (!eatVoice) return
  const cur = eatVoice.camEnabled
  if (Boolean(on) !== Boolean(cur)) eatVoice.toggleCam()
}

async function onMicToggle() {
  await unlockRemoteAudio()
  await msSetMic(!micEnabled.value)
}

async function onCamToggle() {
  await unlockRemoteAudio()
  await msSetCam(!cameraEnabled.value)
}

watch(
  () => props.eliminatedLocal,
  async (elim) => {
    if (!elim) return
    await msSetMic(false).catch(() => {})
    await msSetCam(false).catch(() => {})
  },
)

watch(
  () => [props.spotlightUnmuteMode, props.speakerSlot, props.localIdentity, props.eliminatedLocal, props.canPublish],
  async () => {
    if (props.eliminatedLocal || !props.canPublish) return
    if (!props.spotlightUnmuteMode) return
    const sp = String(props.speakerSlot || '').trim()
    const me = String(props.localIdentity || '').trim()
    if (sp && me && me !== sp) {
      await msSetMic(false).catch(() => {})
    }
  },
)
</script>

<template>
  <aside class="vvg" :aria-label="t('overlayPage.voiceMedia.sectionAria')">
    <div class="vvg__head">
      <span
        class="vvg__status"
        :class="{
          'vvg__status--bad':
            !eatVoice ||
            !configured ||
            (overlayReady && eatVoice && (eatVoice.joinError || eatVoice.connectionState === 'error')),
        }"
        >{{ statusMain }}</span
      >
    </div>

    <p v-if="statusHint" class="vvg__hint vvg__hint--warn">{{ statusHint }}</p>

    <p v-else-if="overlayReady && configured && eatVoice" class="vvg__hint">{{
      t('overlayPage.voiceMedia.hintControls')
    }}</p>

    <p v-if="spectatorMode && configured && overlayReady && eatVoice" class="vvg__callout">
      {{ t('overlayPage.voiceMedia.spectatorHint') }}
    </p>

    <button
      v-if="eatVoice && configured && overlayReady && !eatVoice.joinError && isMediaConnected && !remoteAudioUnlocked"
      type="button"
      class="vvg__btn vvg__btn--primary"
      @click="unlockRemoteAudio"
    >
      {{ t('overlayPage.voiceMedia.enableSound') }}
    </button>
    <p
      v-if="eatVoice && configured && overlayReady && isMediaConnected && !remoteAudioUnlocked"
      class="vvg__hint"
    >
      {{ t('overlayPage.voiceMedia.enableSoundHint') }}
    </p>

    <p
      v-if="!spectatorMode && !canPublish && eliminatedLocal && overlayReady && configured"
      class="vvg__callout vvg__callout--muted"
    >
      {{ t('overlayPage.voiceMedia.eliminatedNoPublish') }}
    </p>

    <details v-if="isDev" class="vvg__debug">
      <summary>{{ t('overlayPage.voiceMedia.debugSummary') }}</summary>
      <pre class="vvg__pre">{{ JSON.stringify(debugSnapshot, null, 2) }}</pre>
    </details>

    <div v-if="canPublish && eatVoice" class="vvg__ctrl">
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
</style>
