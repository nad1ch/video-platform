<script setup lang="ts">
export type WordleGlobalLbTab = 'wins' | 'streak' | 'rating'

export type WordleGlobalLeaderboardRowVm = {
  rowKey: string
  rank: number
  displayName: string
  avatarUrl: string | null
  score: number
  isSelf: boolean
  initials: string
}

const tab = defineModel<WordleGlobalLbTab>('tab', { required: true })

defineProps<{
  loading: boolean
  error: string | null
  rows: WordleGlobalLeaderboardRowVm[]
  scoreColumnHeader: string
  sectionAriaLabel: string
  title: string
  tabsAriaLabel: string
  tabWinsLabel: string
  tabStreakLabel: string
  tabRatingLabel: string
  loadingText: string
  emptyText: string
  colRank: string
  colPlayer: string
  youLabel: string
}>()
</script>

<template>
  <section class="wordle-page__global-lb" :aria-label="sectionAriaLabel">
    <h3 class="wordle-page__glb-title">{{ title }}</h3>
    <div class="wordle-page__glb-tabs" role="tablist" :aria-label="tabsAriaLabel">
      <button
        type="button"
        role="tab"
        class="wordle-page__glb-tab"
        :class="{ 'wordle-page__glb-tab--active': tab === 'wins' }"
        :aria-selected="tab === 'wins'"
        @click="tab = 'wins'"
      >
        {{ tabWinsLabel }}
      </button>
      <button
        type="button"
        role="tab"
        class="wordle-page__glb-tab"
        :class="{ 'wordle-page__glb-tab--active': tab === 'streak' }"
        :aria-selected="tab === 'streak'"
        @click="tab = 'streak'"
      >
        {{ tabStreakLabel }}
      </button>
      <button
        type="button"
        role="tab"
        class="wordle-page__glb-tab"
        :class="{ 'wordle-page__glb-tab--active': tab === 'rating' }"
        :aria-selected="tab === 'rating'"
        @click="tab = 'rating'"
      >
        {{ tabRatingLabel }}
      </button>
    </div>

    <p v-if="error" class="wordle-page__glb-banner" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="wordle-page__glb-muted">{{ loadingText }}</p>
    <div v-else-if="rows.length === 0" class="wordle-page__glb-empty">
      <div class="wordle-page__glb-podium" aria-hidden="true">
        <span class="wordle-page__glb-podium-step">1</span>
        <span class="wordle-page__glb-podium-step">2</span>
        <span class="wordle-page__glb-podium-step">3</span>
      </div>
      <p class="wordle-page__glb-muted wordle-page__glb-muted--empty">{{ emptyText }}</p>
    </div>
    <div v-else class="wordle-page__glb-scroll">
      <table class="wordle-page__glb-table" :aria-label="scoreColumnHeader">
        <thead>
          <tr>
            <th scope="col" class="wordle-page__glb-th wordle-page__glb-th--rank">{{ colRank }}</th>
            <th scope="col" class="wordle-page__glb-th">{{ colPlayer }}</th>
            <th scope="col" class="wordle-page__glb-th wordle-page__glb-th--score">{{ scoreColumnHeader }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.rowKey"
            class="wordle-page__glb-tr"
            :class="{ 'wordle-page__glb-tr--self': row.isSelf }"
          >
            <td class="wordle-page__glb-td wordle-page__glb-td--rank">{{ row.rank }}</td>
            <td class="wordle-page__glb-td wordle-page__glb-td--player">
              <span class="wordle-page__glb-player">
                <img
                  v-if="row.avatarUrl"
                  class="wordle-page__glb-avatar"
                  :src="row.avatarUrl"
                  alt=""
                  width="28"
                  height="28"
                  referrerpolicy="no-referrer"
                />
                <span v-else class="wordle-page__glb-avatar wordle-page__glb-avatar--ph" aria-hidden="true">{{
                  row.initials
                }}</span>
                <span class="wordle-page__glb-name">{{ row.displayName }}</span>
                <span v-if="row.isSelf" class="wordle-page__glb-you">{{ youLabel }}</span>
              </span>
            </td>
            <td class="wordle-page__glb-td wordle-page__glb-td--score">{{ row.score }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
/* Mirrored from WordleStreamPage.vue (global LB); parent :deep rules kept until dedup pass. */
.wordle-page__global-lb {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Розділювач лише знизу рядка «ти» (.wordle-page__leader-row), без другого border-top — інакше дві лінії підряд. */
  padding-top: var(--sa-space-6);
  overflow-x: clip;
}

.wordle-page__glb-title {
  margin: 0 0 var(--sa-space-4);
  text-align: center;
  font-size: clamp(1.02rem, 3.4vw, 1.28rem);
  font-weight: 800;
  color: var(--sa-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.wordle-page__glb-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sa-space-2);
  margin-bottom: var(--sa-space-2);
  width: min(100%, 18rem);
}

.wordle-page__glb-tab {
  width: 100%;
  min-width: 0;
  text-align: center;
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 70%, transparent);
  color: var(--sa-color-text-main);
  font: inherit;
  font-weight: 600;
  font-size: 0.68rem;
  padding: 0.35rem 0.4rem;
  border-radius: var(--sa-radius-sm);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.wordle-page__glb-tab:hover {
  border-color: var(--sa-color-primary-border);
}

.wordle-page__glb-tab--active {
  background: color-mix(in srgb, var(--sa-color-primary) 22%, var(--sa-color-surface-raised));
  border-color: var(--sa-color-primary-border);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 35%, transparent);
}

.wordle-page__glb-banner {
  align-self: stretch;
  margin: 0;
  padding: var(--sa-space-1) var(--sa-space-2);
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-warning) 14%, var(--sa-color-surface));
  border: 1px solid var(--sa-color-border);
  color: var(--sa-color-text-main);
  font-size: 0.72rem;
  text-align: center;
}

.wordle-page__glb-muted {
  margin: 0;
  font-size: 0.75rem;
  color: var(--sa-color-text-muted);
}

.wordle-page__global-lb > .wordle-page__glb-muted {
  align-self: stretch;
  text-align: center;
}

.wordle-page__glb-muted--empty {
  text-align: center;
  line-height: 1.4;
}

.wordle-page__glb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sa-space-2);
  padding: var(--sa-space-2) 0 var(--sa-space-1);
}

.wordle-page__glb-podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
}

.wordle-page__glb-podium-step {
  flex: 1 1 0;
  max-width: 3.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--sa-radius-sm);
  border: 1px dashed var(--sa-color-border);
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--sa-color-text-muted);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 55%, transparent);
  opacity: 0.75;
}

.wordle-page__glb-podium-step:nth-child(1) {
  min-height: 2.6rem;
}

.wordle-page__glb-podium-step:nth-child(2) {
  min-height: 2.15rem;
}

.wordle-page__glb-podium-step:nth-child(3) {
  min-height: 1.85rem;
}

.wordle-page__glb-scroll {
  flex: 0 1 auto;
  align-self: stretch;
  width: 100%;
  min-width: 0;
  /* Лише вертикальний скрол: таблиця інколи на 1–2px ширша за контейнер і дає зайвий горизонтальний скрол. */
  overflow-x: hidden;
  overflow-y: auto;
  margin-top: var(--sa-space-1);
}

.wordle-page__glb-table {
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 0.72rem;
}

.wordle-page__glb-th {
  text-align: left;
  padding: 0.28rem 0.35rem;
  border-bottom: 1px solid var(--sa-color-border);
  color: var(--sa-color-text-muted);
  font-weight: 700;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.wordle-page__glb-th--rank {
  width: 2rem;
  text-align: center;
}

.wordle-page__glb-th--score {
  text-align: right;
  width: 3.25rem;
}

.wordle-page__glb-td {
  padding: 0.35rem 0.35rem;
  border-bottom: 1px solid color-mix(in srgb, var(--sa-color-border) 85%, transparent);
  vertical-align: middle;
}

.wordle-page__glb-td--rank {
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--sa-color-text-muted);
}

.wordle-page__glb-td--player {
  min-width: 0;
}

.wordle-page__glb-td--score {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  color: var(--sa-color-text-main);
}

.wordle-page__glb-tr--self .wordle-page__glb-td {
  background: color-mix(in srgb, var(--sa-color-primary) 10%, transparent);
}

.wordle-page__glb-tr--self .wordle-page__glb-td:first-child {
  border-radius: 6px 0 0 6px;
}

.wordle-page__glb-tr--self .wordle-page__glb-td:last-child {
  border-radius: 0 6px 6px 0;
}

.wordle-page__glb-player {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.wordle-page__glb-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--sa-color-border);
}

.wordle-page__glb-avatar--ph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--sa-color-primary) 18%, var(--sa-color-surface));
  color: var(--sa-color-text-main);
  font-size: 0.72rem;
  font-weight: 700;
}

.wordle-page__glb-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--sa-color-text-main);
  min-width: 0;
}

.wordle-page__glb-you {
  flex-shrink: 0;
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.08rem 0.3rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--sa-color-primary) 35%, transparent);
  color: var(--sa-color-text-strong);
  border: 1px solid var(--sa-color-primary-border);
}

@media (max-width: 1200px) {
  .wordle-page__glb-tabs {
    margin-inline: auto;
  }
}
</style>
