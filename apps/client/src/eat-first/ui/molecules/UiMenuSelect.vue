<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, required: true },
  ariaLabel: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  /** header = вузький тригер; block = на всю ширину рядка */
  variant: { type: String, default: 'block' },
})

const emit = defineEmits(['update:modelValue', 'change'])

const open = ref(false)
const rootEl = ref(null)

const displayLabel = computed(() => {
  const row = props.options.find((o) => o.value === props.modelValue)
  return row?.label ?? props.modelValue
})

function toggle() {
  if (props.disabled) return
  open.value = !open.value
}

function pick(value) {
  if (props.disabled || value === props.modelValue) {
    open.value = false
    return
  }
  emit('update:modelValue', value)
  emit('change', value)
  open.value = false
}

function onDocPointerDown(ev) {
  if (!open.value || !rootEl.value) return
  if (!rootEl.value.contains(ev.target)) open.value = false
}

function onGlobalKeydown(ev) {
  if (ev.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
  document.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
  <div
    ref="rootEl"
    class="ui-menu-select"
    :class="{ 'ui-menu-select--open': open, 'ui-menu-select--header': variant === 'header' }"
  >
    <button
      type="button"
      class="ui-menu-select__trigger"
      :class="{ 'ui-menu-select__trigger--header': variant === 'header' }"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <span class="ui-menu-select__value">{{ displayLabel }}</span>
      <span class="ui-menu-select__chev" aria-hidden="true">▾</span>
    </button>
    <Transition name="ui-menu-select-pop">
      <ul
        v-if="open"
        class="ui-menu-select__list"
        role="listbox"
        :aria-label="ariaLabel"
      >
        <li
          v-for="opt in options"
          :key="opt.value"
          role="option"
          class="ui-menu-select__opt"
          :class="{ 'ui-menu-select__opt--active': opt.value === modelValue }"
          :aria-selected="opt.value === modelValue"
          @click="pick(opt.value)"
        >
          {{ opt.label }}
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.ui-menu-select {
  position: relative;
  display: inline-block;
  min-width: 0;
  vertical-align: middle;
}

.ui-menu-select--open {
  z-index: var(--z-dropdown, 11950);
}

.ui-menu-select:not(.ui-menu-select--header) {
  display: block;
  width: 100%;
  max-width: 280px;
}

.ui-menu-select--header {
  max-width: 5rem;
}

.ui-menu-select__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  width: 100%;
  min-height: 2.25rem;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-heading);
  font-size: 0.85rem;
  font-weight: 700;
  font-family: var(--font-body);
  cursor: pointer;
  text-align: left;
  box-sizing: border-box;
}

.ui-menu-select__trigger--header {
  min-height: auto;
  padding: 6px 8px;
  font-size: 0.68rem;
  font-weight: 800;
  font-family: var(--font-display, 'Orbitron', sans-serif);
  letter-spacing: 0.06em;
}

.ui-menu-select__trigger:hover:not(:disabled) {
  border-color: var(--border-strong);
  box-shadow: 0 0 14px var(--accent-glow);
}

.ui-menu-select__trigger:focus-visible {
  outline: 2px solid var(--border-strong);
  outline-offset: 2px;
}

.ui-menu-select__trigger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ui-menu-select__value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-menu-select__chev {
  flex-shrink: 0;
  font-size: 0.65rem;
  opacity: 0.75;
  transition: transform 0.18s ease;
}

.ui-menu-select--open .ui-menu-select__chev {
  transform: rotate(-180deg);
}

.ui-menu-select__list {
  position: absolute;
  z-index: 2;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  min-width: 100%;
  margin: 0;
  padding: 0.28rem;
  list-style: none;
  border-radius: 12px;
  border: 1px solid var(--border-strong);
  background: var(--bg-dropdown, var(--bg-card-solid));
  box-shadow:
    0 10px 32px var(--shadow-deep),
    0 0 0 1px var(--border-subtle),
    0 1px 0 rgba(255, 255, 255, 0.04);
  max-height: min(16rem, 50vh);
  overflow-y: auto;
}

.ui-menu-select--header .ui-menu-select__list {
  right: auto;
  min-width: 6.5rem;
}

.ui-menu-select__opt {
  padding: 0.42rem 0.55rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-body);
  cursor: pointer;
}

.ui-menu-select__opt:hover,
.ui-menu-select__opt:focus-visible {
  background: var(--accent-fill-soft);
  color: var(--text-title);
  outline: none;
}

.ui-menu-select__opt--active {
  background: var(--accent-fill);
  color: var(--text-title);
}

.ui-menu-select-pop-enter-active,
.ui-menu-select-pop-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.ui-menu-select-pop-enter-from,
.ui-menu-select-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
