<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppContainer from '@/components/ui/AppContainer.vue'
import { DURAK_DEMO_UI_STATE } from '../core/demoCards'
import DurakHand from '../components/DurakHand.vue'
import DurakTable from '../components/DurakTable.vue'
import DurakPlayerPanel from '../components/DurakPlayerPanel.vue'

const { t } = useI18n()

/** Local-only selection; replace with orchestrator-driven selection later. */
const selectedCardId = ref<string | null>(null)

const demo = DURAK_DEMO_UI_STATE

const localTurn = computed(() => demo.turn === 'local')
const opponentTurn = computed(() => demo.turn === 'opponent')

function onSelectCard(id: string) {
  selectedCardId.value = selectedCardId.value === id ? null : id
}
</script>

<template>
  <div class="durak-page">
    <AppContainer wide flush class="durak-page__container">
      <header class="durak-page__header">
        <h1 class="durak-page__title">{{ t('routes.durak') }}</h1>
        <p class="durak-page__subtitle">{{ t('durak.demoNotice') }}</p>
      </header>

      <div class="durak-page__arena">
        <div class="durak-page__felt">
          <div class="durak-page__felt-glow" aria-hidden="true" />

          <section class="durak-page__row durak-page__row--top" aria-label="Opponent">
            <DurakPlayerPanel
              class="durak-page__panel"
              :name="demo.opponentPlayer.name"
              :card-count="demo.opponentPlayer.cardCount"
              :role="demo.opponentPlayer.role"
              :is-active="opponentTurn"
              :is-their-turn="opponentTurn"
            />
            <DurakHand
              class="durak-page__hand durak-page__hand--opponent"
              :cards="demo.opponentHandPlaceholders"
              hidden
              :size="'md'"
            />
          </section>

          <section class="durak-page__row durak-page__row--center" aria-label="Table">
            <DurakTable
              :table-cards="demo.tableCards"
              :trump-card="demo.trumpCard"
              :deck-count="demo.deckCount"
              :phase="demo.phase"
            />
          </section>

          <section class="durak-page__status" role="status">
            <p class="durak-page__status-text">{{ demo.statusText }}</p>
            <p class="durak-page__turn-line">
              <span class="durak-page__turn-dot" :class="{ 'durak-page__turn-dot--on': localTurn }" />
              {{ localTurn ? t('durak.turnLocal') : t('durak.turnOpponent') }}
            </p>
          </section>

          <section class="durak-page__row durak-page__row--bottom" aria-label="Your hand">
            <DurakHand
              class="durak-page__hand durak-page__hand--local"
              :cards="demo.localHand"
              :hidden="false"
              selectable
              :selected-card-id="selectedCardId"
              size="lg"
              @select="onSelectCard"
            />
            <DurakPlayerPanel
              class="durak-page__panel"
              :name="demo.localPlayer.name"
              :card-count="demo.localPlayer.cardCount"
              :role="demo.localPlayer.role"
              :is-active="localTurn"
              :is-their-turn="localTurn"
            />
          </section>
        </div>
      </div>
    </AppContainer>
  </div>
</template>

<style scoped>
.durak-page {
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  background: radial-gradient(120% 80% at 50% 0%, #1e1b4b 0%, #0f172a 42%, #020617 100%);
  color: var(--sa-color-text-main, #f1f5f9);
}

.durak-page__container {
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-4, 1rem);
  padding-bottom: var(--sa-space-6, 1.5rem);
}

.durak-page__header {
  text-align: center;
  padding-top: var(--sa-space-2, 0.5rem);
}

.durak-page__title {
  margin: 0;
  font-size: clamp(1.35rem, 2.5vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(90deg, #e2e8f0, #a5b4fc);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.durak-page__subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.65);
}

.durak-page__arena {
  border-radius: var(--sa-radius-lg, 14px);
  padding: 3px;
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.45), rgba(99, 102, 241, 0.35), rgba(52, 211, 153, 0.25));
  box-shadow: 0 0 40px rgba(16, 185, 129, 0.12);
}

.durak-page__felt {
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

.durak-page__felt-glow {
  pointer-events: none;
  position: absolute;
  inset: -20%;
  background: radial-gradient(circle at 50% 40%, rgba(45, 212, 191, 0.08), transparent 55%);
}

.durak-page__row {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sa-space-3, 0.75rem);
}

.durak-page__row--top .durak-page__panel {
  order: -1;
}

.durak-page__row--bottom {
  flex-direction: column-reverse;
}

.durak-page__row--bottom .durak-page__panel {
  margin-top: var(--sa-space-2, 0.5rem);
}

.durak-page__hand {
  width: 100%;
}

.durak-page__hand--opponent {
  padding-top: var(--sa-space-2, 0.5rem);
}

.durak-page__hand--local {
  padding-bottom: var(--sa-space-2, 0.5rem);
}

.durak-page__row--center {
  flex: 1;
  min-height: 0;
}

.durak-page__status {
  text-align: center;
  padding: var(--sa-space-2, 0.5rem) var(--sa-space-3, 0.75rem);
  border-radius: var(--sa-radius-md, 10px);
  background: color-mix(in srgb, #0f172a 72%, transparent);
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.durak-page__status-text {
  margin: 0 0 0.35rem;
  font-size: 0.82rem;
  color: rgba(226, 232, 240, 0.8);
  line-height: 1.4;
}

.durak-page__turn-line {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #a7f3d0;
}

.durak-page__turn-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: rgba(52, 211, 153, 0.35);
  box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.4);
  transition: background 0.2s ease;
}

.durak-page__turn-dot--on {
  background: #34d399;
  box-shadow: 0 0 12px rgba(52, 211, 153, 0.65);
}

.durak-page__panel {
  width: 100%;
  max-width: 22rem;
}

@media (min-width: 900px) {
  .durak-page__row--top,
  .durak-page__row--bottom {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-end;
  }

  .durak-page__row--top .durak-page__panel {
    order: 0;
    align-self: flex-start;
    max-width: 14rem;
  }

  .durak-page__row--bottom {
    flex-direction: row;
    align-items: flex-end;
  }

  .durak-page__row--bottom .durak-page__panel {
    margin-top: 0;
    max-width: 14rem;
  }

  .durak-page__hand {
    flex: 1;
    min-width: 0;
  }
}
</style>
