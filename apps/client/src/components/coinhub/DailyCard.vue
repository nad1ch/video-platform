<script setup lang="ts">
import '@/styles/coinhub-design-system.css'

type DailyState = 'available' | 'locked' | 'cooldown'

const props = withDefaults(
  defineProps<{
    title: string
    tagLabel: string
    actionLabel?: string
    state?: DailyState
    detailLabel?: string
    stateLabelAvailable: string
    stateLabelLocked: string
    stateLabelCooldown: string
    /** Visual treatment: free = violet, subscriber = gold premium. */
    visualTier?: 'free' | 'subscriber'
  }>(),
  { state: 'available', actionLabel: undefined, visualTier: 'free' },
)

const emit = defineEmits<{
  open: []
}>()

function onPrimaryClick() {
  if (props.actionLabel) {
    emit('open')
  }
}
</script>

<template>
  <article
    :class="[
      'coinhub-daily coinhub-daily--game ch-ds-card ch-ds-card--interactive flex flex-col p-6',
      `coinhub-daily--tier-${visualTier}`,
      state === 'available' && 'coinhub-daily--interactive coinhub-daily--state-available',
      state === 'locked' && 'coinhub-daily--state-locked',
      state === 'cooldown' && 'coinhub-daily--state-cooldown',
    ]"
  >
    <div
      class="coinhub-daily__visual pointer-events-none relative mb-3 h-24 overflow-hidden rounded-[20px] border border-white/[0.06] sm:h-28"
      aria-hidden="true"
    >
      <div class="coinhub-daily__visual-bg absolute inset-0" />
      <div
        class="absolute inset-0 flex items-center justify-center"
      >
        <div
          :class="[
            'coinhub-daily__chest flex h-16 w-24 items-end justify-center sm:h-[4.5rem] sm:w-28',
            visualTier === 'subscriber' && 'coinhub-daily__chest--sub',
          ]"
        >
          <span class="coinhub-daily__chest-icon text-3xl sm:text-4xl">{{ visualTier === 'subscriber' ? '👑' : '📦' }}</span>
        </div>
      </div>
    </div>
    <p
      :class="[
        'ch-ds-text-label text-xs font-semibold uppercase tracking-wider',
        visualTier === 'subscriber' ? 'text-[#9CA3AF]' : 'text-[#9CA3AF]',
      ]"
    >
      {{ tagLabel }}
    </p>
    <h3 class="mt-1.5 text-base font-semibold leading-snug text-[#FFFFFF] sm:text-lg">
      {{ title }}
    </h3>
    <div
      v-if="state === 'available'"
      class="mt-1 flex min-h-[1.25rem] items-center gap-2"
    >
      <p
        :class="[
          'text-sm',
          visualTier === 'subscriber' ? 'text-amber-200/80' : 'text-violet-300/90',
        ]"
      >
        {{ stateLabelAvailable }}
      </p>
    </div>
    <div class="mt-4 min-h-[2.75rem]">
      <button
        v-if="state === 'available' && actionLabel"
        type="button"
        :class="[
          'w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          visualTier === 'subscriber'
            ? 'ch-ds-btn-gold focus-visible:outline-amber-300/80'
            : 'ch-ds-btn-purple focus-visible:outline-violet-300',
        ]"
        @click="onPrimaryClick"
      >
        {{ actionLabel }}
      </button>
      <div
        v-else-if="state === 'locked'"
        class="flex h-full min-h-[2.75rem] items-center justify-center rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 text-center text-sm font-medium text-slate-500"
      >
        {{ stateLabelLocked }}
      </div>
      <div
        v-else
        class="flex h-full min-h-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-center"
      >
        <span class="text-sm font-medium text-amber-400/90">{{ stateLabelCooldown }}</span>
        <span
          v-if="detailLabel"
          class="coinhub-daily-cd-timer font-semibold tabular-nums text-sm text-amber-300/95"
        >{{ detailLabel }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.coinhub-daily--game {
  position: relative;
}
.coinhub-daily__visual-bg {
  background: radial-gradient(ellipse 100% 80% at 50% 100%, rgba(100, 60, 180, 0.25) 0%, transparent 60%),
    linear-gradient(180deg, rgba(20, 16, 40, 0.95) 0%, rgba(4, 4, 12, 0.98) 100%);
}
.coinhub-daily--tier-subscriber .coinhub-daily__visual-bg {
  background: radial-gradient(ellipse 100% 80% at 50% 100%, rgba(255, 180, 60, 0.2) 0%, transparent 55%),
    linear-gradient(180deg, rgba(40, 24, 8, 0.9) 0%, rgba(8, 4, 2, 0.95) 100%);
}
.coinhub-daily__chest--sub .coinhub-daily__chest-icon {
  filter: drop-shadow(0 0 12px rgba(255, 200, 80, 0.35));
}
.coinhub-daily--state-locked {
  opacity: 0.58;
  filter: grayscale(0.1);
}
.coinhub-daily--state-cooldown {
  opacity: 0.9;
  filter: none;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03);
}
.coinhub-daily-cd-timer {
  text-shadow: 0 0 8px rgba(251, 191, 36, 0.22);
}
</style>
