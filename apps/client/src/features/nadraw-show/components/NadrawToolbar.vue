<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import toolbarEraserFrameSrc from '@/assets/nadraw-show/toolbar-eraser-frame.svg'
import toolbarFillSrc from '@/assets/nadraw-show/toolbar-fill.svg'
import toolbarPencilSrc from '@/assets/nadraw-show/toolbar-pencil.svg'
import toolbarRedoSrc from '@/assets/nadraw-show/toolbar-redo.svg'
import toolbarResetSrc from '@/assets/nadraw-show/toolbar-reset.svg'
import toolbarUndoSrc from '@/assets/nadraw-show/toolbar-undo.svg'
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
  undo: []
  redo: []
  resetGame: []
}>()

const { t } = useI18n()

const colors = NADRAW_TOOLBAR_COLORS
const sizes = NADRAW_BRUSH_SIZES

const colorInputRef = useTemplateRef<HTMLInputElement>('colorInputRef')

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

function colorSelected(c: string): boolean {
  return normalizeHex6(props.color) === normalizeHex6(c)
}

const customSelected = computed(() => {
  const cur = normalizeHex6(props.color)
  return !colors.some((sw) => normalizeHex6(sw) === cur)
})

const sizeMin = sizes[0]
const sizeMax = sizes[sizes.length - 1]

const sizeProgress = computed(() => {
  const span = sizeMax - sizeMin
  if (span <= 0) {
    return 0
  }
  const raw = (props.brushSize - sizeMin) / span
  return Math.min(1, Math.max(0, raw))
})

const sizeThumbDiameter = computed(() => {
  // Visual preview follows brush size: small on left, larger on right.
  const minPx = 8
  const maxPx = 20
  return Math.round(minPx + (maxPx - minPx) * sizeProgress.value)
})

function onSizeInput(ev: Event): void {
  const n = Number((ev.target as HTMLInputElement).value)
  if (Number.isFinite(n)) {
    setSize(Math.round(n))
  }
}
</script>

<template>
  <div
    v-show="visible"
    class="nadraw-toolbar"
    role="toolbar"
    :aria-label="t('nadrawShow.canvasTitle')"
  >
    <div class="nadraw-toolbar__tools" role="group" :aria-label="t('nadrawShow.toolbarToolsAria')">
        <button
          type="button"
        class="nadraw-toolbar__tool sa-glass-button"
        :class="{ 'nadraw-toolbar__tool--on': tool === 'pencil' }"
          :aria-label="t('nadrawShow.toolPencilAria')"
          :aria-pressed="tool === 'pencil'"
          @click="setTool('pencil')"
        >
          <img class="nadraw-toolbar__icon nadraw-toolbar__icon--pencil" :src="toolbarPencilSrc" alt="" aria-hidden="true" />
        </button>
        <button
          type="button"
        class="nadraw-toolbar__tool nadraw-toolbar__tool--frame sa-glass-button"
        :class="{ 'nadraw-toolbar__tool--on': tool === 'erase' }"
          :aria-label="t('nadrawShow.toolEraseAria')"
          :aria-pressed="tool === 'erase'"
          @click="setTool('erase')"
        >
          <img class="nadraw-toolbar__frame-img" :src="toolbarEraserFrameSrc" alt="" aria-hidden="true" />
        </button>
        <button
          type="button"
        class="nadraw-toolbar__tool sa-glass-button"
        :class="{ 'nadraw-toolbar__tool--on': tool === 'fill' }"
          :aria-label="t('nadrawShow.toolFillAria')"
          :aria-pressed="tool === 'fill'"
          @click="setTool('fill')"
        >
          <img class="nadraw-toolbar__icon nadraw-toolbar__icon--fill" :src="toolbarFillSrc" alt="" aria-hidden="true" />
        </button>
      </div>

    <div class="nadraw-toolbar__colors" role="group" :aria-label="t('nadrawShow.toolbarColorsAria')">
        <button
          v-for="c in colors"
          :key="c"
          type="button"
        class="nadraw-toolbar__swatch"
        :class="{ 'nadraw-toolbar__swatch--on': colorSelected(c) }"
          :style="{ backgroundColor: c }"
          :title="c"
          :aria-pressed="colorSelected(c)"
          @click="setColor(c)"
        >
          <span class="sr-only">{{ c }}</span>
        </button>
      <div class="nadraw-toolbar__custom-wrap">
          <input
            ref="colorInputRef"
            type="color"
          class="nadraw-toolbar__color-input"
            :aria-label="t('nadrawShow.toolbarColorPickerAria')"
            :value="color.length === 7 ? color : '#000000'"
            @input="onPickerInput"
          />
          <button
            type="button"
          class="nadraw-toolbar__swatch nadraw-toolbar__swatch--rainbow"
          :class="{ 'nadraw-toolbar__swatch--on': customSelected }"
            :title="t('nadrawShow.toolbarColorPickerAria')"
            :aria-label="t('nadrawShow.toolbarColorPickerAria')"
            @click="openPicker"
          >
            <span class="sr-only">{{ t('nadrawShow.toolbarColorPickerAria') }}</span>
          </button>
        </div>
      </div>

    <div class="nadraw-toolbar__size" role="group" :aria-label="t('nadrawShow.toolbarSizesAria')">
      <span
        class="nadraw-toolbar__size-thumb"
        :style="{
          '--nadraw-size-progress': `${sizeProgress}`,
          '--nadraw-size-thumb': `${sizeThumbDiameter}px`,
        }"
        aria-hidden="true"
      />
      <input
        class="nadraw-toolbar__range"
        type="range"
        :min="sizes[0]"
        :max="sizes[sizes.length - 1]"
        :value="brushSize"
        :title="t('nadrawShow.toolbarSizeTitle', { n: brushSize })"
        @input="onSizeInput"
      />
    </div>

    <div class="nadraw-toolbar__history" role="group" aria-label="Game actions">
      <button
        type="button"
        class="nadraw-toolbar__history-btn sa-glass-button"
        :aria-label="t('nadrawShow.toolbarUndoAria')"
        @click="emit('undo')"
      >
        <img class="nadraw-toolbar__frame-img" :src="toolbarUndoSrc" alt="" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="nadraw-toolbar__history-btn sa-glass-button"
        :aria-label="t('nadrawShow.toolbarRedoAria')"
        @click="emit('redo')"
      >
        <img class="nadraw-toolbar__frame-img" :src="toolbarRedoSrc" alt="" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="nadraw-toolbar__history-btn nadraw-toolbar__history-btn--reset sa-glass-button"
        aria-label="Reset game"
        title="Reset game"
        @click="emit('resetGame')"
      >
        <img class="nadraw-toolbar__frame-img" :src="toolbarResetSrc" alt="" aria-hidden="true" />
      </button>
      </div>
  </div>
</template>

<style scoped>
.nadraw-toolbar {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 163px 46px 424px minmax(18px, 1fr) 233px 8px 172px;
  align-items: center;
  justify-content: start;
  gap: 0;
  width: 100%;
  height: 37px;
  padding: 0;
  color: #fff;
  pointer-events: auto;
}

.nadraw-toolbar__tools,
.nadraw-toolbar__history {
  display: flex;
  align-items: center;
}

.nadraw-toolbar__tools {
  grid-column: 1;
  gap: 8px;
}

.nadraw-toolbar__colors {
  grid-column: 3;
}

.nadraw-toolbar__size {
  grid-column: 5;
  margin-left: -10px;
}

.nadraw-toolbar__history {
  grid-column: 7;
  gap: 8px;
  width: 172px;
  box-sizing: border-box;
  padding-left: 12px;
}

.nadraw-toolbar__tool,
.nadraw-toolbar__history-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 49px;
  height: 37px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 20px;
  background: rgba(81, 48, 116, 0.78);
  color: #fff;
  cursor: pointer;
  transition:
    filter 0.16s ease,
    transform 0.16s ease,
    background 0.16s ease;
}

.nadraw-toolbar__history-btn {
  height: 34px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.04) 36%, rgba(255, 255, 255, 0) 68%),
    linear-gradient(140deg, rgba(124, 77, 219, 0.42), rgba(60, 36, 99, 0.4));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    inset 0 -1px 0 rgba(255, 255, 255, 0.06),
    0 10px 22px rgba(9, 2, 20, 0.26);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
  backdrop-filter: blur(18px) saturate(1.2);
  transform: translateY(0);
}

.nadraw-toolbar__tool {
  overflow: hidden;
}

.nadraw-toolbar__tool--frame {
  background: transparent;
}

.nadraw-toolbar__tool--on {
  background: rgba(81, 48, 116, 0.24);
}

.nadraw-toolbar__tool--frame.nadraw-toolbar__tool--on::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  background: rgba(81, 48, 116, 0.28);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
  pointer-events: none;
}

.nadraw-toolbar__tool--frame.nadraw-toolbar__tool--on .nadraw-toolbar__frame-img {
  filter: brightness(1.12);
}

.nadraw-toolbar__tool--on,
.nadraw-toolbar__tool:hover,
.nadraw-toolbar__history-btn:hover {
  filter: brightness(1.08);
}

.nadraw-toolbar__tool:active,
.nadraw-toolbar__history-btn:active {
  transform: scale(0.97);
}

.nadraw-toolbar__history-btn:active {
  transform: scale(0.97);
}

.nadraw-toolbar__tool:focus-visible,
.nadraw-toolbar__history-btn:focus-visible,
.nadraw-toolbar__swatch:focus-visible,
.nadraw-toolbar__range:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.86);
  outline-offset: 2px;
}

.nadraw-toolbar__icon,
.nadraw-toolbar__frame-img {
  display: block;
  pointer-events: none;
  user-select: none;
}

.nadraw-toolbar__icon--pencil {
  width: 21px;
  height: 21px;
  flex-shrink: 0;
}

.nadraw-toolbar__icon--fill {
  width: 26.268px;
  height: 28.012px;
  flex-shrink: 0;
}

.nadraw-toolbar__frame-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

.nadraw-toolbar__history-btn:first-child .nadraw-toolbar__frame-img {
  transform: scaleX(-1);
}

.nadraw-toolbar__colors {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 424px;
  height: 37px;
}

.nadraw-toolbar__swatch {
  position: relative;
  z-index: 2;
  display: inline-flex;
  width: 37px;
  height: 37px;
  flex: 0 0 37px;
  margin: 0;
  padding: 4px;
  border: 0;
  border-radius: 21px;
  background-clip: content-box;
  box-shadow: inset 0 0 0 4px rgba(81, 48, 116, 0.78);
  cursor: pointer;
  transition:
    transform 0.16s ease,
    filter 0.16s ease,
    box-shadow 0.16s ease;
}

.nadraw-toolbar__swatch--on {
  transform: scale(1.03);
  box-shadow:
    inset 0 0 0 4px rgba(81, 48, 116, 0.96),
    0 0 0 1px rgba(255, 255, 255, 0.62);
}

.nadraw-toolbar__swatch:hover {
  filter: brightness(1.08);
  transform: scale(1.04);
}

.nadraw-toolbar__swatch--rainbow {
  background-image: linear-gradient(
    180deg,
    rgb(237, 8, 8) 12.47%,
    rgb(245, 217, 0) 32.39%,
    rgb(124, 188, 3) 60.62%,
    rgb(1, 113, 213) 94.93%,
    rgb(6, 84, 185) 95.47%
  );
  background-color: transparent;
}

.nadraw-toolbar__custom-wrap {
  position: relative;
  display: inline-flex;
  width: 37px;
  height: 37px;
  flex: 0 0 37px;
}

.nadraw-toolbar__color-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  opacity: 0;
}

.nadraw-toolbar__size {
  box-sizing: border-box;
  position: relative;
  display: block;
  width: 233px;
  height: 37px;
  padding: 0;
  border-radius: 18.5px;
  overflow: hidden;
  background: rgba(81, 48, 116, 0.6);
}

.nadraw-toolbar__size::before {
  content: '';
  position: absolute;
  left: 14.163%;
  width: 67.811%;
  top: 50%;
  z-index: 1;
  height: 2px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.61);
  transform: translateY(-50%);
  pointer-events: none;
}

.nadraw-toolbar__size::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(circle 3px at 8.5% 50%, rgba(255, 255, 255, 0.96) 99%, transparent 100%),
    radial-gradient(circle 13.5px at 91.4% 50%, rgba(255, 255, 255, 0.96) 99%, transparent 100%);
}

.nadraw-toolbar__size-thumb {
  position: absolute;
  top: 50%;
  left: calc(
    14.163% + (var(--nadraw-size-progress, 0) * 67.811%)
  );
  z-index: 2;
  display: block;
  width: var(--nadraw-size-thumb, 8px);
  height: var(--nadraw-size-thumb, 8px);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 1px rgba(102, 56, 143, 0.45);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.nadraw-toolbar__range {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  margin: 0;
  appearance: none;
  cursor: pointer;
  opacity: 0;
}

.nadraw-toolbar__range::-webkit-slider-runnable-track {
  height: 37px;
  background: transparent;
}

.nadraw-toolbar__range::-webkit-slider-thumb {
  width: 27px;
  height: 27px;
  margin-top: 5px;
  border-radius: 999px;
  background: transparent;
  border: 0;
  appearance: none;
}

.nadraw-toolbar__range::-moz-range-track {
  height: 37px;
  background: transparent;
}

.nadraw-toolbar__range::-moz-range-thumb {
  width: 27px;
  height: 27px;
  border: 0;
  border-radius: 999px;
  background: transparent;
}

.nadraw-toolbar__history {
  justify-content: flex-end;
}

@media (max-width: 940px) {
  .nadraw-toolbar {
    grid-template-columns: 163px minmax(180px, 1fr) 172px;
    gap: 8px 10px;
    height: 82px;
    align-content: start;
  }

  .nadraw-toolbar__size {
    grid-column: 2;
    width: 100%;
  }

  .nadraw-toolbar__colors {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
  }

  .nadraw-toolbar__history {
    grid-column: 3;
  }

  .nadraw-toolbar__colors::-webkit-scrollbar {
    height: 4px;
  }

  .nadraw-toolbar__colors::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.28);
  }
}

@media (max-width: 560px) {
  .nadraw-toolbar {
    grid-template-columns: 163px 172px;
    justify-content: space-between;
    height: 127px;
  }

  .nadraw-toolbar__size {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
  }

  .nadraw-toolbar__colors {
    grid-row: 3;
  }

  .nadraw-toolbar__history {
    grid-column: 2;
  }
}
</style>
