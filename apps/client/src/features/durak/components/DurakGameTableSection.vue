<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'
import type { DurakPlayerCount } from '../core/durakModes'
import { useDurakLocalGame } from '../orchestrator/useDurakLocalGame'
import DurakHand from './DurakHand.vue'
import DurakTable from './DurakTable.vue'
import DurakPlayerPanel from './DurakPlayerPanel.vue'

const props = defineProps<{
  rosterPlayerCount: DurakPlayerCount
}>()

const emit = defineEmits<{ back: [] }>()

const { t, te } = useI18n()

const {
  snapshot,
  selectedCardId,
  streamerHand,
  chatHand,
  tableCards,
  uiPhase,
  displayTrumpCard,
  deckCount,
  isStreamerTurn,
  isChatTurn,
  canEndAttack,
  canBeat,
  canTake,
  selectCard,
  playSelected,
  endAttack,
  beatRound,
  takeRound,
  newGame,
  chatPlay,
} = useDurakLocalGame()

const canPlaySelected = computed(() => {
  if (!selectedCardId.value) return false
  if (!isStreamerTurn.value) return false
  const ph = snapshot.value.phase
  return ph === 'attack' || ph === 'defend'
})

const statusError = computed(() => {
  const key = snapshot.value.lastErrorKey
  if (!key) return ''
  return te(key) ? t(key) : key
})

const turnHint = computed(() => (isStreamerTurn.value ? t('durak.turnLocal') : t('durak.turnOpponent')))

const rosterLine = computed(() =>
  t('durak.table.rosterLine', {
    n: props.rosterPlayerCount,
  }),
)
</script>

<template>
  <div class="durak-table-section">
    <div class="durak-table-section__toolbar">
      <AppButton variant="ghost" class="durak-table-section__back" @click="emit('back')">
        {{ t('durak.table.backToLobby') }}
      </AppButton>
      <p class="durak-table-section__roster">{{ rosterLine }}</p>
      <p class="durak-table-section__hint">{{ t('durak.table.localTwoSeatHint') }}</p>
    </div>

    <div class="durak-table-section__arena">
      <div class="durak-table-section__felt">
        <div class="durak-table-section__felt-glow" aria-hidden="true" />

        <section
          class="durak-table-section__row durak-table-section__row--top"
          :aria-label="t('durak.aria.opponentRegion')"
        >
          <DurakPlayerPanel
            class="durak-table-section__panel"
            :name="t('durak.roleChat')"
            :card-count="chatHand.length"
            role="chat"
            :is-active="isChatTurn"
            :is-their-turn="isChatTurn"
          />
          <DurakHand
            class="durak-table-section__hand durak-table-section__hand--opponent"
            :cards="chatHand"
            hidden
            :size="'md'"
          />
        </section>

        <section
          class="durak-table-section__row durak-table-section__row--center"
          :aria-label="t('durak.aria.tableRegion')"
        >
          <DurakTable
            :table-cards="tableCards"
            :trump-card="displayTrumpCard"
            :deck-count="deckCount"
            :phase="uiPhase"
          />
        </section>

        <section class="durak-table-section__status" role="status">
          <p class="durak-table-section__phase-line">{{ t(`durak.phase.${uiPhase}`) }}</p>
          <p class="durak-table-section__turn-line">
            <span class="durak-table-section__turn-dot" :class="{ 'durak-table-section__turn-dot--on': isStreamerTurn }" />
            {{ turnHint }}
          </p>
          <p v-if="statusError" class="durak-table-section__error">{{ statusError }}</p>
          <div class="durak-table-section__actions">
            <AppButton variant="primary" :disabled="!canPlaySelected" @click="playSelected">
              {{ t('durak.actions.playCard') }}
            </AppButton>
            <AppButton :disabled="!canEndAttack" @click="endAttack">
              {{ t('durak.actions.endAttack') }}
            </AppButton>
            <AppButton :disabled="!canBeat" @click="beatRound">
              {{ t('durak.actions.beat') }}
            </AppButton>
            <AppButton :disabled="!canTake" @click="takeRound">
              {{ t('durak.actions.take') }}
            </AppButton>
            <AppButton :disabled="!isChatTurn" @click="chatPlay">
              {{ t('durak.actions.chatPlay') }}
            </AppButton>
            <AppButton variant="ghost" @click="newGame">{{ t('durak.actions.newGame') }}</AppButton>
          </div>
        </section>

        <section
          class="durak-table-section__row durak-table-section__row--bottom"
          :aria-label="t('durak.aria.yourHandRegion')"
        >
          <DurakHand
            class="durak-table-section__hand durak-table-section__hand--local"
            :cards="streamerHand"
            :hidden="false"
            selectable
            :selected-card-id="selectedCardId"
            size="lg"
            @select="selectCard"
          />
          <DurakPlayerPanel
            class="durak-table-section__panel"
            :name="t('durak.roleStreamer')"
            :card-count="streamerHand.length"
            role="streamer"
            :is-active="isStreamerTurn"
            :is-their-turn="isStreamerTurn"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.durak-table-section {
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-3, 0.75rem);
  min-width: 0;
}

.durak-table-section__toolbar {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0 var(--sa-space-1, 0.25rem);
  min-width: 0;
}

.durak-table-section__back {
  align-self: flex-start;
}

.durak-table-section__roster {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: rgba(167, 243, 208, 0.95);
}

.durak-table-section__hint {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.35;
  color: rgba(226, 232, 240, 0.55);
  max-width: 40rem;
}

.durak-table-section__arena {
  border-radius: var(--sa-radius-lg, 14px);
  padding: 3px;
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.45), rgba(99, 102, 241, 0.35), rgba(52, 211, 153, 0.25));
  box-shadow: 0 0 40px rgba(16, 185, 129, 0.12);
}

.durak-table-section__felt {
  position: relative;
  border-radius: calc(var(--sa-radius-lg, 14px) - 3px);
  background: radial-gradient(100% 100% at 50% 20%, #134e4a 0%, #042f2e 38%, #022c22 100%);
  border: 1px solid rgba(45, 212, 191, 0.25);
  padding: var(--sa-space-4, 1rem);
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-4, 1rem);
  overflow: hidden;
}

.durak-table-section__felt-glow {
  pointer-events: none;
  position: absolute;
  inset: -20%;
  background: radial-gradient(circle at 50% 40%, rgba(45, 212, 191, 0.08), transparent 55%);
}

.durak-table-section__row {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sa-space-3, 0.75rem);
}

.durak-table-section__row--top .durak-table-section__panel {
  order: -1;
}

.durak-table-section__row--bottom {
  flex-direction: column-reverse;
}

.durak-table-section__row--bottom .durak-table-section__panel {
  margin-top: var(--sa-space-2, 0.5rem);
}

.durak-table-section__hand {
  width: 100%;
}

.durak-table-section__hand--opponent {
  padding-top: var(--sa-space-2, 0.5rem);
}

.durak-table-section__hand--local {
  padding-bottom: var(--sa-space-2, 0.5rem);
}

.durak-table-section__row--center {
  flex: 1;
  min-height: 0;
}

.durak-table-section__status {
  text-align: center;
  padding: var(--sa-space-2, 0.5rem) var(--sa-space-3, 0.75rem);
  border-radius: var(--sa-radius-md, 10px);
  background: color-mix(in srgb, #0f172a 72%, transparent);
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.durak-table-section__phase-line {
  margin: 0 0 0.25rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(167, 243, 208, 0.95);
}

.durak-table-section__turn-line {
  margin: 0 0 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #a7f3d0;
}

.durak-table-section__error {
  margin: 0 0 0.5rem;
  font-size: 0.78rem;
  color: #fecaca;
  line-height: 1.35;
}

.durak-table-section__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: center;
  align-items: center;
}

.durak-table-section__turn-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: rgba(52, 211, 153, 0.35);
  box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.4);
  transition: background 0.2s ease;
}

.durak-table-section__turn-dot--on {
  background: #34d399;
  box-shadow: 0 0 12px rgba(52, 211, 153, 0.65);
}

.durak-table-section__panel {
  width: 100%;
  max-width: 22rem;
}

@media (min-width: 900px) {
  .durak-table-section__row--top,
  .durak-table-section__row--bottom {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-end;
  }

  .durak-table-section__row--top .durak-table-section__panel {
    order: 0;
    align-self: flex-start;
    max-width: 14rem;
  }

  .durak-table-section__row--bottom {
    flex-direction: row;
    align-items: flex-end;
  }

  .durak-table-section__row--bottom .durak-table-section__panel {
    margin-top: 0;
    max-width: 14rem;
  }

  .durak-table-section__hand {
    flex: 1;
    min-width: 0;
  }
}
</style>
