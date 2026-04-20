<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { NADRAW_BRUSH_SIZES, NADRAW_TOOLBAR_COLORS, type NadrawCanvasTool } from './nadrawToolbarConstants'

const props = defineProps<{
  visible: boolean
  color: string
  brushSize: number
  tool: NadrawCanvasTool
}>()

const emit = defineEmits<{
  'update:color': [value: string]
  'update:brushSize': [value: number]
  'update:tool': [value: NadrawCanvasTool]
}>()

const { t } = useI18n()

const colors = NADRAW_TOOLBAR_COLORS
const sizes = NADRAW_BRUSH_SIZES

const colorInputRef = useTemplateRef<HTMLInputElement>('colorInputRef')

const isDraw = computed(() => props.tool === 'pencil')
const isErase = computed(() => props.tool === 'erase')

function setColor(c: string): void {
  emit('update:color', c)
  if (props.tool === 'erase') {
    emit('update:tool', 'pencil')
  }
}

function setSize(s: number): void {
  emit('update:brushSize', s)
}

function setTool(tool: NadrawCanvasTool): void {
  emit('update:tool', tool)
}

function onPickerInput(ev: Event): void {
  const v = (ev.target as HTMLInputElement).value
  if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) {
    emit('update:color', v.toLowerCase())
    if (props.tool === 'erase') {
      emit('update:tool', 'pencil')
    }
  }
}

function openPicker(): void {
  colorInputRef.value?.click()
}

function normalizeHex6(h: string): string {
  const raw = h.trim().replace(/^#/, '').toLowerCase()
  if (raw.length === 3) {
    return (
      '#' +
      raw
        .split('')
        .map((ch) => ch + ch)
        .join('')
    )
  }
  if (raw.length === 6) {
    return `#${raw}`
  }
  return h.trim().toLowerCase()
}

function colorBtnBorder(c: string): string {
  const low = c.toLowerCase()
  if (low === '#ffffff') {
    return 'border-[color:var(--border-strong,rgba(148,163,184,0.55))]'
  }
  return 'border-[color:var(--border-input,rgba(255,255,255,0.12))]'
}

function colorSelected(c: string): boolean {
  return normalizeHex6(props.color) === normalizeHex6(c)
}

const customSelected = computed(() => {
  const cur = normalizeHex6(props.color)
  return !colors.some((sw) => normalizeHex6(sw) === cur)
})
</script>

<template>
  <div
    v-show="visible"
    class="nadraw-toolbar pointer-events-auto w-full rounded-[var(--ui-container-panel-radius,var(--sa-radius-md))] border border-[color:var(--border,color-mix(in_srgb,var(--sa-color-primary)_22%,transparent))] bg-[color:var(--bg-muted,color-mix(in_srgb,var(--sa-color-surface)_78%,#0f172a))] px-2 py-1 shadow-[0_2px_14px_var(--shadow-elevated,rgba(0,0,0,0.45))] backdrop-blur-md sm:px-3 sm:py-1.5"
    role="toolbar"
    :aria-label="t('nadrawShow.canvasTitle')"
  >
    <div
      class="grid w-full min-w-0 gap-x-2 gap-y-1.5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-x-3"
    >
      <!-- Tools: icons only -->
      <div
        class="flex flex-wrap items-center gap-1 border-b border-[color:var(--border-subtle,rgba(255,255,255,0.08))] pb-1.5 lg:border-b-0 lg:pb-0"
        role="group"
        :aria-label="t('nadrawShow.toolbarToolsAria')"
      >
        <button
          type="button"
          class="nadraw-toolbar__icon-btn sa-chip-btn"
          :class="{ 'sa-chip-btn--on': tool === 'pencil' }"
          :aria-label="t('nadrawShow.toolPencilAria')"
          :aria-pressed="tool === 'pencil'"
          @click="setTool('pencil')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
            />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487L19.5 7.125" />
          </svg>
        </button>
        <button
          type="button"
          class="nadraw-toolbar__icon-btn sa-chip-btn"
          :class="{ 'sa-chip-btn--on': tool === 'erase' }"
          :aria-label="t('nadrawShow.toolEraseAria')"
          :aria-pressed="tool === 'erase'"
          @click="setTool('erase')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 21h8M5 3l-3 3 12 12 3-3L5 3z"
            />
          </svg>
        </button>
        <button
          type="button"
          class="nadraw-toolbar__icon-btn sa-chip-btn"
          :class="{ 'sa-chip-btn--on': tool === 'fill' }"
          :aria-label="t('nadrawShow.toolFillAria')"
          :aria-pressed="tool === 'fill'"
          @click="setTool('fill')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 4h6v2.2L19 10H5l4-3.8V4zM6 10h12v8a2 2 0 01-2 2h-8a2 2 0 01-2-2v-8z"
            />
            <path stroke-width="2" stroke-linecap="round" d="M9 14h6" />
          </svg>
        </button>
        <button
          type="button"
          class="nadraw-toolbar__icon-btn sa-chip-btn"
          :class="{ 'sa-chip-btn--on': tool === 'rect' }"
          :aria-label="t('nadrawShow.toolRectAria')"
          :aria-pressed="tool === 'rect'"
          @click="setTool('rect')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <rect x="4.5" y="5.5" width="15" height="13" rx="1.5" stroke-width="2" />
          </svg>
        </button>
        <button
          type="button"
          class="nadraw-toolbar__icon-btn sa-chip-btn"
          :class="{ 'sa-chip-btn--on': tool === 'ellipse' }"
          :aria-label="t('nadrawShow.toolEllipseAria')"
          :aria-pressed="tool === 'ellipse'"
          @click="setTool('ellipse')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <ellipse cx="12" cy="12" rx="8.5" ry="6" stroke-width="2" />
          </svg>
        </button>
      </div>

      <div
        class="flex min-w-0 flex-wrap content-center items-center gap-1"
        role="group"
        :aria-label="t('nadrawShow.toolbarColorsAria')"
      >
        <button
          v-for="c in colors"
          :key="c"
          type="button"
          class="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition hover:scale-105 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[color:var(--border-cyan-strong,rgba(56,189,248,0.65))] active:scale-95 sm:h-8 sm:w-8"
          :class="[
            colorBtnBorder(c),
            colorSelected(c)
              ? 'z-[1] scale-110 border-[color:var(--border-cyan-strong,rgba(34,211,238,0.95))] shadow-[0_0_0_2px_rgba(15,23,42,0.95),0_0_0_4px_rgba(34,211,238,0.9),0_0_14px_rgba(34,211,238,0.45)]'
              : '',
          ]"
          :style="{ backgroundColor: c }"
          :title="c"
          :aria-pressed="colorSelected(c)"
          @click="setColor(c)"
        >
          <span class="sr-only">{{ c }}</span>
        </button>
        <div class="relative flex h-7 w-7 shrink-0 items-center justify-center sm:h-8 sm:w-8">
          <input
            ref="colorInputRef"
            type="color"
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            :aria-label="t('nadrawShow.toolbarColorPickerAria')"
            :value="color.length === 7 ? color : '#000000'"
            @input="onPickerInput"
          />
          <button
            type="button"
            class="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-[color:var(--border-strong,rgba(167,139,250,0.5))] bg-[conic-gradient(from_0deg,red,orange,yellow,green,cyan,blue,violet,red)] transition hover:scale-105 focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan-400 sm:h-8 sm:w-8"
            :class="
              customSelected
                ? 'z-[1] scale-110 border-[color:var(--border-cyan-strong,rgba(34,211,238,0.95))] shadow-[0_0_0_2px_rgba(15,23,42,0.95),0_0_0_4px_rgba(34,211,238,0.9),0_0_14px_rgba(34,211,238,0.45)]'
                : ''
            "
            :title="t('nadrawShow.toolbarColorPickerAria')"
            :aria-label="t('nadrawShow.toolbarColorPickerAria')"
            @click="openPicker"
          >
            <span class="sr-only">{{ t('nadrawShow.toolbarColorPickerAria') }}</span>
          </button>
        </div>
      </div>

      <div
        class="flex min-w-0 items-center gap-0.5 border-t border-[color:var(--border-subtle,rgba(255,255,255,0.08))] pt-1.5 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0"
        role="group"
        :aria-label="t('nadrawShow.toolbarSizesAria')"
      >
        <button
          v-for="s in sizes"
          :key="s"
          type="button"
          class="sa-chip-btn !flex !h-8 !min-h-8 !w-8 !min-w-8 !shrink-0 !items-center !justify-center !rounded-full !p-0"
          :class="{
            'sa-chip-btn--on': brushSize === s && isDraw,
            '!ring-2 !ring-amber-400/65 !ring-offset-1 !ring-offset-[color:var(--bg-muted,#0f172a)]':
              brushSize === s && isErase,
          }"
          :aria-pressed="Boolean(brushSize === s)"
          :title="t('nadrawShow.toolbarSizeTitle', { n: s })"
          @click="setSize(s)"
        >
          <span
            class="rounded-full bg-[color:var(--text-heading,#f8fafc)]"
            :style="{
              width: `${Math.min(Math.max(Math.round(s * 1.35), 4), 20)}px`,
              height: `${Math.min(Math.max(Math.round(s * 1.35), 4), 20)}px`,
            }"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Square icon buttons: override compact chip padding/min-height so SVGs stay centered. */
.nadraw-toolbar__icon-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  min-width: 2.25rem;
  min-height: 2.25rem;
  max-width: 2.25rem;
  max-height: 2.25rem;
  padding: 0;
  flex-shrink: 0;
  line-height: 0;
  font-size: 0;
}

.nadraw-toolbar__icon-btn svg {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}
</style>
