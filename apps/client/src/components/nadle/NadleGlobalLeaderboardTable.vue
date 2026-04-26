<script setup lang="ts">
export type NadleGlobalLbTab = 'wins' | 'streak' | 'rating'

export type NadleGlobalLeaderboardRowVm = {
  rowKey: string
  rank: number
  displayName: string
  avatarUrl: string | null
  score: number
  isSelf: boolean
  initials: string
}

const tab = defineModel<NadleGlobalLbTab>('tab', { required: true })

defineProps<{
  loading: boolean
  error: string | null
  rows: NadleGlobalLeaderboardRowVm[]
  scoreColumnHeader: string
  sectionAriaLabel: string
  title: string
  tabsAriaLabel: string
  tabWinsLabel: string
  tabStreakLabel: string
  tabRatingLabel: string
  /** Shown above the table on the streak tab when the server returns the viewer’s best streak. */
  selfStreakSummary: string | null
  loadingText: string
  emptyText: string
  colRank: string
  colPlayer: string
  youLabel: string
}>()
</script>

<template>
  <section class="nadle-page__global-lb" :aria-label="sectionAriaLabel">
    <h3 class="nadle-page__glb-title">{{ title }}</h3>
    <div class="nadle-page__glb-tabs" role="tablist" :aria-label="tabsAriaLabel">
      <button
        type="button"
        role="tab"
        class="nadle-page__glb-tab"
        :class="{ 'nadle-page__glb-tab--active': tab === 'wins' }"
        :aria-selected="tab === 'wins'"
        @click="tab = 'wins'"
      >
        {{ tabWinsLabel }}
      </button>
      <button
        type="button"
        role="tab"
        class="nadle-page__glb-tab"
        :class="{ 'nadle-page__glb-tab--active': tab === 'streak' }"
        :aria-selected="tab === 'streak'"
        @click="tab = 'streak'"
      >
        {{ tabStreakLabel }}
      </button>
      <button
        type="button"
        role="tab"
        class="nadle-page__glb-tab"
        :class="{ 'nadle-page__glb-tab--active': tab === 'rating' }"
        :aria-selected="tab === 'rating'"
        @click="tab = 'rating'"
      >
        {{ tabRatingLabel }}
      </button>
    </div>

    <p v-if="selfStreakSummary" class="nadle-page__glb-self-streak" aria-live="polite">{{ selfStreakSummary }}</p>

    <p v-if="error" class="nadle-page__glb-banner" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="nadle-page__glb-muted">{{ loadingText }}</p>
    <div v-else-if="rows.length === 0" class="nadle-page__glb-empty">
      <div class="nadle-page__glb-podium" aria-hidden="true">
        <span class="nadle-page__glb-podium-step">1</span>
        <span class="nadle-page__glb-podium-step">2</span>
        <span class="nadle-page__glb-podium-step">3</span>
      </div>
      <p class="nadle-page__glb-muted nadle-page__glb-muted--empty">{{ emptyText }}</p>
    </div>
    <div v-else class="nadle-page__glb-scroll">
      <table class="nadle-page__glb-table" :aria-label="scoreColumnHeader">
        <thead>
          <tr>
            <th scope="col" class="nadle-page__glb-th nadle-page__glb-th--rank">{{ colRank }}</th>
            <th scope="col" class="nadle-page__glb-th nadle-page__glb-th--player-col">{{ colPlayer }}</th>
            <th scope="col" class="nadle-page__glb-th nadle-page__glb-th--score">{{ scoreColumnHeader }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.rowKey"
            class="nadle-page__glb-tr"
            :class="{ 'nadle-page__glb-tr--self': row.isSelf }"
          >
            <td class="nadle-page__glb-td nadle-page__glb-td--rank">{{ row.rank }}</td>
            <td class="nadle-page__glb-td nadle-page__glb-td--player">
              <span class="nadle-page__glb-player">
                <img
                  v-if="row.avatarUrl"
                  class="nadle-page__glb-avatar"
                  :src="row.avatarUrl"
                  alt=""
                  width="28"
                  height="28"
                  referrerpolicy="no-referrer"
                />
                <span v-else class="nadle-page__glb-avatar nadle-page__glb-avatar--ph" aria-hidden="true">{{
                  row.initials
                }}</span>
                <span class="nadle-page__glb-name">{{ row.displayName }}</span>
                <span v-if="row.isSelf" class="nadle-page__glb-you">{{ youLabel }}</span>
              </span>
            </td>
            <td class="nadle-page__glb-td nadle-page__glb-td--score">{{ row.score }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
/* Mirrored from NadleStreamPage.vue (global LB); parent :deep rules kept until dedup pass. */
.nadle-page__global-lb {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-x: clip;
}

.nadle-page__global-lb :deep(.nadle-page__glb-scroll) {
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-surface) 22%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.nadle-page__glb-title {
  margin: 0 0 var(--sa-space-4);
  text-align: center;
  font-size: clamp(1.02rem, 3.4vw, 1.28rem);
  font-weight: 800;
  color: color-mix(in srgb, var(--sa-color-text-main) 82%, var(--sa-color-text-muted));
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.nadle-page__glb-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sa-space-2);
  margin-bottom: var(--sa-space-2);
  width: min(100%, 18rem);
}

.nadle-page__glb-tab {
  width: 100%;
  min-width: 0;
  text-align: center;
  border: 1px solid color-mix(in srgb, var(--sa-color-border) 82%, rgba(255, 255, 255, 0.12));
  background: color-mix(in srgb, var(--sa-color-surface-raised) 78%, transparent);
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

.nadle-page__glb-tab:hover {
  border-color: color-mix(in srgb, var(--sa-color-primary-border) 72%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-primary) 10%, var(--sa-color-surface-raised));
}

.nadle-page__glb-tab--active {
  background: color-mix(in srgb, var(--sa-color-primary) 30%, var(--sa-color-surface-raised));
  border-color: color-mix(in srgb, var(--sa-color-primary-border) 82%, var(--sa-color-border));
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 40%, transparent),
    0 0 18px color-mix(in srgb, var(--sa-color-primary) 12%, transparent);
}

.nadle-page__glb-self-streak {
  align-self: stretch;
  margin: 0 0 var(--sa-space-2);
  padding: 0.35rem 0.5rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 28%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-primary) 12%, var(--sa-color-surface));
  color: var(--sa-color-text-main);
  font-size: 0.74rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.35;
}

.nadle-page__glb-banner {
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

.nadle-page__glb-muted {
  margin: 0;
  font-size: 0.75rem;
  color: var(--sa-color-text-muted);
}

.nadle-page__global-lb > .nadle-page__glb-muted {
  align-self: stretch;
  text-align: center;
}

.nadle-page__glb-muted--empty {
  text-align: center;
  line-height: 1.4;
}

.nadle-page__glb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sa-space-2);
  padding: var(--sa-space-2) 0 var(--sa-space-1);
}

.nadle-page__glb-podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
}

.nadle-page__glb-podium-step {
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

.nadle-page__glb-podium-step:nth-child(1) {
  min-height: 2.6rem;
}

.nadle-page__glb-podium-step:nth-child(2) {
  min-height: 2.15rem;
}

.nadle-page__glb-podium-step:nth-child(3) {
  min-height: 1.85rem;
}

.nadle-page__glb-scroll {
  flex: 0 1 auto;
  align-self: stretch;
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  margin-top: var(--sa-space-1);
}

.nadle-page__glb-table {
  width: 100%;
  max-width: 100%;
  min-width: 13.5rem;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 0.72rem;
}

.nadle-page__glb-th {
  text-align: left;
  padding: 0.32rem 0.3rem;
  border-bottom: 1px solid color-mix(in srgb, var(--sa-color-border) 88%, rgba(255, 255, 255, 0.12));
  color: color-mix(in srgb, var(--sa-color-text-muted) 74%, var(--sa-color-text-main));
  font-weight: 700;
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.2;
  white-space: normal;
  overflow-wrap: anywhere;
  word-wrap: break-word;
  vertical-align: bottom;
  box-sizing: border-box;
}

.nadle-page__glb-th--rank {
  width: 24%;
  min-width: 3rem;
  text-align: center;
}

.nadle-page__glb-th--player-col {
  width: 48%;
  min-width: 0;
}

.nadle-page__glb-th--score {
  width: 28%;
  min-width: 4.75rem;
  text-align: right;
}

.nadle-page__glb-td {
  padding: 0.35rem 0.35rem;
  border-bottom: 1px solid color-mix(in srgb, var(--sa-color-border) 78%, transparent);
  vertical-align: middle;
}

.nadle-page__glb-tr:hover .nadle-page__glb-td {
  background: color-mix(in srgb, var(--sa-color-primary) 7%, transparent);
}

.nadle-page__glb-td--rank {
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--sa-color-text-muted);
}

.nadle-page__glb-td--player {
  min-width: 0;
}

.nadle-page__glb-td--score {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  color: var(--sa-color-text-main);
}

.nadle-page__glb-tr--self .nadle-page__glb-td {
  background: color-mix(in srgb, var(--sa-color-primary) 16%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--sa-color-primary) 18%, transparent),
    inset 0 -1px 0 color-mix(in srgb, var(--sa-color-primary) 8%, transparent);
}

.nadle-page__glb-tr--self .nadle-page__glb-td:first-child {
  border-radius: 6px 0 0 6px;
}

.nadle-page__glb-tr--self .nadle-page__glb-td:last-child {
  border-radius: 0 6px 6px 0;
}

.nadle-page__glb-player {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.nadle-page__glb-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--sa-color-border);
}

.nadle-page__glb-avatar--ph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--sa-color-primary) 18%, var(--sa-color-surface));
  color: var(--sa-color-text-main);
  font-size: 0.72rem;
  font-weight: 700;
}

.nadle-page__glb-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--sa-color-text-main);
  min-width: 0;
}

.nadle-page__glb-you {
  flex-shrink: 0;
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.08rem 0.3rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--sa-color-primary) 35%, transparent);
  color: var(--sa-color-text-strong);
  border: 1px solid color-mix(in srgb, var(--sa-color-primary-border) 78%, var(--sa-color-border));
}

@media (max-width: 1200px) {
  .nadle-page__glb-tabs {
    margin-inline: auto;
  }
}
</style>
