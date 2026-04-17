<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import type { CallChatLine } from 'call-core'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import {
  buildCallParticipantMap,
  buildDisplayNameUiMap,
  normalizeDisplayName,
  resolvePeerDisplayNameForUi,
  useCallOrchestrator,
  VIDEO_QUALITY_PRESETS,
  type InboundVideoDebugRow,
  type VideoQualityPreset,
} from 'call-core'
import { useAuth } from '@/composables/useAuth'
import { createLogger } from '@/utils/logger'

const callPageLog = createLogger('call-page')
import ParticipantTile from './ParticipantTile.vue'
import AppContainer from '@/components/ui/AppContainer.vue'
import AppButton from '@/components/ui/AppButton.vue'

type VideoQualityUiChoice = 'auto' | VideoQualityPreset

const { t } = useI18n()
const route = useRoute()
const { user, ensureAuthLoaded, isAdmin } = useAuth()

const CALL_ROUTE_HTML_CLASS = 'sa-call-route'

watch(
  () => route.name === 'call',
  (onCall) => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle(CALL_ROUTE_HTML_CLASS, onCall)
  },
  { immediate: true },
)

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
  activeSpeakerPeerId,
  micEnabled,
  camEnabled,
  toggleMic,
  toggleCam,
  audioInputDevices,
  videoInputDevices,
  refreshMediaDevices,
  localAudioInputDeviceId,
  localVideoInputDeviceId,
  setCallAudioInputDevice,
  setCallVideoInputDevice,
  wsStatus,
  callDebugSnapshot,
  refreshInboundVideoDebugStats,
  callPresenceMessages,
  setRemoteListenVolume,
  setRemoteListenMuted,
  callChatMessages,
  sendChatMessage,
  handRaised,
  toggleRaiseHand,
  screenSharing,
  toggleScreenShare,
} = useCallOrchestrator({ allowManualVideoQuality })

const { selfPeerId, selfDisplayName, remoteDisplayNames } = storeToRefs(session)

/** SSOT for call UI names: tiles + remote-only peers (see `buildCallParticipantMap`). */
const participantsByPeerId = computed(() =>
  buildCallParticipantMap(tiles.value, { ...remoteDisplayNames.value }, selfPeerId.value),
)

/** Precomputed labels per known peer — avoids N× `resolvePeerDisplayNameForUi` on unrelated re-renders (large grids). */
const displayNameUiByPeerId = computed(() =>
  buildDisplayNameUiMap(participantsByPeerId.value, {
    selfPeerId: selfPeerId.value,
    selfDisplayName: selfDisplayName.value,
  }),
)

/** Single resolver: cache hit for peers in map; fallback for chat lines whose peer left the map. */
function peerDisplayName(peerId: string): string {
  const participants = participantsByPeerId.value
  const opts = {
    selfPeerId: selfPeerId.value,
    selfDisplayName: selfDisplayName.value,
  }
  const hit = displayNameUiByPeerId.value.get(peerId)
  if (hit !== undefined) {
    return hit
  }
  return resolvePeerDisplayNameForUi(peerId, participants, opts)
}

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

type CallToast = { id: string; text: string; kind: 'join' | 'leave' }
const callToasts = ref<CallToast[]>([])
let lastPresenceToastSourceId = ''

watch(
  callPresenceMessages,
  (msgs) => {
    const last = msgs[msgs.length - 1]
    if (!last || last.id === lastPresenceToastSourceId) {
      return
    }
    lastPresenceToastSourceId = last.id
    /** Snapshot from engine at event time (stable for leave toasts if map updates before toast). */
    const name = last.displayName
    const text =
      last.kind === 'join'
        ? t('callPage.presenceJoined', { name })
        : t('callPage.presenceLeft', { name })
    const id = `toast-${last.id}`
    callToasts.value = [...callToasts.value, { id, text, kind: last.kind }]
    window.setTimeout(() => {
      callToasts.value = callToasts.value.filter((x) => x.id !== id)
    }, 4200)
  },
  { deep: true },
)

const chatOpen = ref(false)
const chatDraft = ref('')
const chatScrollRef = ref<HTMLElement | null>(null)

const micPickerOpen = ref(false)
const camPickerOpen = ref(false)
const micSplitRef = ref<HTMLElement | null>(null)
const camSplitRef = ref<HTMLElement | null>(null)

const showMediaDevicePickers = computed(
  () => session.inCall && (audioInputDevices.value.length > 0 || videoInputDevices.value.length > 0),
)

function closeMediaDevicePickers(): void {
  micPickerOpen.value = false
  camPickerOpen.value = false
}

function onDocumentPointerForDevicePickers(ev: PointerEvent): void {
  if (!micPickerOpen.value && !camPickerOpen.value) {
    return
  }
  const t = ev.target
  if (!(t instanceof Node)) {
    return
  }
  if (micSplitRef.value?.contains(t) || camSplitRef.value?.contains(t)) {
    return
  }
  closeMediaDevicePickers()
}

async function pickAudioInput(deviceId: string): Promise<void> {
  closeMediaDevicePickers()
  try {
    await setCallAudioInputDevice(deviceId)
  } catch (err) {
    callPageLog.warn('audio input', err)
  }
}

async function pickVideoInput(deviceId: string): Promise<void> {
  closeMediaDevicePickers()
  try {
    await setCallVideoInputDevice(deviceId)
  } catch (err) {
    callPageLog.warn('video input', err)
  }
}

function chatOpenPrefKey(): string {
  const r = typeof session.roomId === 'string' ? session.roomId.trim() : String(session.roomId ?? '')
  return `streamassist_call_chat_open:${r || 'demo'}`
}

watch(chatOpen, (open) => {
  if (!session.inCall) {
    return
  }
  try {
    sessionStorage.setItem(chatOpenPrefKey(), open ? '1' : '0')
  } catch {
    /* private mode */
  }
})

watch(
  () => [session.inCall, session.roomId] as const,
  ([inCall]) => {
    if (!inCall) {
      chatOpen.value = false
      return
    }
    queueMicrotask(() => {
      try {
        if (sessionStorage.getItem(chatOpenPrefKey()) === '1') {
          chatOpen.value = true
        }
      } catch {
        /* ignore */
      }
    })
  },
)

watch(
  () => callChatMessages.value.length,
  async () => {
    await nextTick()
    const el = chatScrollRef.value
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' })
    }
  },
)

function sendChatFromForm(): void {
  const raw = chatDraft.value.trim()
  if (!raw) {
    return
  }
  sendChatMessage(raw)
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
  return line.peerId === selfPeerId.value
}

async function refreshInboundDebug(): Promise<void> {
  inboundDebugBusy.value = true
  try {
    inboundDebugRows.value = await refreshInboundVideoDebugStats()
  } finally {
    inboundDebugBusy.value = false
  }
}

/** Local display order (peer ids); does not affect signaling / mediasoup. */
const tileOrder = ref<string[]>([])
const dragPeerId = ref<string | null>(null)
const dragOverPeerId = ref<string | null>(null)

watch(
  tiles,
  (list) => {
    const ids = list.map((t) => t.peerId)
    const prev = tileOrder.value
    const next: string[] = []
    for (const id of prev) {
      if (ids.includes(id)) {
        next.push(id)
      }
    }
    for (const id of ids) {
      if (!next.includes(id)) {
        next.push(id)
      }
    }
    tileOrder.value = next
  },
  { immediate: true, flush: 'post' },
)

const orderedTiles = computed(() => {
  const map = new Map(tiles.value.map((t) => [t.peerId, t]))
  const order = tileOrder.value.filter((id) => map.has(id))
  for (const t of tiles.value) {
    if (!order.includes(t.peerId)) {
      order.push(t.peerId)
    }
  }
  return order.map((id) => map.get(id)!).filter(Boolean)
})

/** One name-resolution pass per grid row when order/tiles/participants change (large grids). */
const orderedGridRows = computed(() => {
  const participants = participantsByPeerId.value
  const opts = {
    selfPeerId: selfPeerId.value,
    selfDisplayName: selfDisplayName.value,
  }
  const names = displayNameUiByPeerId.value
  return orderedTiles.value.map((tile) => ({
    tile,
    displayName:
      names.get(tile.peerId) ??
      resolvePeerDisplayNameForUi(tile.peerId, participants, opts),
  }))
})

const callGridModifier = computed(() => {
  const n = orderedTiles.value.length
  if (n <= 1) {
    return 'call-page__grid--1'
  }
  if (n === 2) {
    return 'call-page__grid--2'
  }
  if (n <= 4) {
    return 'call-page__grid--4'
  }
  if (n <= 9) {
    return 'call-page__grid--9'
  }
  return 'call-page__grid--12'
})

/** Повна ширина вьюпорта для сітки тільки коли хоча б один учасник з увімкненим відео. */
const stageFullBleed = computed(() => session.inCall && tiles.value.some((t) => t.videoEnabled))

function onTileDragStart(e: DragEvent, peerId: string): void {
  dragPeerId.value = peerId
  e.dataTransfer?.setData('text/plain', peerId)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

function onTileDragOver(e: DragEvent, peerId: string): void {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOverPeerId.value = peerId
}

function onTileDragLeave(peerId: string): void {
  if (dragOverPeerId.value === peerId) {
    dragOverPeerId.value = null
  }
}

function onTileDrop(peerId: string): void {
  const from = dragPeerId.value
  dragPeerId.value = null
  dragOverPeerId.value = null
  if (!from || from === peerId) {
    return
  }
  const order = [...tileOrder.value]
  const fi = order.indexOf(from)
  const ti = order.indexOf(peerId)
  if (fi === -1 || ti === -1) {
    return
  }
  order.splice(fi, 1)
  order.splice(ti, 0, from)
  tileOrder.value = order
}

function onTileDragEnd(): void {
  dragPeerId.value = null
  dragOverPeerId.value = null
}

function onDisplayNameEnter(): void {
  if (joining.value || session.inCall) {
    return
  }
  void joinCall()
}

onBeforeUnmount(() => {
  /* Вихід з маршруту /call (навігація по сайту) має закривати кімнату й зупиняти медіа, інакше Pinia-сесія лишається inCall. */
  leaveCall()
})

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerForDevicePickers, true)
  void (async () => {
    await ensureAuthLoaded()
    const authName = normalizeDisplayName(user.value?.displayName)
    const cur = normalizeDisplayName(session.selfDisplayName)
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

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerForDevicePickers, true)
  document.documentElement.classList.remove(CALL_ROUTE_HTML_CLASS)
})

watch(
  () => session.inCall,
  (inCall) => {
    if (inCall) {
      void refreshMediaDevices()
    } else {
      closeMediaDevicePickers()
    }
  },
)
</script>

<template>
  <div class="page-route">
    <AppContainer
      class="call-page"
      :class="{
        'call-page--prejoin': !session.inCall,
        'call-page--stage-full': stageFullBleed,
      }"
      :flush="stageFullBleed"
    >
    <div class="call-page__shell">
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
            @keydown.enter.prevent="onDisplayNameEnter"
          />
        </label>
        <fieldset v-if="allowManualVideoQuality" class="call-page__fieldset">
          <legend class="call-page__legend">{{ t('callPage.qualityPreset') }}</legend>
          <p class="call-page__hint--small">{{ t('callPage.qualityAdminHint') }}</p>
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
        <p v-if="isAdmin" class="call-page__meta">{{ t('callPage.wsStatus', { status: wsStatus }) }}</p>
        <AppButton variant="primary" :disabled="joining" @click="joinCall">
          {{ joining ? t('callPage.joining') : t('callPage.join') }}
        </AppButton>
      </section>

      <section v-else class="call-page__active">
        <div class="call-page__toasts" role="region" :aria-label="t('callPage.toastStackAria')">
          <TransitionGroup name="call-toast" tag="div" class="call-page__toast-stack">
            <div
              v-for="x in callToasts"
              :key="x.id"
              class="call-page__toast"
              :class="x.kind === 'leave' ? 'call-page__toast--leave' : 'call-page__toast--join'"
            >
              {{ x.text }}
            </div>
          </TransitionGroup>
        </div>

        <div class="call-page__stage">
          <div class="call-page__grid" :class="[callGridModifier, { 'call-page__grid--fullbleed': stageFullBleed }]">
            <div
              v-for="row in orderedGridRows"
              :key="row.tile.peerId"
              class="call-page__tile-wrap"
              :class="{ 'call-page__tile-wrap--over': dragOverPeerId === row.tile.peerId }"
              @dragover.prevent="onTileDragOver($event, row.tile.peerId)"
              @dragleave="onTileDragLeave(row.tile.peerId)"
              @drop.prevent="onTileDrop(row.tile.peerId)"
              @dragend="onTileDragEnd"
            >
              <div
                class="call-page__drag-handle"
                draggable="true"
                :title="t('callPage.dragReorder')"
                :aria-label="t('callPage.dragReorder')"
                @dragstart="onTileDragStart($event, row.tile.peerId)"
              />
              <ParticipantTile
                class="call-page__tile-inner"
                :peer-id="row.tile.peerId"
                :display-name="row.displayName"
                :stream="row.tile.stream"
                :is-local="row.tile.isLocal"
                :video-enabled="row.tile.videoEnabled"
                :audio-enabled="row.tile.audioEnabled"
                :video-fill-cover="row.tile.videoFillCover !== false"
                :play-rev="row.tile.playRev"
                :size-tier="sizeTier"
                :active-speaker="activeSpeakerPeerId === row.tile.peerId"
                :remote-listen-volume="row.tile.remoteListenVolume"
                :remote-listen-muted="row.tile.remoteListenMuted"
                :raise-hand="Boolean(row.tile.handRaised)"
                @update:listen-volume="setRemoteListenVolume(row.tile.peerId, $event)"
                @update:listen-muted="setRemoteListenMuted(row.tile.peerId, $event)"
              />
            </div>
          </div>
        </div>

        <div class="call-page__dock" role="toolbar" :aria-label="t('callPage.callControls')">
          <div
            ref="micSplitRef"
            class="call-page__dock-split"
            :class="{
              'call-page__dock-split--open': micPickerOpen,
              'call-page__dock-split--solo': !showMediaDevicePickers,
            }"
          >
            <button
              type="button"
              class="call-page__dock-btn call-page__dock-btn--split-main"
              :class="{ 'call-page__dock-btn--danger': !micEnabled }"
              :title="micEnabled ? t('callPage.muteMic') : t('callPage.unmute')"
              :aria-pressed="!micEnabled"
              @click="toggleMic"
            >
              <span class="call-page__dock-ico" aria-hidden="true">
                <svg
                  v-if="micEnabled"
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3" />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                  <path d="M12 19v3" />
                  <path d="M3 3l18 18" />
                </svg>
              </span>
            </button>
            <button
              v-if="showMediaDevicePickers"
              type="button"
              class="call-page__dock-btn call-page__dock-btn--split-chev"
              :title="t('callPage.micInputMenu')"
              :aria-expanded="micPickerOpen"
              aria-haspopup="menu"
              @click.stop="micPickerOpen = !micPickerOpen; camPickerOpen = false"
            >
              <span class="call-page__dock-chev" aria-hidden="true" />
            </button>
            <div
              v-if="micPickerOpen && showMediaDevicePickers"
              class="call-page__device-pop sa-scrollbar"
              role="menu"
              :aria-label="t('callPage.micInputMenu')"
            >
              <p class="call-page__device-pop__title">{{ t('callPage.chooseMic') }}</p>
              <button
                v-for="d in audioInputDevices"
                :key="d.deviceId"
                type="button"
                role="menuitemradio"
                class="call-page__device-pop__opt"
                :aria-checked="d.deviceId === localAudioInputDeviceId"
                :class="{ 'call-page__device-pop__opt--active': d.deviceId === localAudioInputDeviceId }"
                @click="pickAudioInput(d.deviceId)"
              >
                {{ d.label }}
              </button>
            </div>
          </div>
          <div
            ref="camSplitRef"
            class="call-page__dock-split"
            :class="{
              'call-page__dock-split--open': camPickerOpen,
              'call-page__dock-split--solo': !showMediaDevicePickers,
            }"
          >
            <button
              type="button"
              class="call-page__dock-btn call-page__dock-btn--split-main"
              :class="{ 'call-page__dock-btn--danger': !camEnabled }"
              :title="camEnabled ? t('callPage.cameraOff') : t('callPage.cameraOn')"
              :aria-pressed="!camEnabled"
              @click="toggleCam"
            >
              <span class="call-page__dock-ico" aria-hidden="true">
                <svg
                  v-if="camEnabled"
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m22 8-6 4 6 4V8Z" />
                  <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m22 8-6 4 6 4V8Z" />
                  <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                  <path d="M3 3l18 18" />
                </svg>
              </span>
            </button>
            <button
              v-if="showMediaDevicePickers"
              type="button"
              class="call-page__dock-btn call-page__dock-btn--split-chev"
              :title="t('callPage.cameraInputMenu')"
              :aria-expanded="camPickerOpen"
              aria-haspopup="menu"
              @click.stop="camPickerOpen = !camPickerOpen; micPickerOpen = false"
            >
              <span class="call-page__dock-chev" aria-hidden="true" />
            </button>
            <div
              v-if="camPickerOpen && showMediaDevicePickers"
              class="call-page__device-pop sa-scrollbar"
              role="menu"
              :aria-label="t('callPage.cameraInputMenu')"
            >
              <p class="call-page__device-pop__title">{{ t('callPage.chooseCamera') }}</p>
              <button
                v-for="d in videoInputDevices"
                :key="d.deviceId"
                type="button"
                role="menuitemradio"
                class="call-page__device-pop__opt"
                :aria-checked="d.deviceId === localVideoInputDeviceId"
                :class="{ 'call-page__device-pop__opt--active': d.deviceId === localVideoInputDeviceId }"
                @click="pickVideoInput(d.deviceId)"
              >
                {{ d.label }}
              </button>
            </div>
          </div>
          <button
            type="button"
            class="call-page__dock-btn"
            :class="{ 'call-page__dock-btn--accent': handRaised }"
            :title="handRaised ? t('callPage.raiseHandOff') : t('callPage.raiseHandOn')"
            :aria-pressed="handRaised"
            @click="toggleRaiseHand"
          >
            <span class="call-page__dock-ico call-page__dock-ico--emoji" aria-hidden="true">✋</span>
          </button>
          <button
            type="button"
            class="call-page__dock-btn"
            :class="{ 'call-page__dock-btn--accent': screenSharing }"
            :title="screenSharing ? t('callPage.screenShareStop') : t('callPage.screenShareStart')"
            :aria-pressed="screenSharing"
            @click="toggleScreenShare"
          >
            <span class="call-page__dock-ico" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect width="20" height="14" x="2" y="3" rx="2" ry="2" />
                <path d="M7 21h10" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            class="call-page__dock-btn"
            :class="{ 'call-page__dock-btn--accent': chatOpen }"
            :title="chatOpen ? t('callPage.chatHide') : t('callPage.chatShow')"
            :aria-pressed="chatOpen"
            @click="chatOpen = !chatOpen"
          >
            <span class="call-page__dock-ico" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            class="call-page__dock-btn call-page__dock-btn--leave"
            :title="t('callPage.leave')"
            @click="leaveCall"
          >
            <span class="call-page__dock-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path
                  d="M10.09 15.59 11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
                />
              </svg>
            </span>
          </button>
        </div>

        <aside
          class="call-page__chat"
          :class="{ 'call-page__chat--open': chatOpen }"
          :aria-label="t('callPage.chatTitle')"
          :aria-hidden="chatOpen ? 'false' : 'true'"
        >
          <div class="call-page__chat-head">
            <span class="call-page__chat-title">{{ t('callPage.chatTitle') }}</span>
            <button type="button" class="call-page__chat-close" @click="chatOpen = false">
              {{ t('callPage.chatClose') }}
            </button>
          </div>
          <div ref="chatScrollRef" class="call-page__chat-scroll sa-scrollbar">
            <ul class="call-page__chat-list" role="list">
              <template v-if="callChatMessages.length === 0">
                <li key="chat-empty" class="call-page__chat-li call-page__chat-li--empty">
                  {{ t('callPage.chatEmpty') }}
                </li>
              </template>
              <template v-else>
                <li
                  v-for="line in callChatMessages"
                  :key="line.id"
                  class="call-page__chat-li"
                  :class="{ 'call-page__chat-li--self': isSelfChatLine(line) }"
                >
                  <span class="call-page__chat-meta">
                    <span class="call-page__chat-name">{{ peerDisplayName(line.peerId) }}</span>
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
        </aside>

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
  max-height: 100%;
  overflow: hidden;
}

.call-page {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 0;
  overflow: hidden;
  /* Прозоро: позаду — шар AppShell (блискавки), без окремого «килима» під відео / формою. */
  background: transparent;
  color: var(--sa-color-text-body);
  padding-block: 0 var(--sa-space-6);
}

.call-page:not(.call-page--prejoin) {
  padding-block: 0;
}

.call-page__shell {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 1rem 0 2rem;
  box-sizing: border-box;
}

.call-page--stage-full .call-page__shell {
  padding-inline: 0;
}

.call-page--prejoin .call-page__shell {
  justify-content: center;
  align-items: center;
}

.call-page__hint--small {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  opacity: 0.85;
  color: var(--sa-color-text-muted);
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
  /* Раніше було 6.25rem під dock+футер — футер на /call прибрано; лишаємо помірний зазор під плаваючий dock. */
  padding-bottom: calc(3.25rem + env(safe-area-inset-bottom, 0px));
}

.call-page__toasts {
  position: fixed;
  top: 4.75rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 45;
  width: min(22rem, calc(100vw - 2rem));
  pointer-events: none;
}

.call-page__toast-stack {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  align-items: stretch;
}

.call-page__toast {
  pointer-events: none;
  padding: 0.55rem 0.85rem;
  border-radius: 12px;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.35;
  color: #f9fafb;
  border: 1px solid rgb(255 255 255 / 0.12);
  box-shadow: 0 10px 28px rgb(0 0 0 / 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.call-page__toast--join {
  background: color-mix(in srgb, var(--sa-color-primary, #a78bfa) 32%, rgb(15 16 20 / 0.92));
}

.call-page__toast--leave {
  background: color-mix(in srgb, #64748b 35%, rgb(15 16 20 / 0.92));
}

.call-toast-enter-active,
.call-toast-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.call-toast-enter-from,
.call-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.call-toast-move {
  transition: transform 0.2s ease;
}

.call-page__stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
  padding: 20px;
}

.call-page__grid {
  display: grid;
  gap: 0.85rem;
  flex: 1;
  min-height: 0;
  align-content: center;
  justify-items: stretch;
  width: 100%;
  overflow: visible;
}

.call-page__grid--1 {
  grid-template-columns: 1fr;
  grid-template-rows: minmax(0, 1fr);
  max-width: min(1100px, 100%);
  margin-inline: auto;
  align-content: stretch;
}

.call-page__grid--1 .call-page__tile-wrap {
  min-height: 0;
  max-height: 100%;
}

.call-page__grid--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: min(1200px, 100%);
  margin-inline: auto;
  align-content: center;
}

.call-page__grid--4 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: min(1280px, 100%);
  margin-inline: auto;
}

.call-page__grid--9 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  max-width: min(1400px, 100%);
  margin-inline: auto;
}

.call-page__grid--12 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  max-width: min(1600px, 100%);
  margin-inline: auto;
}

.call-page__grid.call-page__grid--fullbleed {
  max-width: 100%;
  margin-inline: 0;
}

.call-page__tile-wrap {
  position: relative;
  z-index: 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Сусідня клітина сітки інакше перекриває outline/тінь попередньої (порядок малювання в DOM). */
.call-page__tile-wrap:hover,
.call-page__tile-wrap:focus-within,
.call-page__tile-wrap--over {
  z-index: 2;
}

.call-page__tile-wrap--over {
  outline: 2px dashed color-mix(in srgb, var(--sa-color-primary, #a78bfa) 85%, transparent);
  outline-offset: 5px;
  border-radius: 18px;
}

.call-page__drag-handle {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 8;
  width: 11px;
  height: 48px;
  border-radius: 7px;
  background: rgb(255 255 255 / 0.1);
  border: 1px solid rgb(255 255 255 / 0.22);
  cursor: grab;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
}

.call-page__drag-handle:active {
  cursor: grabbing;
}

.call-page__tile-inner {
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.call-page__tile-inner :deep(.tile) {
  height: 100%;
  min-height: 0;
}

.call-page__dock {
  position: fixed;
  left: 50%;
  bottom: 1.15rem;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.55rem 0.75rem;
  max-width: calc(100vw - 1.5rem);
  padding: 0.62rem 0.9rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--sa-color-surface-raised) 76%, #000);
  border: 1px solid var(--sa-color-border);
  box-shadow:
    0 10px 36px rgb(0 0 0 / 0.48),
    0 0 0 1px rgb(255 255 255 / 0.05);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.call-page__dock-btn {
  width: 3.25rem;
  height: 3.25rem;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgb(255 255 255 / 0.14);
  background: color-mix(in srgb, var(--sa-color-surface) 88%, transparent);
  color: #f3f4f6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    box-shadow 0.2s ease,
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

/* Без translateY і без великого «ореолу» — інакше hover виглядає як виступ над верхом пілюлі. */
.call-page__dock-btn:hover:not(:disabled) {
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.07),
    0 3px 12px rgb(167 139 250 / 0.28);
}

.call-page__dock-btn--split-main:hover:not(:disabled),
.call-page__dock-btn--split-chev:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.07);
}

.call-page__dock-split {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  border-radius: 999px;
  border: 1px solid rgb(255 255 255 / 0.14);
  background: color-mix(in srgb, var(--sa-color-surface) 88%, transparent);
  overflow: visible;
}

.call-page__dock-split--solo {
  border: none;
  background: transparent;
}

.call-page__dock-split--solo .call-page__dock-btn--split-main {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  border: 1px solid rgb(255 255 255 / 0.14);
  background: color-mix(in srgb, var(--sa-color-surface) 88%, transparent);
}

.call-page__dock-split--open {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 35%, transparent);
}

.call-page__dock-btn--split-main {
  width: 2.75rem;
  height: 3.25rem;
  min-height: 3.25rem;
  border-radius: 999px 0 0 999px;
  border: none;
  border-right: 1px solid rgb(255 255 255 / 0.1);
}

.call-page__dock-btn--split-chev {
  width: 1.85rem;
  min-width: 1.85rem;
  height: 3.25rem;
  padding: 0;
  border-radius: 0 999px 999px 0;
  border: none;
  background: transparent;
}

.call-page__dock-chev {
  display: block;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
  opacity: 0.88;
}

.call-page__device-pop {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 13.5rem;
  max-width: min(18rem, calc(100vw - 2rem));
  max-height: min(50vh, 16rem);
  overflow-y: auto;
  padding: 10px 8px 10px;
  border-radius: 8px;
  border: 1px solid rgb(0 0 0 / 0.45);
  background: #2b2d31;
  box-shadow:
    0 12px 32px rgb(0 0 0 / 0.55),
    0 0 0 1px rgb(255 255 255 / 0.04);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 50;
}

.call-page__device-pop__title {
  margin: 0 6px 8px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #949ba4;
}

.call-page__device-pop__opt {
  display: block;
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  text-align: left;
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.35;
  color: #dbdee1;
  background: transparent;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.call-page__device-pop__opt:hover {
  background: #35373c;
  color: #f2f3f5;
}

.call-page__device-pop__opt--active {
  background: color-mix(in srgb, #5865f2 22%, transparent);
  color: #fff;
}

.call-page__dock-btn:focus-visible {
  outline: 2px solid var(--sa-color-primary, #a78bfa);
  outline-offset: 1px;
}

.call-page__dock-btn--danger {
  border-color: color-mix(in srgb, #f87171 55%, rgb(255 255 255 / 0.12));
  color: #fecaca;
  box-shadow: 0 0 0 1px rgb(248 113 113 / 0.22);
}

.call-page__dock-btn--leave {
  background: linear-gradient(165deg, #ef4444, #b91c1c);
  border-color: #fca5a5;
  color: #fff;
}

.call-page__dock-btn--leave:hover {
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.12),
    0 3px 14px rgb(248 113 113 / 0.4);
}

.call-page__dock-btn--accent {
  border-color: color-mix(in srgb, #fde047 55%, rgb(255 255 255 / 0.12));
  color: #fef9c3;
  box-shadow: 0 0 0 1px rgb(250 204 21 / 0.22);
}

.call-page__dock-ico {
  display: flex;
  align-items: center;
  justify-content: center;
}

.call-page__dock-ico--emoji {
  font-size: 1.05rem;
  line-height: 1;
}

.call-page__chat {
  position: fixed;
  top: 4.5rem;
  right: 0.75rem;
  bottom: 6.25rem;
  z-index: 38;
  width: min(20rem, calc(100vw - 1.5rem));
  display: flex;
  flex-direction: column;
  border-radius: var(--sa-radius-lg);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-bg-card) 94%, transparent);
  color: var(--sa-color-text-body);
  box-shadow: var(--sa-shadow-card);
  overflow: hidden;
  contain: layout paint;
  transform: translate3d(calc(100% + 1.25rem), 0, 0);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.22s ease,
    visibility 0.22s ease;
}

.call-page__chat--open {
  transform: translate3d(0, 0, 0);
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .call-page__chat {
    transition: none;
  }
}

.call-page__chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sa-space-2);
  padding: var(--sa-space-3) var(--sa-space-4);
  border-bottom: 1px solid var(--sa-color-border);
  flex-shrink: 0;
  background: color-mix(in srgb, var(--sa-color-surface-raised) 40%, transparent);
}

.call-page__chat-title {
  font-family: var(--sa-font-display);
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  color: var(--sa-color-text-main);
}

.call-page__chat-close {
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--sa-color-surface-raised) 70%, transparent);
  color: var(--sa-color-text-main);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.28rem 0.55rem;
  border-radius: var(--sa-radius-sm);
}

.call-page__chat-close:hover {
  border-color: var(--sa-color-primary-border);
  background: color-mix(in srgb, var(--sa-color-primary) 14%, var(--sa-color-surface-raised));
  color: var(--sa-color-text-strong);
}

.call-page__chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: auto;
  overscroll-behavior: contain;
  padding: var(--sa-space-2) var(--sa-space-3);
}

.call-page__chat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
}

.call-page__chat-li {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: var(--sa-space-2) var(--sa-space-3);
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 58%, transparent);
  border: 1px solid var(--sa-color-border);
}

.call-page__chat-li--empty {
  text-align: center;
  font-size: 0.82rem;
  color: var(--sa-color-text-muted);
  border-style: dashed;
  background: color-mix(in srgb, var(--sa-color-surface-raised) 28%, transparent);
}

.call-page__chat-li--self {
  border-color: var(--sa-color-primary-border);
  background: color-mix(in srgb, var(--sa-color-primary) 12%, var(--sa-color-surface-raised));
}

.call-page__chat-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sa-space-2);
  font-size: 0.68rem;
  color: var(--sa-color-text-muted);
}

.call-page__chat-name {
  font-weight: 700;
  color: var(--sa-color-text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.call-page__chat-time {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.call-page__chat-text {
  font-size: 0.8rem;
  color: var(--sa-color-text-body);
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.45;
}

.call-page__chat-form {
  display: flex;
  gap: var(--sa-space-2);
  padding: var(--sa-space-3) var(--sa-space-4);
  border-top: 1px solid var(--sa-color-border);
  flex-shrink: 0;
  align-items: center;
  background: color-mix(in srgb, var(--sa-color-surface-raised) 35%, transparent);
}

.call-page__chat-input {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface) 92%, transparent);
  color: var(--sa-color-text-main);
  font: inherit;
  font-size: 0.84rem;
}

.call-page__chat-input:focus {
  outline: 2px solid color-mix(in srgb, var(--sa-color-primary) 45%, transparent);
  outline-offset: 1px;
}

.call-page__chat-send {
  flex-shrink: 0;
}

@media (max-width: 720px) {
  .call-page__grid--2,
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
