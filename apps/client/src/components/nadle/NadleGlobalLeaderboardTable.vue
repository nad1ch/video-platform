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
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-x: clip;
  height: 100%;
  padding: 17px 10px 0;
  box-sizing: border-box;
}

.nadle-page__global-lb :deep(.nadle-page__glb-scroll) {
  border-radius: 15.535px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(102, 56, 143, 0.05);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 8px 24px rgba(4, 1, 12, 0.12);
}

.nadle-page__glb-title {
  margin: 0 0 15px;
  text-align: center;
  font-family: "Climate Crisis", var(--sa-font-display);
  font-size: 16px;
  line-height: 18px;
  font-weight: 400;
  color: #ffffff;
  letter-spacing: 0;
}

.nadle-page__glb-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
  margin-bottom: 10px;
  width: 100%;
}

.nadle-page__glb-tab {
  width: 100%;
  min-width: 0;
  text-align: center;
  min-height: 27px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(102, 56, 143, 0.47);
  color: #ffffff;
  font-family: "Marmelad", var(--sa-font-main);
  font-size: 13px;
  font-weight: 400;
  text-transform: lowercase;
  letter-spacing: 0;
  line-height: 1.05;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0.25rem 0.45rem;
  border-radius: 15.535px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.nadle-page__glb-tab:hover {
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(102, 56, 143, 0.58);
}

.nadle-page__glb-tab--active {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.13), transparent 54%),
    rgba(146, 82, 206, 0.78);
  border-color: rgba(255, 255, 255, 0.36);
  color: #ffffff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 -1px 0 rgba(0, 0, 0, 0.16),
    0 0 0 1px rgba(186, 132, 255, 0.16),
    0 0 16px rgba(146, 82, 206, 0.24);
}

.nadle-page__glb-self-streak {
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 27px;
  margin: 0 0 10px;
  padding: 0 12px;
  border-radius: 15.535px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  background: rgba(102, 56, 143, 0.05);
  color: #ffffff;
  font-family: "Climate Crisis", var(--sa-font-display);
  font-size: 10px;
  font-weight: 400;
  line-height: 1.15;
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
  flex: 1 1 auto;
  align-self: stretch;
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  margin-top: 0;
  padding: 6px;
}

.nadle-page__glb-table {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0 4px;
  font-size: 10px;
}

.nadle-page__glb-th {
  text-align: left;
  padding: 0 6px 2px;
  border-bottom: 0;
  color: rgba(255, 255, 255, 0.86);
  font-family: "Marmelad", var(--sa-font-main);
  font-weight: 400;
  font-size: 10px;
  text-transform: none;
  letter-spacing: 0;
  line-height: 1.2;
  white-space: normal;
  overflow-wrap: anywhere;
  word-wrap: break-word;
  vertical-align: bottom;
  box-sizing: border-box;
}

.nadle-page__glb-th--rank {
  width: 38px;
  min-width: 0;
  text-align: center;
}

.nadle-page__glb-th--player-col {
  width: auto;
  min-width: 0;
}

.nadle-page__glb-th--score {
  width: 48px;
  min-width: 0;
  text-align: right;
}

.nadle-page__glb-td {
  height: 27px;
  padding: 0 6px;
  border-bottom: 0;
  background: rgba(102, 56, 143, 0.11);
  vertical-align: middle;
}

.nadle-page__glb-tr:hover .nadle-page__glb-td {
  background: rgba(102, 56, 143, 0.2);
}

.nadle-page__glb-td--rank {
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-family: "Coda Caption", var(--sa-font-mono);
  font-size: 12px;
  font-weight: 800;
  color: #ffffff;
}

.nadle-page__glb-td--player {
  min-width: 0;
}

.nadle-page__glb-td--score {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-family: "Coda Caption", var(--sa-font-mono);
  font-size: 12px;
  font-weight: 800;
  color: #ffd455;
}

.nadle-page__glb-tr--self .nadle-page__glb-td {
  background: #414d34;
  box-shadow: none;
}

.nadle-page__glb-tr--self .nadle-page__glb-td:first-child {
  border-radius: 15.535px 0 0 15.535px;
}

.nadle-page__glb-tr--self .nadle-page__glb-td:last-child {
  border-radius: 0 15.535px 15.535px 0;
}

.nadle-page__glb-tr .nadle-page__glb-td:first-child {
  border-radius: 15.535px 0 0 15.535px;
}

.nadle-page__glb-tr .nadle-page__glb-td:last-child {
  border-radius: 0 15.535px 15.535px 0;
}

.nadle-page__glb-player {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.nadle-page__glb-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 0;
}

.nadle-page__glb-avatar--ph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #d9d9d9;
  color: #2b1a3d;
  font-size: 8px;
  font-weight: 700;
}

.nadle-page__glb-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: "Marmelad", var(--sa-font-main);
  font-size: 10px;
  font-weight: 400;
  color: #ffffff;
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

@media (max-width: 520px) {
  .nadle-page__global-lb {
    padding: 14px 10px 0;
  }

  .nadle-page__glb-title {
    font-size: 15px;
  }

  .nadle-page__glb-tabs {
    gap: 4px;
  }

  .nadle-page__glb-tab {
    font-size: 9px;
    padding-inline: 0.2rem;
  }
}
</style>
