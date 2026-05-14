<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { InboundVideoDebugRow } from 'call-core'
import AppButton from '@/components/ui/AppButton.vue'

/**
 * Block 28 — presentational shell for the call-debug overlay aside.
 * The `<aside class="call-page__debug">` skeleton + dl rows + inbound
 * debug row list was byte-identical between `CallPage.vue` and
 * `GameTemplateCallPage.vue`. The route-specific `v-if` guard
 * (`session.callDebugOverlay && showCallDebugControls && !isViewMode`)
 * stays page-side.
 *
 * CSS classes preserved verbatim against `CallPage.css`:
 *   - `.call-page__debug`
 *   - `.call-page__debug-head` / `.call-page__debug-title`
 *   - `.call-page__debug-dl`
 *   - `.call-page__debug-list` / `.call-page__debug-li`
 *   - `.call-page__debug-peer` / `.call-page__debug-fps` / `.call-page__debug-loss`
 *
 * Structural snapshot shape (what the template reads) is declared
 * locally; the page's `callDebugSnapshot` from `useCallOrchestrator`
 * happens to be a wider object, so this is a structural narrowing.
 */

export interface CallDebugSnapshotShape {
  videoQualityPreset: string
  videoQualityExplicit: boolean
  videoPublishTier: string
  activeCameraPublishersAtWire: number
  peerCountAtWire: number
  publishSimulcast: boolean
  effectiveActiveSpeakerPeerId: string | null
  serverActiveSpeakerPeerId: string | null
}

defineProps<{
  snapshot: CallDebugSnapshotShape
  inboundRows: readonly InboundVideoDebugRow[]
  inboundBusy: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const { t } = useI18n()
</script>

<template>
  <aside
    class="call-page__debug"
    :aria-label="t('callPage.debugAria')"
  >
    <div class="call-page__debug-head">
      <span class="call-page__debug-title">{{ t('callPage.debugTitle') }}</span>
      <AppButton variant="secondary" :disabled="inboundBusy" @click="emit('refresh')">
        {{ inboundBusy ? t('callPage.debugRefreshing') : t('callPage.debugRefresh') }}
      </AppButton>
    </div>
    <dl class="call-page__debug-dl">
      <dt>{{ t('callPage.debugPreset') }}</dt>
      <dd>{{ snapshot.videoQualityPreset }}</dd>
      <dt>{{ t('callPage.debugExplicit') }}</dt>
      <dd>{{ snapshot.videoQualityExplicit }}</dd>
      <dt>{{ t('callPage.debugPublishTier') }}</dt>
      <dd>{{ snapshot.videoPublishTier }}</dd>
      <dt>{{ t('callPage.debugActiveCamerasWire') }}</dt>
      <dd>{{ snapshot.activeCameraPublishersAtWire }}</dd>
      <dt>{{ t('callPage.debugPeersWire') }}</dt>
      <dd>{{ snapshot.peerCountAtWire }}</dd>
      <dt>{{ t('callPage.debugPublishSimulcast') }}</dt>
      <dd>{{ snapshot.publishSimulcast }}</dd>
      <dt>{{ t('callPage.debugActiveSpeaker') }}</dt>
      <dd>{{ snapshot.effectiveActiveSpeakerPeerId ?? '—' }}</dd>
      <dt>{{ t('callPage.debugServerSpeaker') }}</dt>
      <dd>{{ snapshot.serverActiveSpeakerPeerId ?? '—' }}</dd>
    </dl>
    <ul v-if="inboundRows.length" class="call-page__debug-list">
      <li v-for="row in inboundRows" :key="row.producerId" class="call-page__debug-li">
        <span class="call-page__debug-peer">{{ row.peerId.slice(0, 8) }}…</span>
        {{ row.frameWidth ?? '?' }}×{{ row.frameHeight ?? '?' }}
        <span v-if="row.framesPerSecond != null" class="call-page__debug-fps"> ~{{ row.framesPerSecond.toFixed(1) }} fps</span>
        <span class="call-page__debug-loss"> loss {{ row.packetsLost ?? '—' }}</span>
      </li>
    </ul>
  </aside>
</template>
