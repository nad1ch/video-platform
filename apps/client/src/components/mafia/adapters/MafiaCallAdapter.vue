<script setup lang="ts">
/**
 * MafiaCallAdapter — Mafia-owned wrapper for Mafia call UI composition
 * (Phase 2B extraction from CallPage).
 *
 * Mounted from `MafiaPage.vue` as a sibling of `<CallPage>`, parallel to
 * `<MafiaHostPanel>` and `<MafiaOverlay>`. Owns Mafia UI blocks whose visual
 * position is anchored to the viewport via `position: fixed` and therefore
 * can leave CallPage's main DOM tree without changing layout.
 *
 * Phase 2B scope (this iteration):
 *   - host-only "speaking order" hint toast
 *     (`.call-page__mafia-speak-hint` — `position: fixed; top: 4.75rem; right: 1rem`).
 *
 * What this adapter does NOT own:
 *   - any media / WebRTC state (call-core owns the orchestrator; CallPage
 *     hosts the orchestrator wiring)
 *   - the `.call-page__mafia-view-bottom` strip — its v-if depends on the
 *     orchestrator-local `joining` ref, which is not exposed on the call
 *     session store; preserved in CallPage to avoid weakening the gate
 *     during the joining transition
 *   - the host action bar inside `.call-page__bottom-cluster__center` (DOM
 *     flow-positioned; moving out would change flex ordering)
 *   - the host speaking-queue bar inside `.call-page__bottom-cluster__center`
 *     (same DOM-flow constraint)
 *   - per-tile Mafia chrome (kept inside ParticipantTile until its v-memo
 *     coupling on `mafiaLifeState` is restructured — Phase 3 stop condition)
 *
 * CSS class names preserved 1:1 so the existing stylesheet rules apply
 * unchanged. The Transition wrapper, role, and class set match the original
 * CallPage template byte-for-byte.
 */

import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import { useMafiaViewMode } from '@/composables/mafiaStreamViewRoute'
import { useMafiaSpeakingHint } from '@/composables/useMafiaSpeakingHint'

const { t } = useI18n()
const route = useRoute()
const { isViewMode } = useMafiaViewMode()
const mafiaGameStore = useMafiaGameStore()

/**
 * The adapter is mounted from `MafiaPage`, which only renders for the
 * `mafia` route — but read the route name here as well so the underlying
 * `useMafiaSpeakingHint` watcher uses an honest gate (matches the inline
 * gate in `useMafiaCallHostUi`'s previous speak-hint watcher).
 */
const isMafiaRoute = computed(() => route.name === 'mafia')

const { mafiaSpeakingOrderHintVisible } = useMafiaSpeakingHint({
  isMafiaRoute,
  mafiaViewUi: isViewMode,
  mafiaGameStore,
})
</script>

<template>
  <!--
    `.call-page__mafia-speak-hint` is `position: fixed` in CallPage.css
    (top: 4.75rem; right: 1rem; z-index: 110), so it renders correctly from
    any DOM ancestor. Class names + DOM shape unchanged from the original
    CallPage template; the existing CSS rules apply 1:1.
  -->
  <Transition name="call-toast" appear>
    <div
      v-if="mafiaSpeakingOrderHintVisible"
      class="call-page__toast call-page__toast--join call-page__mafia-speak-hint"
      role="status"
    >
      {{ t('mafiaPage.speakingOrderFloatHint') }}
    </div>
  </Transition>
</template>
