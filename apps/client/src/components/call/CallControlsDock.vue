<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import callControlChat from '@/assets/call-controls/chat.svg'
import callControlHand from '@/assets/call-controls/hand.svg'
import callControlHandActive from '@/assets/call-controls/hand-active.svg'
import callControlIconCameraOff from '@/assets/call-controls/icon-camera-off.svg'
import callControlIconCameraOn from '@/assets/call-controls/icon-camera-on.svg'
import callControlIconHand from '@/assets/call-controls/icon-hand.svg'
import callControlIconHandActive from '@/assets/call-controls/icon-hand-active.svg'
import callControlIconLeave from '@/assets/call-controls/icon-leave.svg'
import callControlIconMicOff from '@/assets/call-controls/icon-mic-off.svg'
import callControlIconMicOn from '@/assets/call-controls/icon-mic-on.svg'
import callControlIconScreen from '@/assets/call-controls/icon-screen.svg'
import callControlIconScreenActive from '@/assets/call-controls/icon-screen-active.svg'
import callControlLeave from '@/assets/call-controls/leave.svg'
import callControlMicOff from '@/assets/call-controls/split-mic-off.svg'
import callControlMicOn from '@/assets/call-controls/split-mic-on.svg'
import callControlScreen from '@/assets/call-controls/screen.svg'
import callControlScreenActive from '@/assets/call-controls/screen-active.svg'
import callControlCameraOff from '@/assets/call-controls/split-camera-off.svg'
import callControlCameraOn from '@/assets/call-controls/split-camera-on.svg'

type CallDeviceChoice = { deviceId: string; label: string }

defineProps<{
  joining: boolean
  micEnabled: boolean
  camEnabled: boolean
  handRaised: boolean
  screenSharing: boolean
  chatOpen: boolean
  showMediaDevicePickers: boolean
  micPickerOpen: boolean
  camPickerOpen: boolean
  audioInputDevices: readonly CallDeviceChoice[]
  videoInputDevices: readonly CallDeviceChoice[]
  localAudioInputDeviceId?: string | null
  localVideoInputDeviceId?: string | null
}>()

const emit = defineEmits<{
  'update:micPickerOpen': [value: boolean]
  'update:camPickerOpen': [value: boolean]
  'update:chatOpen': [value: boolean]
  'toggle-mic': []
  'toggle-cam': []
  'toggle-raise-hand': []
  'toggle-screen-share': []
  leave: []
  'pick-audio-input': [deviceId: string]
  'pick-video-input': [deviceId: string]
}>()

const { t } = useI18n()

const micSplitRef = ref<HTMLElement | null>(null)
const camSplitRef = ref<HTMLElement | null>(null)

const callControlArt = {
  cameraOff: callControlCameraOff,
  cameraOn: callControlCameraOn,
  chat: callControlChat,
  hand: callControlHand,
  handActive: callControlHandActive,
  leave: callControlLeave,
  micOff: callControlMicOff,
  micOn: callControlMicOn,
  screen: callControlScreen,
  screenActive: callControlScreenActive,
} as const

const callControlIconArt = {
  cameraOff: callControlIconCameraOff,
  cameraOn: callControlIconCameraOn,
  hand: callControlIconHand,
  handActive: callControlIconHandActive,
  leave: callControlIconLeave,
  micOff: callControlIconMicOff,
  micOn: callControlIconMicOn,
  screen: callControlIconScreen,
  screenActive: callControlIconScreenActive,
} as const

function openMicPicker(open: boolean): void {
  emit('update:micPickerOpen', open)
  if (open) {
    emit('update:camPickerOpen', false)
  }
}

function openCamPicker(open: boolean): void {
  emit('update:camPickerOpen', open)
  if (open) {
    emit('update:micPickerOpen', false)
  }
}

function containsDevicePickerTarget(target: Node): boolean {
  return Boolean(micSplitRef.value?.contains(target) || camSplitRef.value?.contains(target))
}

defineExpose({ containsDevicePickerTarget })
</script>

<template>
  <div
    class="call-page__dock"
    :class="{ 'call-page__dock--pending': joining }"
    role="toolbar"
    :aria-label="t('callPage.callControls')"
  >
    <div
      ref="micSplitRef"
      class="call-page__dock-split call-page__dock-split--figma call-page__dock-split--mic"
      :class="{
        'call-page__dock-split--open': micPickerOpen,
        'call-page__dock-split--solo': !showMediaDevicePickers,
      }"
    >
      <img
        class="call-page__dock-control-art"
        :src="micEnabled ? callControlArt.micOn : callControlArt.micOff"
        alt=""
        aria-hidden="true"
      />
      <img
        :key="micEnabled ? 'mic-icon-on' : 'mic-icon-off'"
        class="call-page__dock-control-icon call-page__dock-control-icon--split"
        :src="micEnabled ? callControlIconArt.micOn : callControlIconArt.micOff"
        alt=""
        aria-hidden="true"
      />
      <button
        type="button"
        class="call-page__dock-btn call-page__dock-btn--split-main"
        :class="{ 'call-page__dock-btn--danger': !micEnabled }"
        :aria-label="micEnabled ? t('callPage.muteMic') : t('callPage.unmute')"
        :title="micEnabled ? t('callPage.muteMic') : t('callPage.unmute')"
        :aria-pressed="!micEnabled"
        @click="emit('toggle-mic')"
      />
      <button
        v-if="showMediaDevicePickers"
        type="button"
        class="call-page__dock-btn call-page__dock-btn--split-chev"
        :aria-label="t('callPage.micInputMenu')"
        :title="t('callPage.micInputMenu')"
        :aria-expanded="micPickerOpen"
        aria-haspopup="menu"
        @click.stop="openMicPicker(!micPickerOpen)"
      />
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
          @click="emit('pick-audio-input', d.deviceId)"
        >
          {{ d.label }}
        </button>
      </div>
    </div>
    <div
      ref="camSplitRef"
      class="call-page__dock-split call-page__dock-split--figma call-page__dock-split--camera"
      :class="{
        'call-page__dock-split--open': camPickerOpen,
        'call-page__dock-split--solo': !showMediaDevicePickers,
      }"
    >
      <img
        class="call-page__dock-control-art"
        :src="camEnabled ? callControlArt.cameraOn : callControlArt.cameraOff"
        alt=""
        aria-hidden="true"
      />
      <img
        :key="camEnabled ? 'camera-icon-on' : 'camera-icon-off'"
        class="call-page__dock-control-icon call-page__dock-control-icon--split"
        :src="camEnabled ? callControlIconArt.cameraOn : callControlIconArt.cameraOff"
        alt=""
        aria-hidden="true"
      />
      <button
        type="button"
        class="call-page__dock-btn call-page__dock-btn--split-main"
        :class="{ 'call-page__dock-btn--danger': !camEnabled }"
        :aria-label="camEnabled ? t('callPage.cameraOff') : t('callPage.cameraOn')"
        :title="camEnabled ? t('callPage.cameraOff') : t('callPage.cameraOn')"
        :aria-pressed="!camEnabled"
        @click="emit('toggle-cam')"
      />
      <button
        v-if="showMediaDevicePickers"
        type="button"
        class="call-page__dock-btn call-page__dock-btn--split-chev"
        :aria-label="t('callPage.cameraInputMenu')"
        :title="t('callPage.cameraInputMenu')"
        :aria-expanded="camPickerOpen"
        aria-haspopup="menu"
        @click.stop="openCamPicker(!camPickerOpen)"
      />
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
          @click="emit('pick-video-input', d.deviceId)"
        >
          {{ d.label }}
        </button>
      </div>
    </div>
    <button
      type="button"
      class="call-page__dock-btn call-page__dock-btn--figma call-page__dock-btn--hand call-page__dock-btn--compact-narrow-hide"
      :class="{ 'call-page__dock-btn--accent': handRaised }"
      :aria-label="handRaised ? t('callPage.raiseHandOff') : t('callPage.raiseHandOn')"
      :title="handRaised ? t('callPage.raiseHandOff') : t('callPage.raiseHandOn')"
      :aria-pressed="handRaised"
      @click="emit('toggle-raise-hand')"
    >
      <img
        class="call-page__dock-control-art"
        :src="handRaised ? callControlArt.handActive : callControlArt.hand"
        alt=""
        aria-hidden="true"
      />
      <img
        :key="handRaised ? 'hand-icon-active' : 'hand-icon'"
        class="call-page__dock-control-icon"
        :src="handRaised ? callControlIconArt.handActive : callControlIconArt.hand"
        alt=""
        aria-hidden="true"
      />
    </button>
    <button
      type="button"
      class="call-page__dock-btn call-page__dock-btn--figma call-page__dock-btn--screen call-page__dock-btn--compact-narrow-hide"
      :class="{ 'call-page__dock-btn--accent': screenSharing }"
      :aria-label="screenSharing ? t('callPage.screenShareStop') : t('callPage.screenShareStart')"
      :title="screenSharing ? t('callPage.screenShareStop') : t('callPage.screenShareStart')"
      :aria-pressed="screenSharing"
      @click="emit('toggle-screen-share')"
    >
      <img
        class="call-page__dock-control-art"
        :src="screenSharing ? callControlArt.screenActive : callControlArt.screen"
        alt=""
        aria-hidden="true"
      />
      <img
        :key="screenSharing ? 'screen-icon-active' : 'screen-icon'"
        class="call-page__dock-control-icon"
        :src="screenSharing ? callControlIconArt.screenActive : callControlIconArt.screen"
        alt=""
        aria-hidden="true"
      />
    </button>
    <button
      type="button"
      class="call-page__dock-btn call-page__dock-btn--chat call-page__dock-btn--compact-narrow-hide"
      :class="{ 'call-page__dock-btn--accent': chatOpen }"
      :aria-label="chatOpen ? t('callPage.chatHide') : t('callPage.chatShow')"
      :title="chatOpen ? t('callPage.chatHide') : t('callPage.chatShow')"
      :aria-pressed="chatOpen"
      @click="emit('update:chatOpen', !chatOpen)"
    >
      <span class="call-page__dock-ico" aria-hidden="true">
        <img class="call-page__dock-icon-img" :src="callControlArt.chat" alt="" aria-hidden="true" />
      </span>
    </button>
    <button
      type="button"
      class="call-page__dock-btn call-page__dock-btn--figma call-page__dock-btn--leave"
      :aria-label="t('callPage.leave')"
      :title="t('callPage.leave')"
      @click="emit('leave')"
    >
      <img class="call-page__dock-control-art" :src="callControlArt.leave" alt="" aria-hidden="true" />
      <img class="call-page__dock-control-icon" :src="callControlIconArt.leave" alt="" aria-hidden="true" />
    </button>
  </div>
</template>
