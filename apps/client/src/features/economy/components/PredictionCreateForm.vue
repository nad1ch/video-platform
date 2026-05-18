<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

const props = defineProps<{
  streamerId: string
  busy: boolean
  errorMessage: string | null
}>()

const emit = defineEmits<{
  (
    e: 'submit',
    payload: {
      streamerId: string
      title: string
      options: string[]
      durationMs: number
      minStake: number
      maxStake: number
    },
  ): void
}>()

const form = reactive({
  title: '',
  durationMin: 5,
  minStake: 10,
  maxStake: 1000,
})
const optionsText = ref('Yes\nNo')

const options = computed(() =>
  optionsText.value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
)

const canSubmit = computed(
  () =>
    !props.busy &&
    form.title.trim().length > 0 &&
    options.value.length >= 2 &&
    options.value.length <= 6 &&
    form.minStake >= 1 &&
    form.maxStake >= form.minStake &&
    form.durationMin >= 1,
)

function submit(): void {
  if (!canSubmit.value) return
  emit('submit', {
    streamerId: props.streamerId,
    title: form.title.trim(),
    options: options.value,
    durationMs: form.durationMin * 60 * 1000,
    minStake: form.minStake,
    maxStake: form.maxStake,
  })
}
</script>

<template>
  <form
    class="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0c0719]/60 p-4"
    @submit.prevent="submit"
  >
    <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">
      New prediction
    </h3>
    <label class="flex flex-col gap-1 text-xs text-slate-400">
      Title
      <input
        v-model="form.title"
        type="text"
        maxlength="160"
        class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/40"
        placeholder="Who wins this round?"
      />
    </label>
    <label class="flex flex-col gap-1 text-xs text-slate-400">
      Options (one per line, 2–6)
      <textarea
        v-model="optionsText"
        rows="3"
        class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/40"
      />
    </label>
    <div class="grid grid-cols-3 gap-2">
      <label class="flex flex-col gap-1 text-xs text-slate-400">
        Duration (min)
        <input
          v-model.number="form.durationMin"
          type="number"
          min="1"
          class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/40"
        />
      </label>
      <label class="flex flex-col gap-1 text-xs text-slate-400">
        Min stake
        <input
          v-model.number="form.minStake"
          type="number"
          min="1"
          class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/40"
        />
      </label>
      <label class="flex flex-col gap-1 text-xs text-slate-400">
        Max stake
        <input
          v-model.number="form.maxStake"
          type="number"
          min="1"
          class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/40"
        />
      </label>
    </div>
    <p v-if="errorMessage" class="text-xs text-rose-300">{{ errorMessage }}</p>
    <button
      type="submit"
      class="self-start rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="!canSubmit"
    >
      {{ busy ? 'Creating…' : 'Create prediction' }}
    </button>
  </form>
</template>
