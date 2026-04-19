<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { GARTIC_BRUSH_SIZES, GARTIC_TOOLBAR_COLORS } from './garticToolbarConstants'

const props = defineProps<{
  visible: boolean
  color: string
  brushSize: number
  mode: 'draw' | 'erase'
}>()

const emit = defineEmits<{
  'update:color': [value: string]
  'update:brushSize': [value: number]
  'update:mode': [value: 'draw' | 'erase']
}>()

const { t } = useI18n()

const colors = GARTIC_TOOLBAR_COLORS
const sizes = GARTIC_BRUSH_SIZES

const isDraw = computed(() => props.mode === 'draw')
const isErase = computed(() => props.mode === 'erase')

function setColor(c: string): void {
  emit('update:color', c)
  emit('update:mode', 'draw')
}

function setSize(s: number): void {
  emit('update:brushSize', s)
}

function setDraw(): void {
  emit('update:mode', 'draw')
}

function setErase(): void {
  emit('update:mode', 'erase')
}
</script>

<template>
  <div
    v-show="visible"
    class="pointer-events-auto w-max max-w-[min(100%,calc(100vw-1.25rem))] rounded-xl border border-slate-500/80 bg-slate-900/88 px-2 py-1 shadow-lg shadow-black/40 backdrop-blur-md"
    role="toolbar"
    :aria-label="t('garticShow.canvasTitle')"
  >
    <div class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <div class="flex items-center gap-0.5" role="group" :aria-label="t('garticShow.toolbarColorsAria')">
        <button
          v-for="c in colors"
          :key="c"
          type="button"
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition hover:scale-105 focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95 sm:h-8 sm:w-8"
          :class="
            isDraw && color.toLowerCase() === c.toLowerCase()
              ? 'border-cyan-300 ring-2 ring-cyan-400/60 ring-offset-1 ring-offset-slate-900/90'
              : c.toLowerCase() === '#ffffff'
                ? 'border-neutral-400'
                : 'border-slate-500'
          "
          :style="{ backgroundColor: c }"
          :title="c"
          :aria-pressed="Boolean(isDraw && color.toLowerCase() === c.toLowerCase())"
          @click="setColor(c)"
        >
          <span class="sr-only">{{ c }}</span>
        </button>
      </div>

      <div class="hidden h-5 w-px shrink-0 bg-slate-600 sm:block" aria-hidden="true" />

      <div class="flex items-center gap-0.5" role="group" :aria-label="t('garticShow.toolbarSizesAria')">
        <button
          v-for="s in sizes"
          :key="s"
          type="button"
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-slate-800/95 transition hover:border-cyan-500/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95 sm:h-8 sm:w-8"
          :class="
            brushSize === s
              ? isErase
                ? 'border-amber-400 ring-2 ring-amber-400/50 ring-offset-1 ring-offset-slate-900/90'
                : 'border-cyan-400 ring-2 ring-cyan-400/55 ring-offset-1 ring-offset-slate-900/90'
              : 'border-slate-600'
          "
          :aria-pressed="Boolean(brushSize === s)"
          :title="t('garticShow.toolbarSizeTitle', { n: s })"
          @click="setSize(s)"
        >
          <span
            class="rounded-full bg-slate-200"
            :style="{ width: `${Math.min(Math.max(s + 2, 5), 18)}px`, height: `${Math.min(Math.max(s + 2, 5), 18)}px` }"
          />
        </button>
      </div>

      <div class="hidden h-5 w-px shrink-0 bg-slate-600 sm:block" aria-hidden="true" />

      <div
        class="flex items-center gap-0.5 rounded-lg border border-slate-600/70 bg-slate-800/85 p-0.5"
        role="group"
        :aria-label="t('garticShow.toolbarModeAria')"
      >
        <button
          type="button"
          class="flex h-7 items-center gap-0.5 rounded-md px-2 py-0.5 text-[0.65rem] font-semibold transition hover:bg-slate-700/90 sm:h-8 sm:text-xs"
          :class="
            isDraw
              ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-300/40'
              : 'text-slate-300'
          "
          :aria-pressed="isDraw"
          @click="setDraw"
        >
          <span aria-hidden="true">✏️</span>
          {{ t('garticShow.toolDraw') }}
        </button>
        <button
          type="button"
          class="flex h-7 items-center gap-0.5 rounded-md px-2 py-0.5 text-[0.65rem] font-semibold transition hover:bg-slate-700/90 sm:h-8 sm:text-xs"
          :class="
            isErase
              ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-300/40'
              : 'text-slate-300'
          "
          :aria-pressed="isErase"
          @click="setErase"
        >
          <span aria-hidden="true">🧽</span>
          {{ t('garticShow.toolErase') }}
        </button>
      </div>
    </div>
  </div>
</template>
