<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VideoQualityPreset } from 'call-core'
import AppButton from '@/components/ui/AppButton.vue'
import { CALL_ROOM_POPOVER_PANEL_ID } from '@/stores/callRoomHeaderJoin'

type VideoQualityUiChoice = 'auto' | VideoQualityPreset

const props = defineProps<{
  open: boolean
  displayName: string
  roomJoinDraft: string
  roomCopyFlash: boolean
  joining: boolean
  allowManualVideoQuality: boolean
  showCallDebugControls: boolean
  isAdmin: boolean
  wsStatus: string
  qualityPresets: readonly VideoQualityPreset[]
  videoQualityChoice: VideoQualityUiChoice
  callDebugOverlay: boolean
}>()

const emit = defineEmits<{
  'update:displayName': [value: string]
  'update:roomJoinDraft': [value: string]
  'update:videoQualityChoice': [value: VideoQualityUiChoice]
  'update:callDebugOverlay': [value: boolean]
  'submit-room': []
  'copy-room': []
  'generate-room': []
}>()

const { t } = useI18n()

const displayNameModel = computed({
  get: () => props.displayName,
  set: (value: string) => emit('update:displayName', value),
})

const roomJoinDraftModel = computed({
  get: () => props.roomJoinDraft,
  set: (value: string) => emit('update:roomJoinDraft', value),
})

const videoQualityChoiceModel = computed({
  get: () => props.videoQualityChoice,
  set: (value: VideoQualityUiChoice) => emit('update:videoQualityChoice', value),
})

const callDebugOverlayModel = computed({
  get: () => props.callDebugOverlay,
  set: (value: boolean) => emit('update:callDebugOverlay', value),
})
</script>

<template>
  <Teleport to="body">
    <Transition name="call-page-room-pop">
      <div
        v-if="open"
        :id="CALL_ROOM_POPOVER_PANEL_ID"
        class="call-page__room-pop sa-scrollbar"
        role="dialog"
        :aria-label="t('callPage.roomPopoverAria')"
      >
        <label class="call-page__room-pop-field call-page__room-pop-field--top">
          <span>{{ t('callPage.fieldName') }}</span>
          <input
            v-model="displayNameModel"
            type="text"
            name="call-display-name"
            autocomplete="name"
            :placeholder="t('callPage.placeholderName')"
          />
        </label>
        <div class="call-page__room-pop-code">
          <span class="call-page__room-pop-label">{{ t('callPage.roomCodeLabel') }}</span>
          <div class="call-page__room-pop-code-row">
            <input
              v-model="roomJoinDraftModel"
              class="call-page__room-pop-code-input"
              type="text"
              name="call-room-code"
              autocomplete="off"
              :placeholder="t('callPage.roomJoinPlaceholder')"
              @keydown.enter.prevent="emit('submit-room')"
            />
            <div class="call-page__room-pop-code-tools">
              <div class="call-page__room-pop-copy-wrap">
                <button
                  type="button"
                  class="call-page__room-pop-ico-btn"
                  :disabled="joining"
                  :title="roomCopyFlash ? t('callPage.roomCodeCopied') : t('callPage.roomCopy')"
                  :aria-label="roomCopyFlash ? t('callPage.roomCodeCopied') : t('callPage.roomCopy')"
                  @click="emit('copy-room')"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                </button>
                <span
                  v-show="roomCopyFlash"
                  role="status"
                  aria-live="polite"
                  class="call-page__room-pop-copy-tooltip"
                >
                  {{ t('callPage.roomCodeCopied') }}
                </span>
              </div>
              <button
                type="button"
                class="call-page__room-pop-ico-btn"
                :disabled="joining"
                :title="t('callPage.roomGenerateNew')"
                :aria-label="t('callPage.roomRegenerateAria')"
                @click="emit('generate-room')"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect width="16" height="16" x="4" y="4" rx="2.5" ry="2.5" />
                  <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="call-page__room-pop-join">
          <AppButton variant="primary" :disabled="joining" @click="emit('submit-room')">
            {{ t('callPage.roomSwitch') }}
          </AppButton>
        </div>
        <fieldset v-if="allowManualVideoQuality" class="call-page__fieldset call-page__fieldset--in-pop">
          <legend class="call-page__legend">{{ t('callPage.qualityPreset') }}</legend>
          <p class="call-page__hint--small">{{ t('callPage.qualityAdminHint') }}</p>
          <div class="call-page__preset-row">
            <label class="call-page__preset">
              <input v-model="videoQualityChoiceModel" type="radio" name="video-quality-pop" value="auto" />
              <span>{{ t('callPage.quality.auto') }}</span>
            </label>
            <label v-for="p in qualityPresets" :key="p" class="call-page__preset">
              <input v-model="videoQualityChoiceModel" type="radio" name="video-quality-pop" :value="p" />
              <span>{{ t(`callPage.quality.${p}`) }}</span>
            </label>
          </div>
        </fieldset>
        <label v-if="showCallDebugControls" class="call-page__check call-page__check--in-pop">
          <input v-model="callDebugOverlayModel" type="checkbox" />
          <span>{{ t('callPage.debugOverlay') }}</span>
        </label>
        <p v-if="isAdmin" class="call-page__meta call-page__meta--in-pop">
          {{ t('callPage.wsStatus', { status: wsStatus }) }}
        </p>
      </div>
    </Transition>
  </Teleport>
</template>
