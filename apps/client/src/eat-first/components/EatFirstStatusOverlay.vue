<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  gameId: string
  /** i18n key for the role pill */
  roleBadgeKey: string
  gamePhase: string
  timerDisplay: string
  /** Server-derived: host visible seat number (player count + 1). */
  hostDisplaySeat: number
  /** Current player count (0..11). */
  playerCount: number
  loading?: boolean
}>()

const { t } = useI18n()

const ariaLabel = computed(() => t('eatFirstCall.statusAria'))
</script>

<template>
  <div class="eat-first-status" role="status" :aria-label="ariaLabel">
    <div class="eat-first-status__row eat-first-status__row--title">
      <span class="eat-first-status__brand">{{ t('eatFirstCall.brand') }}</span>
      <span v-if="loading" class="eat-first-status__muted">…</span>
    </div>
    <div class="eat-first-status__row">
      <span class="eat-first-status__label">{{ t('eatFirstCall.gameId') }}</span>
      <code class="eat-first-status__code">{{ gameId || '—' }}</code>
    </div>
    <div class="eat-first-status__row">
      <span class="eat-first-status__label">{{ t('eatFirstCall.role') }}</span>
      <span class="eat-first-status__pill">{{ t(roleBadgeKey) }}</span>
    </div>
    <div class="eat-first-status__row">
      <span class="eat-first-status__label">{{ t('eatFirstCall.phase') }}</span>
      <span>{{ gamePhase }}</span>
    </div>
    <div class="eat-first-status__row">
      <span class="eat-first-status__label">{{ t('eatFirstCall.timer') }}</span>
      <span>{{ timerDisplay }}</span>
    </div>
    <div class="eat-first-status__row">
      <span class="eat-first-status__label">{{ t('eatFirstCall.seats') }}</span>
      <span>{{
        t('eatFirstCall.seatSummary', {
          hostSeat: hostDisplaySeat,
          players: playerCount,
          maxPlayers: 11,
        })
      }}</span>
    </div>
  </div>
</template>

<style scoped>
.eat-first-status {
  pointer-events: none;
  position: absolute;
  left: 12px;
  right: 12px;
  top: 12px;
  z-index: 44;
  max-width: min(420px, calc(100% - 24px));
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(12, 14, 22, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f4f5f8;
  font-size: 0.82rem;
  line-height: 1.35;
  backdrop-filter: blur(8px);
}

.eat-first-status__row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  margin-top: 4px;
}

.eat-first-status__row:first-child {
  margin-top: 0;
}

.eat-first-status__row--title {
  margin-bottom: 2px;
}

.eat-first-status__brand {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.eat-first-status__label {
  opacity: 0.72;
  min-width: 5.5rem;
}

.eat-first-status__code {
  font-size: 0.85em;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
}

.eat-first-status__pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(120, 160, 255, 0.25);
  border: 1px solid rgba(160, 190, 255, 0.35);
  font-weight: 600;
  font-size: 0.8rem;
}

.eat-first-status__muted {
  opacity: 0.5;
}
</style>
