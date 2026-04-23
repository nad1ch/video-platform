<script setup lang="ts">
import { computed } from 'vue'
import '@/styles/coinhub-design-system.css'

type CaseState = 'available' | 'locked' | 'cooldown'

const props = withDefaults(
  defineProps<{
    title?: string
    actionLabel: string
    /** Optional coin cost line (marketplace). */
    priceLabel?: string
    state?: CaseState
    stateLabelLocked: string
    stateLabelCooldown: string
    detailLabel?: string
    isRemoteBusy?: boolean
    /** 0=Common, 1=Rare (cyan), 2=Epic (violet), 3=Legendary (gold) */
    rarityId?: number
  }>(),
  {
    title: 'Case',
    priceLabel: undefined,
    state: 'available',
    isRemoteBusy: false,
    rarityId: 0,
  },
)

const rarityKey = computed(() => (['common', 'rare', 'epic', 'legendary'] as const)[props.rarityId % 4])

const isLegendary = computed(() => (props.rarityId % 4) === 3)

const emit = defineEmits<{
  open: []
}>()

function onSelectClick() {
  if (props.isRemoteBusy) {
    return
  }
  emit('open')
}
</script>

<template>
  <button
    v-if="state === 'available'"
    type="button"
    :class="[
      'coinhub-loot coinhub-loot-box coinhub-case ch-ds-card ch-ds-card--interactive group relative flex min-h-[10.5rem] w-full min-w-0 flex-col overflow-hidden rounded-[20px] border-0 p-0 text-left',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500/50',
      `coinhub-rarity--${rarityKey}`,
      isLegendary && 'coinhub-loot--legendary',
      isLegendary && 'coinhub-loot--legend-breathe',
      isLegendary && 'coinhub-loot--legend-float',
      isRemoteBusy && 'coinhub-case--remote-busy',
    ]"
    :aria-busy="isRemoteBusy"
    :aria-label="title"
    :disabled="isRemoteBusy"
    @click="onSelectClick"
  >
    <span
      class="coinhub-loot__shine pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      aria-hidden="true"
    />
    <div
      v-if="isLegendary"
      class="coinhub-loot__sparks pointer-events-none absolute inset-0 z-[4]"
      aria-hidden="true"
    >
      <span
        v-for="k in 4"
        :key="k"
        class="coinhub-loot__spark"
        :style="{
          '--ch-sp': `${0.1 + (k * 0.11) % 0.8}s`,
          '--ch-sx': `${(k * 47) % 90}%`,
          '--ch-sy': `${(k * 23) % 70}%`,
        }"
      />
    </div>
    <div
      class="coinhub-loot__lid relative z-[2] h-[42%] min-h-[4.25rem] border-b"
      :class="`coinhub-loot__lid--${rarityKey}`"
    >
      <div
        class="coinhub-loot__lid-gloss pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
      <div
        class="coinhub-loot__sweep pointer-events-none absolute inset-0 -translate-x-full opacity-0 group-hover:translate-x-full group-hover:opacity-100"
        aria-hidden="true"
      />
      <div
        class="coinhub-loot__sigil flex h-full items-center justify-center pt-0.5"
        aria-hidden="true"
      >
        <div
          :class="[
            'coinhub-case-icon-sigil flex h-14 w-14 items-center justify-center rounded-xl text-xl',
            isLegendary && 'coinhub-loot--legendary-sigil h-16 w-16 sm:text-2xl',
          ]"
        >
          ⬡
        </div>
      </div>
    </div>
    <div
      class="coinhub-loot__body relative z-[2] flex min-h-0 flex-1 flex-col gap-2.5 px-4 pb-4 pt-3 sm:px-5"
    >
      <p class="text-center text-sm font-bold leading-tight text-[#FFFFFF]">
        {{ title }}
      </p>
      <p
        v-if="priceLabel"
        class="text-center text-[0.7rem] font-semibold tabular-nums text-[#FBBF24]"
      >
        {{ priceLabel }}
      </p>
      <div class="mt-auto flex min-h-[2.5rem] flex-1 flex-col justify-end">
        <span
          :class="[
            'coinhub-case-cta w-full rounded-lg border py-2.5 text-center text-sm font-bold',
            isLegendary ? 'ch-ds-btn-gold py-3 text-base font-extrabold' : 'ch-ds-btn-purple',
          ]"
        >{{ actionLabel }}</span>
      </div>
    </div>
  </button>
  <div
    v-else
    :class="[
      'coinhub-loot coinhub-loot-box coinhub-loot--inactive ch-ds-card ch-ds-card--alt flex min-h-[10.5rem] flex-col overflow-hidden rounded-[20px] border-0 p-0',
      state === 'locked' && 'coinhub-loot--locked',
      state === 'cooldown' && 'coinhub-loot--cd',
    ]"
  >
    <div
      class="coinhub-loot__lid--muted relative h-[40%] min-h-[3.75rem] border-b border-[rgba(255,255,255,0.06)] bg-[rgba(15,18,32,0.5)]"
    >
      <div class="flex h-full items-center justify-center opacity-70">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(11,14,23,0.9)] text-lg text-[#6B7280] shadow-[inset_0_2px_6px_rgba(0,0,0,0.55)]"
        >
          ⬡
        </div>
      </div>
    </div>
    <div
      :class="[
        'flex flex-1 flex-col gap-3 px-5 pb-5 pt-4',
        state === 'locked' && 'coinhub-loot-body--locked',
        state === 'cooldown' && 'coinhub-loot-body--cd',
      ]"
    >
      <p
        :class="[
          'text-center text-sm font-semibold',
          state === 'locked' ? 'text-[#6B7280]' : 'text-[#9CA3AF]',
        ]"
      >
        {{ title }}
      </p>
      <div class="mt-auto flex flex-1 flex-col justify-end">
        <div
          v-if="state === 'locked'"
          class="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(11,14,23,0.6)] py-2.5 text-center text-sm font-medium text-[#6B7280]"
        >
          {{ stateLabelLocked }}
        </div>
        <div
          v-else
          class="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(11,14,23,0.5)] py-2.5 text-center text-sm text-[#9CA3AF]"
        >
          <span class="block font-medium text-[#9CA3AF]">{{ stateLabelCooldown }}</span>
          <span
            v-if="detailLabel"
            class="coinhub-case-timer mt-1 block font-semibold tabular-nums text-sm text-[#FBBF24]"
            >{{ detailLabel }}</span
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.coinhub-loot--legend-breathe {
  animation: coinhub-loot-legend-breathe 5s ease-in-out infinite;
}
.coinhub-loot--legend-float {
  animation: coinhub-legend-drift 4.2s ease-in-out infinite;
}
@keyframes coinhub-loot-legend-breathe {
  0%,
  100% {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      inset 0 0 52px rgba(124, 58, 237, 0.22),
      inset 0 -12px 34px rgba(0, 0, 0, 0.38),
      0 0 0 1px rgba(250, 200, 80, 0.16),
      0 16px 48px rgba(0, 0, 0, 0.74),
      0 0 60px -14px rgba(250, 190, 70, 0.3),
      0 0 72px -22px rgba(124, 58, 237, 0.22);
  }
  50% {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 0 58px rgba(250, 204, 21, 0.2),
      inset 0 -10px 30px rgba(0, 0, 0, 0.32),
      0 0 0 1px rgba(255, 230, 140, 0.28),
      0 20px 54px rgba(0, 0, 0, 0.78),
      0 0 76px -10px rgba(250, 210, 90, 0.42),
      0 0 88px -18px rgba(168, 85, 247, 0.18);
  }
}
@keyframes coinhub-legend-drift {
  0%,
  100% {
    margin-top: 0;
  }
  50% {
    margin-top: -3px;
  }
}
.coinhub-loot__spark {
  position: absolute;
  left: var(--ch-sx, 20%);
  top: var(--ch-sy, 20%);
  width: 2px;
  height: 2px;
  border-radius: 9999px;
  background: rgba(255, 248, 220, 0.95);
  box-shadow: 0 0 0 1px rgba(255, 210, 120, 0.35);
  opacity: 0;
  animation: coinhub-spark-twinkle 2.1s ease-in-out infinite;
  animation-delay: var(--ch-sp, 0s);
  pointer-events: none;
}
@keyframes coinhub-spark-twinkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.2);
  }
  20%,
  45% {
    opacity: 0.9;
    transform: scale(1.1);
  }
  60% {
    opacity: 0;
    transform: scale(0.3);
  }
}
.coinhub-loot-box {
  transition: transform 0.2s ease, box-shadow 0.22s ease, border-color 0.2s ease, filter 0.2s ease;
  cursor: pointer;
  border: 1px solid transparent;
  background-clip: padding-box;
  background-color: transparent;
  background-size: 100% 100%;
  background-image: none;
}
.coinhub-loot--inactive {
  cursor: default;
}
.coinhub-loot__shine {
  background: linear-gradient(125deg, transparent 35%, rgba(255, 255, 255, 0.12) 50%, transparent 65%);
  mix-blend-mode: screen;
}
.coinhub-loot__lid-gloss {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, transparent 55%);
  opacity: 0.45;
  mix-blend-mode: screen;
}
.coinhub-loot__sweep {
  z-index: 1;
  background: linear-gradient(105deg, transparent 0%, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.18) 50%, rgba(255, 255, 255, 0) 60%, transparent 100%);
  mix-blend-mode: screen;
  transition:
    transform 0.6s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;
  pointer-events: none;
}
.coinhub-loot__body {
  background: linear-gradient(180deg, rgba(8, 10, 22, 0.55) 0%, rgba(4, 5, 12, 0.92) 100%);
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.35);
}

/* Common — muted steel (glass + tint) */
.coinhub-rarity--common {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%),
    linear-gradient(168deg, rgb(20 24 32) 0%, rgb(8 10 16) 55%, rgb(4 5 9) 100%);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 0 52px rgba(124, 58, 237, 0.22),
    inset 0 -12px 36px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 16px 48px rgba(0, 0, 0, 0.72),
    0 0 56px -16px rgba(124, 58, 237, 0.32);
  border: 1px solid rgba(90, 100, 120, 0.55);
}
.coinhub-rarity--common .coinhub-loot__lid--common {
  border-color: rgba(50, 60, 75, 0.55);
  background: linear-gradient(180deg, rgba(32, 36, 44, 0.95) 0%, rgba(14, 16, 22, 0.98) 100%);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.45);
}
.coinhub-rarity--common .coinhub-case-icon-sigil {
  border: 1px solid rgba(80, 90, 105, 0.45);
  color: rgba(180, 190, 205, 0.8);
  background: linear-gradient(180deg, rgba(35, 40, 48, 0.9) 0%, rgb(10 12 16 / 0.96) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 8px rgba(0, 0, 0, 0.35);
}
/* Rare — cyan */
.coinhub-rarity--rare {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%),
    linear-gradient(168deg, rgb(8 20 32) 0%, rgb(4 8 16) 100%);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border: 1px solid rgba(34, 211, 238, 0.32);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 0 52px rgba(124, 58, 237, 0.18),
    inset 0 -12px 34px rgba(0, 0, 0, 0.38),
    0 0 0 1px rgba(6, 182, 212, 0.12),
    0 16px 48px rgba(0, 0, 0, 0.72),
    0 0 52px -14px rgba(6, 182, 212, 0.28),
    0 0 48px -18px rgba(124, 58, 237, 0.22);
}
.coinhub-rarity--rare .coinhub-loot__lid--rare {
  border-color: rgba(6, 182, 212, 0.25);
  background: linear-gradient(180deg, rgba(8, 40, 55, 0.85) 0%, rgb(4 12 24 / 0.96) 100%);
  box-shadow: inset 0 0 20px -6px rgba(6, 182, 212, 0.15);
}
.coinhub-rarity--rare .coinhub-case-icon-sigil {
  border: 1px solid rgba(34, 211, 238, 0.45);
  color: rgba(186, 250, 255, 0.95);
  background: linear-gradient(180deg, rgba(8, 45, 65, 0.9) 0%, rgb(4 10 20 / 0.96) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 4px 12px -4px rgba(0, 0, 0, 0.45);
}
/* Epic — violet */
.coinhub-rarity--epic {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%),
    linear-gradient(168deg, rgb(20 8 32) 0%, rgb(6 4 14) 100%);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border: 1px solid rgba(168, 85, 247, 0.38);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.09),
    inset 0 0 58px rgba(124, 58, 237, 0.28),
    inset 0 -12px 32px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(124, 58, 237, 0.15),
    0 16px 48px rgba(0, 0, 0, 0.75),
    0 0 64px -12px rgba(168, 85, 247, 0.4),
    0 0 48px -20px rgba(59, 130, 246, 0.12);
}
.coinhub-rarity--epic .coinhub-loot__lid--epic {
  border-color: rgba(168, 85, 247, 0.3);
  background: linear-gradient(180deg, rgba(50, 20, 80, 0.8) 0%, rgb(8 4 20 / 0.95) 100%);
  box-shadow: inset 0 0 24px -4px rgba(124, 58, 246, 0.2);
}
.coinhub-rarity--epic .coinhub-case-icon-sigil {
  border: 1px solid rgba(192, 132, 252, 0.5);
  color: rgb(237 220 255);
  background: linear-gradient(180deg, rgba(60, 25, 95, 0.88) 0%, rgb(8 4 20 / 0.97) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 4px 12px -4px rgba(0, 0, 0, 0.5);
}
/* Legendary — gold, dominates */
.coinhub-rarity--legendary,
.coinhub-loot--legendary {
  min-height: 12rem;
}
.coinhub-rarity--legendary {
  z-index: 1;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%),
    radial-gradient(90% 60% at 50% 0%, rgba(253, 224, 150, 0.12) 0%, transparent 55%),
    linear-gradient(155deg, rgb(50 32 8) 0%, rgb(12 8 4) 45%, rgb(4 2 1) 100%);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border: 1px solid rgba(253, 224, 150, 0.48);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 0 52px rgba(124, 58, 237, 0.2),
    inset 0 0 40px rgba(250, 200, 80, 0.08),
    inset 0 -12px 32px rgba(0, 0, 0, 0.42),
    0 0 0 1px rgba(250, 200, 80, 0.2),
    0 16px 48px rgba(0, 0, 0, 0.75),
    0 0 64px -12px rgba(250, 200, 80, 0.35),
    0 0 68px -22px rgba(124, 58, 237, 0.22);
  transform: scale(1.01);
  transform-origin: center top;
}
.coinhub-rarity--legendary .coinhub-loot__lid--legendary {
  border-color: rgba(251, 191, 36, 0.35);
  background: linear-gradient(180deg, rgba(90, 60, 20, 0.9) 0%, rgb(18 10 4 / 0.96) 100%);
  box-shadow: inset 0 0 32px -6px rgba(250, 204, 21, 0.2);
}
.coinhub-loot--legendary-sigil {
  border: 1px solid rgba(253, 224, 150, 0.55) !important;
  color: rgb(255 250 200);
  background: linear-gradient(180deg, rgba(120, 80, 20, 0.9) 0%, rgb(18 10 2 / 0.97) 100%) !important;
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.15), 0 6px 16px -4px rgba(0, 0, 0, 0.5) !important;
  animation: coinhub-legendary-pulse 2.4s ease-in-out infinite;
}
.coinhub-rarity--legendary:hover:enabled {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 0 58px rgba(250, 210, 80, 0.2),
    inset 0 0 48px rgba(124, 58, 237, 0.12),
    inset 0 -10px 30px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 240, 180, 0.38),
    0 20px 56px rgba(0, 0, 0, 0.8),
    0 0 80px -8px rgba(250, 210, 100, 0.48),
    0 0 96px -20px rgba(168, 85, 247, 0.25);
  transform: scale(1.01);
  filter: brightness(1.08) saturate(1.05);
}
@keyframes coinhub-legendary-pulse {
  0%,
  100% {
    box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.12), 0 0 0 1px rgba(255, 200, 90, 0.15);
  }
  50% {
    box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.16), 0 0 0 1px rgba(255, 210, 120, 0.22);
  }
}
@media (min-width: 1024px) {
  .coinhub-rarity--legendary {
    min-height: 13.5rem;
  }
}
.coinhub-case--remote-busy {
  opacity: 0.88;
  cursor: not-allowed;
  transform: none !important;
}
.coinhub-loot--locked {
  opacity: 0.7;
  filter: blur(0.4px) saturate(0.7);
  box-shadow: inset 0 0 0 1px rgb(15 23 42 / 0.45);
}
.coinhub-loot--cd {
  opacity: 0.92;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
.coinhub-loot-body--locked {
  filter: brightness(0.95);
}
.coinhub-case-timer {
  text-shadow: 0 0 10px rgba(251, 191, 36, 0.25);
}
@media (prefers-reduced-motion: reduce) {
  .coinhub-loot--legend-breathe,
  .coinhub-loot--legend-float {
    animation: none !important;
  }
  .coinhub-loot__spark {
    animation: none !important;
    opacity: 0;
  }
}
</style>
