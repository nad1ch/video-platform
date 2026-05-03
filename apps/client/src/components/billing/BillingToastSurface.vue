<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import {
  dismissToast,
  resetBillingNotifierState,
  startBillingNotifier,
  stopBillingNotifier,
  useBillingNotifications,
  type BillingToast,
} from '@/composables/useBillingNotifications'

/**
 * Singleton toast surface for billing events. Mounted once at the App
 * root, so toasts appear on whichever page the user is currently on
 * (after admin approve/reject/cancel, after auto-match, after expiry).
 *
 * Polling is auth-gated: it starts only after the user is signed in and
 * stops on logout (so we never hammer `subscription/me` from landing or
 * auth pages, and so a logged-out tab cannot accidentally surface another
 * user's toasts on a shared device).
 */

const { isAuthenticated } = useAuth()
const { toasts } = useBillingNotifications()

watch(
  isAuthenticated,
  (authed, wasAuthed) => {
    if (authed) {
      startBillingNotifier()
    } else {
      stopBillingNotifier()
      
      if (wasAuthed) {
        resetBillingNotifierState()
      }
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  stopBillingNotifier()
})

function trackBy(toast: BillingToast): number {
  return toast.id
}
</script>

<template>
  <div
    class="billing-toasts"
    role="region"
    aria-live="polite"
    aria-label="Billing notifications"
  >
    <transition-group name="billing-toast" tag="div" class="billing-toasts__inner">
      <div
        v-for="toast in toasts"
        :key="trackBy(toast)"
        class="billing-toast"
        :class="`billing-toast--${toast.kind}`"
        role="status"
      >
        <div class="billing-toast__body">
          <p class="billing-toast__title">{{ toast.title }}</p>
          <p v-if="toast.message" class="billing-toast__message">
            {{ toast.message }}
          </p>
        </div>
        <button
          type="button"
          class="billing-toast__dismiss"
          aria-label="Закрити"
          @click="dismissToast(toast.id)"
        >
          ×
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.billing-toasts {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 9999;
  pointer-events: none;
  max-width: min(28rem, calc(100vw - 2rem));
}

.billing-toasts__inner {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.billing-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(8, 6, 18, 0.35);
  border: 1px solid transparent;
  background: #1a1d24;
  color: #f4f4f5;
}

.billing-toast--success {
  background: linear-gradient(135deg, rgba(48, 161, 78, 0.95), rgba(28, 100, 50, 0.95));
  border-color: rgba(48, 161, 78, 0.6);
}

.billing-toast--info {
  background: linear-gradient(135deg, rgba(34, 95, 179, 0.95), rgba(22, 60, 110, 0.95));
  border-color: rgba(34, 95, 179, 0.6);
}

.billing-toast--warning {
  background: linear-gradient(135deg, rgba(212, 138, 0, 0.95), rgba(140, 90, 0, 0.95));
  border-color: rgba(212, 138, 0, 0.6);
}

.billing-toast--error {
  background: linear-gradient(135deg, rgba(176, 36, 36, 0.95), rgba(110, 22, 22, 0.95));
  border-color: rgba(176, 36, 36, 0.6);
}

.billing-toast__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.billing-toast__title {
  margin: 0;
  font-weight: 700;
  font-size: 0.95rem;
}

.billing-toast__message {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.92;
  line-height: 1.4;
}

.billing-toast__dismiss {
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 6px;
  opacity: 0.85;
}

.billing-toast__dismiss:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.12);
}

.billing-toast-enter-active,
.billing-toast-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.billing-toast-enter-from {
  transform: translateY(8px);
  opacity: 0;
}

.billing-toast-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .billing-toast-enter-active,
  .billing-toast-leave-active {
    transition: opacity 0.15s ease;
  }
  .billing-toast-enter-from,
  .billing-toast-leave-to {
    transform: none;
  }
}
</style>
