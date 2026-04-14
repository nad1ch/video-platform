<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: '' },
  cancelLabel: { type: String, default: '' },
})

const emit = defineEmits(['update:open', 'confirm', 'close'])

const panelRef = ref(null)
const titleId = `confirm-dlg-title-${Math.random().toString(36).slice(2, 9)}`
const descId = `confirm-dlg-desc-${Math.random().toString(36).slice(2, 9)}`

function close() {
  emit('close')
  emit('update:open', false)
}

function onConfirm() {
  emit('confirm')
  emit('update:open', false)
}

watch(
  () => props.open,
  (v) => {
    if (typeof document === 'undefined') return
    if (v) {
      document.body.style.overflow = 'hidden'
      nextTick(() => panelRef.value?.focus())
    } else {
      document.body.style.overflow = ''
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="confirm-dialog"
      role="presentation"
      @keydown.escape.prevent="close"
    >
      <button
        type="button"
        class="confirm-dialog__backdrop"
        :aria-label="cancelLabel"
        @click="close"
      />
      <div
        ref="panelRef"
        class="confirm-dialog__panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="descId"
        tabindex="-1"
        @click.stop
      >
        <h2 :id="titleId" class="confirm-dialog__title">{{ title }}</h2>
        <p :id="descId" class="confirm-dialog__message">{{ message }}</p>
        <div v-if="$slots.extra" class="confirm-dialog__extra">
          <slot name="extra" />
        </div>
        <div class="confirm-dialog__actions">
          <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="close">
            {{ cancelLabel }}
          </button>
          <button type="button" class="confirm-dialog__btn confirm-dialog__btn--primary" @click="onConfirm">
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-dialog {
  position: fixed;
  inset: 0;
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.confirm-dialog__backdrop {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: rgba(0, 0, 0, 0.62);
  cursor: pointer;
}

.confirm-dialog__panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 22rem;
  padding: 1.15rem 1.2rem 1rem;
  border-radius: var(--ui-radius-md, 12px);
  border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.14));
  background: var(--bg-panel, var(--bg-muted-strong, #1a1525));
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  outline: none;
}

.confirm-dialog__title {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-title, var(--text-heading));
}

.confirm-dialog__message {
  margin: 0 0 1.1rem;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--text-secondary, rgba(255, 255, 255, 0.75));
}

.confirm-dialog__extra {
  margin: 0 0 1rem;
}

.confirm-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: flex-end;
}

.confirm-dialog__btn {
  margin: 0;
  padding: 0.45rem 0.85rem;
  border-radius: var(--ui-radius-md, 8px);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.confirm-dialog__btn--ghost {
  border-color: var(--border-subtle);
  background: transparent;
  color: var(--text-muted);
}

.confirm-dialog__btn--ghost:hover {
  border-color: var(--border-strong);
  color: var(--text-heading);
}

.confirm-dialog__btn--primary {
  border-color: var(--border-cyan-strong, #5ee7df);
  background: linear-gradient(180deg, rgba(94, 231, 223, 0.18), rgba(94, 231, 223, 0.06));
  color: var(--text-title, #e8e4f0);
}

.confirm-dialog__btn--primary:hover {
  filter: brightness(1.08);
}

.confirm-dialog__btn:focus-visible {
  outline: 2px solid var(--border-cyan-strong, #5ee7df);
  outline-offset: 2px;
}
</style>
