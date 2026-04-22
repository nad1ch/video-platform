<script setup lang="ts">
import type { MafiaEliminationAvatarKind } from '@/utils/mafiaEliminationAvatarKind'

const props = withDefaults(
  defineProps<{
    kind: MafiaEliminationAvatarKind
  }>(),
  {},
)
</script>

<template>
  <svg
    v-if="props.kind === 'skull'"
    class="mafia-elimination-mark"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    fill="none"
    aria-hidden="true"
  >
    <circle class="m-bg" cx="32" cy="32" r="28" />
    <g class="m-stroke" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="32" cy="30" rx="10" ry="12" />
      <path d="M25 40h14" />
    </g>
    <circle class="m-socket" cx="25.5" cy="29" r="2.2" />
    <circle class="m-socket" cx="38.5" cy="29" r="2.2" />
  </svg>
  <svg
    v-else-if="props.kind === 'ghost'"
    class="mafia-elimination-mark"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    aria-hidden="true"
  >
    <circle class="m-bg" cx="32" cy="32" r="28" />
    <!-- Rounded top + tail; white fill, dark eye holes -->
    <path class="m-fill" d="M20 28A12 8 0 0 1 44 28L44 36C40 32 32 40 32 40S24 32 20 36Z" />
    <circle class="m-void" cx="25" cy="27" r="2.3" />
    <circle class="m-void" cx="39" cy="27" r="2.3" />
  </svg>
  <svg
    v-else
    class="mafia-elimination-mark"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    aria-hidden="true"
  >
    <circle class="m-bg" cx="32" cy="32" r="28" />
    <path class="m-fill" d="M28 12h8v16h16v8H36v16h-8V36H12v-8h16V12Z" />
  </svg>
</template>

<style scoped>
.mafia-elimination-mark {
  /* White-on-dark; works on any tile */
  --m-dead-fg: #f4f4f6;
  --m-dead-void: #12121a;
  display: block;
  width: min(40%, 5.75rem);
  height: min(40%, 5.75rem);
  max-width: 100%;
  max-height: 100%;
  margin: 0 auto;
  flex-shrink: 0;
  color: var(--m-dead-fg);
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.5));
}

.m-bg {
  fill: var(--m-dead-void);
  stroke: none;
}

.m-stroke {
  color: var(--m-dead-fg);
}

.m-fill {
  fill: var(--m-dead-fg);
  stroke: none;
}

.m-socket {
  fill: var(--m-dead-void);
  stroke: var(--m-dead-fg);
  stroke-width: 1.2;
}

.m-void {
  fill: var(--m-dead-void);
  stroke: none;
}
</style>
