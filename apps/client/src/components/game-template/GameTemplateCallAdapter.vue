<script setup lang="ts">
/**
 * GameTemplateCallAdapter — fork of `MafiaCallAdapter.vue` for the
 * `/app/game-template` route. Mounted from `GameTemplatePage.vue` as a
 * sibling of `<GameTemplateCallPage>`, parallel to
 * `<GameTemplateHostPanel>` and `<GameTemplateOverlay>`.
 *
 * Initial scope mirrors `MafiaCallAdapter`:
 *   - host-only "speaking order" hint toast
 *     (`.call-page__mafia-speak-hint` — `position: fixed; top: 4.75rem;
 *     right: 1rem`).
 *
 * CSS class names are preserved 1:1 from the Mafia version because
 * `components/call/CallPage.css` carries those selectors and is shared
 * by both routes. Renaming the class would silently strip the styling.
 *
 * The underlying speak-hint state machine still lives in
 * `useMafiaSpeakingHint`. We pass a route predicate that returns true
 * when `route.name === 'game-template'`; the composable is route-name
 * agnostic and only checks the supplied Ref.
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

/** Adapter is mounted from `GameTemplatePage`, but read the route name here too. */
const isGameTemplateRoute = computed(() => route.name === 'game-template')

const { mafiaSpeakingOrderHintVisible } = useMafiaSpeakingHint({
  isMafiaRoute: isGameTemplateRoute,
  mafiaViewUi: isViewMode,
  mafiaGameStore,
})
</script>

<template>
  <!--
    Class names preserved as `.call-page__*` because CallPage.css carries
    those rules. The Game Template fork reuses CallPage.css.
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
