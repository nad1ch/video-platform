<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoinHubStripRoll from '@/components/coinhub/CoinHubStripRoll.vue'
import '@/styles/coinhub-design-system.css'
import { buildCaseStripCells } from '@/utils/coinHub/coinHubStripMath'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    resolving: boolean
    rewardLine: string | null
  }>(),
  { rewardLine: null },
)

const emit = defineEmits<{
  'update:open': [open: boolean]
  close: []
}>()

const { t } = useI18n()

const step = ref<'hold' | 'roll' | 'done'>('hold')
const rollKey = ref(0)
const cells = ref<string[]>(['—'])
const land = ref(0)
const canDismiss = ref(false)

function close() {
  if (props.resolving) {
    return
  }
  if (step.value === 'roll' && !canDismiss.value) {
    return
  }
  emit('update:open', false)
  emit('close')
  step.value = 'hold'
  canDismiss.value = false
  rollKey.value = 0
  cells.value = ['—']
  land.value = 0
}

function onDocKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !props.open) {
    return
  }
  if (props.resolving) {
    return
  }
  if (step.value === 'roll' && !canDismiss.value) {
    return
  }
  e.preventDefault()
  close()
}

onMounted(() => document.addEventListener('keydown', onDocKey))
onUnmounted(() => document.removeEventListener('keydown', onDocKey))

watch(
  () => props.open,
  (o) => {
    if (o) {
      return
    }
    step.value = 'hold'
    canDismiss.value = false
    rollKey.value = 0
    cells.value = ['—']
    land.value = 0
  },
)

watch(
  () => [props.open, props.resolving, props.rewardLine] as const,
  () => {
    if (!props.open) {
      return
    }
    if (props.resolving) {
      step.value = 'hold'
      canDismiss.value = false
      return
    }
    if (props.rewardLine) {
      const b = buildCaseStripCells(props.rewardLine)
      rollKey.value += 1
      cells.value = b.cells
      land.value = b.landIndex
      step.value = 'roll'
    }
  },
  { flush: 'post' },
)

function onStripDone() {
  if (step.value === 'roll') {
    step.value = 'done'
    canDismiss.value = true
  }
}

function onBackdropClick() {
  if (canDismiss.value) {
    close()
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-show="open"
      class="coinhub-case-modal fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        class="absolute inset-0 bg-[#0B0E17]/90 backdrop-blur-md"
        aria-hidden="true"
        @click="onBackdropClick"
      />
      <div
        class="coinhub-case-modal__panel ch-ds-card relative z-10 flex w-full max-w-lg flex-col gap-4 rounded-[20px] border-0 p-5 sm:p-7"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.stop
      >
        <h2 class="ch-ds-text-section text-center">
          {{ title }}
        </h2>

        <div
          v-if="resolving"
          class="flex min-h-[8rem] flex-col items-center justify-center gap-3"
        >
          <span
            class="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-300"
            aria-hidden="true"
          />
          <p class="ch-ds-text-muted text-sm">
            {{ t('coinHub.caseOpening') }}
          </p>
        </div>

        <div v-else-if="rewardLine">
          <CoinHubStripRoll
            :key="`case-roll-${rollKey}`"
            :cells="cells"
            :land-index="land"
            :duration-ms="2800"
            :item-width-px="80"
            @complete="onStripDone"
          />
          <p
            v-if="step === 'done' && rewardLine"
            class="coinhub-open-reward mt-3 text-center text-sm font-bold tabular-nums text-[#FEF3C7]"
          >
            {{ rewardLine }}
          </p>
        </div>

        <div
          v-else
          class="min-h-[5rem]"
          aria-hidden="true"
        />

        <div class="flex justify-center">
          <button
            v-if="!resolving && rewardLine"
            type="button"
            class="ch-ds-btn-purple rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canDismiss"
            @click="close"
          >
            {{ t('coinHub.continue') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.coinhub-open-reward {
  display: inline-block;
  width: 100%;
  max-width: 20rem;
  margin-left: auto;
  margin-right: auto;
  border-radius: 9999px;
  border: 1px solid rgba(250, 204, 21, 0.35);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%),
    rgba(20, 24, 45, 0.75);
  color: #fef3c7;
  box-shadow:
    inset 0 0 28px rgba(250, 204, 21, 0.12),
    0 0 24px rgba(250, 204, 21, 0.25);
  padding: 0.5rem 1.25rem;
  text-shadow: 0 0 14px rgba(250, 204, 21, 0.35);
}
</style>
