<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, te } = useI18n()

const props = defineProps({
  gameTitle: { type: String, required: true },
  gameId: { type: String, required: true },
  gamePhase: { type: String, default: 'intro' },
  scenarioLabel: { type: String, default: '' },
  aliveCount: { type: Number, default: 0 },
  personalUrl: { type: String, default: '' },
  globalUrl: { type: String, default: '' },
})

const phaseLabel = computed(() => {
  const p = String(props.gamePhase || 'intro')
  const key = `gamePhase.${p}`
  return te(key) ? t(key) : p
})

const emit = defineEmits(['copy-personal', 'copy-global'])
</script>

<template>
  <header class="desk-header">
    <div class="desk-header-top">
      <div>
        <h1 class="desk-title">{{ gameTitle }}</h1>
        <p class="desk-sub">{{ t('desk.room') }} <code>{{ gameId }}</code></p>
      </div>
      <div class="desk-stats">
        <span class="pill">{{ t('desk.alive') }} <strong>{{ aliveCount }}</strong></span>
        <span class="pill">{{ t('desk.phase') }} <strong>{{ phaseLabel }}</strong></span>
        <span v-if="scenarioLabel" class="pill dim">{{ t('desk.scenario') }} {{ scenarioLabel }}</span>
      </div>
    </div>
    <details class="desk-overlay-links">
      <summary class="desk-overlay-links__summary">{{ t('desk.overlayLinksToggle') }}</summary>
      <div class="desk-copy-row">
        <div class="copy-block">
          <span class="copy-label">{{ t('desk.copyStreamer') }}</span>
          <p class="copy-url">{{ personalUrl }}</p>
          <button type="button" class="btn-copy" @click="emit('copy-personal')">{{ t('desk.copyBtn') }}</button>
        </div>
        <div class="copy-block">
          <span class="copy-label">{{ t('desk.copyAll') }}</span>
          <p class="copy-url">{{ globalUrl }}</p>
          <button type="button" class="btn-copy" @click="emit('copy-global')">{{ t('desk.copyBtn') }}</button>
        </div>
      </div>
    </details>
  </header>
</template>

<style scoped>
.desk-header {
  padding: 1.25rem 1.5rem;
  border-radius: 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-panel);
  box-shadow: 0 8px 32px var(--shadow-elevated);
  margin-bottom: 1.25rem;
}

.desk-header-top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 0.85rem;
}

.desk-overlay-links {
  margin: 0;
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--bg-muted) 55%, transparent);
}

.desk-overlay-links__summary {
  list-style: none;
  cursor: pointer;
  padding: 0.55rem 0.85rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  user-select: none;
}

.desk-overlay-links__summary::-webkit-details-marker {
  display: none;
}

.desk-overlay-links__summary::after {
  content: '▸';
  display: inline-block;
  margin-left: 0.45rem;
  transition: transform 0.15s ease;
  opacity: 0.75;
}

.desk-overlay-links[open] .desk-overlay-links__summary::after {
  transform: rotate(90deg);
}

.desk-overlay-links .desk-copy-row {
  padding: 0 0.65rem 0.75rem;
}

.desk-title {
  margin: 0 0 0.25rem;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-title);
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 0.02em;
}

.desk-sub {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.desk-sub code {
  font-size: 0.85em;
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  background: var(--bg-code);
  color: var(--text-heading);
}

.desk-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.pill {
  font-size: 0.72rem;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: var(--accent-fill-soft);
  border: 1px solid var(--border-strong);
  color: var(--text-heading);
}

.pill.dim {
  opacity: 0.85;
}

.pill strong {
  color: var(--text-main);
  text-transform: capitalize;
}

.desk-copy-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: stretch;
}

@media (max-width: 720px) {
  .desk-copy-row {
    grid-template-columns: 1fr;
  }
}

.copy-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 0.65rem 0.75rem;
  border-radius: 14px;
  background: var(--bg-muted);
  border: 1px solid var(--border-subtle);
}

.copy-label {
  display: block;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 0.35rem;
}

.copy-url {
  margin: 0 0 0.5rem;
  font-size: 0.68rem;
  line-height: 1.35;
  color: var(--text-code);
  word-break: break-all;
}

.btn-copy {
  padding: 0.35rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--accent-fill);
  color: var(--text-heading);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-copy:hover {
  background: var(--accent-fill-soft);
  filter: brightness(1.08);
}
</style>
