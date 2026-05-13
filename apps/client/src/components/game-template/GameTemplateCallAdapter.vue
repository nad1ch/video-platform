<script setup lang="ts">
/**
 * GameTemplateCallAdapter — Phase 3C.
 *
 * Mounted from `GameTemplatePage.vue` as a sibling of
 * `<GameTemplateCallPage>`. Renders the host-only "speaking order" hint
 * toast.
 *
 * Now consumes the generic GameRoom layer:
 *   - `useGameRoomViewMode` for `?mode=view` detection
 *   - `useGameTemplateGameStore` for host identity + interaction mode
 *   - `useGameRoomSpeakingHint` for the toast state machine
 *
 * CSS class names remain `.call-page__*` because `components/call/CallPage.css`
 * carries those selectors and is shared with the GameTemplate fork.
 */

import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useGameTemplateGameStore } from '@/stores/gameTemplateGame'
import { useGameRoomViewMode } from '@/composables/gameRoomStreamViewRoute'
import { useGameRoomSpeakingHint } from '@/composables/useGameRoomSpeakingHint'

const { t } = useI18n()
const route = useRoute()
const { isViewMode } = useGameRoomViewMode()
const gameStore = useGameTemplateGameStore()

const isGameRoomRoute = computed(() => route.name === 'game-template')

const { speakingOrderHintVisible } = useGameRoomSpeakingHint({
  isGameRoomRoute,
  viewUi: isViewMode,
  gameStore,
})
</script>

<template>
  <!--
    Class names preserved as `.call-page__*` because CallPage.css carries
    those rules. The Game Template fork reuses CallPage.css.
  -->
  <Transition name="call-toast" appear>
    <div
      v-if="speakingOrderHintVisible"
      class="call-page__toast call-page__toast--join call-page__mafia-speak-hint"
      role="status"
    >
      {{ t('mafiaPage.speakingOrderFloatHint') }}
    </div>
  </Transition>
</template>
