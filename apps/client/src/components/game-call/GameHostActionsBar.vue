<script setup lang="ts">
/**
 * GameHostActionsBar — shared host-side action toolbar for game-call pages.
 *
 * Extracted from `MafiaHostActionsBar.vue` in Phase 5b so production Mafia
 * and the Game Template render the same toolbar. The component is
 * presentational only:
 *
 *   - state arrives via props (`muteAllActive`, `canReshuffle`, `swapActive`)
 *   - actions leave via emits (`set-mute-all`, `reshuffle`, `toggle-swap-mode`)
 *   - all locale strings arrive via the `labels` prop
 *
 * The component owns the reshuffle `<ConfirmDialog>` mounting because the
 * confirm step is part of the toolbar's UX, not the upstream protocol. The
 * dialog's text comes through `labels.reshuffleConfirm*`.
 *
 * Hard isolation: NO imports from any Mafia store, composable, signaling,
 * or i18n keys. Asset paths live under the neutral `@/assets/game-call/`
 * folder; the file names + variable bindings keep their `mafia*` prefix
 * to minimize diff (the SVG bytes are namespace-neutral and shared with
 * Mafia / Game Template / Eat First via the same components).
 */

import { computed, ref } from 'vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import mafiaHostMuteAllActive from '@/assets/game-call/host-mute-all-active.svg'
import mafiaHostMuteAll from '@/assets/game-call/host-mute-all.svg'
import mafiaHostRoles from '@/assets/game-call/host-roles.svg'

export interface GameHostActionsLabels {
  /** ARIA-label for the outer `<div role="toolbar">`. */
  toolbarAria: string
  /** Title + ARIA on the mute-all button (used for both on/off states). */
  muteAllTitle: string
  /** Title + ARIA on the reshuffle button when `canReshuffle === true`. */
  reshuffleTitle: string
  /** Title + ARIA on the reshuffle button when `canReshuffle === false`. */
  reshuffleDisabledHint: string
  /** Title on the swap-mode button. */
  swapModeTitle: string
  /** ARIA-label on the swap-mode button (independent of title). */
  swapModeAria: string
  /** ConfirmDialog: title. */
  reshuffleConfirmTitle: string
  /** ConfirmDialog: body. */
  reshuffleConfirmBody: string
  /** ConfirmDialog: confirm button. */
  reshuffleConfirmProceed: string
  /** ConfirmDialog: cancel button. */
  reshuffleConfirmCancel: string
}

const props = withDefaults(
  defineProps<{
    /** True when mute-all is visually active (server flag + everyone muted). */
    muteAllActive: boolean
    /** When true, the reshuffle button is enabled. */
    canReshuffle: boolean
    /** True when swap-mode is currently selected. */
    swapActive: boolean
    /**
     * When `false`, the swap-mode button is hidden and the container
     * collapses from the 3-button width (153 px) to the 2-button width
     * (104 px). Defaults to `true` so existing Mafia / Game Template
     * consumers are unaffected. Eat First passes `false` because the
     * generic swap-mode mechanic does not exist in the Eat First
     * protocol.
     */
    showSwap?: boolean
    /** Required i18n strings (component is locale-free). */
    labels: GameHostActionsLabels
  }>(),
  {
    showSwap: true,
  },
)

const emit = defineEmits<{
  /**
   * Emitted with the next-target mute-all value. Mafia routes this to the
   * `mafia:force-mute-all` WS payload (which carries the same boolean);
   * Game Template routes it to `demo.setMuteAll(muted)`.
   */
  'set-mute-all': [muted: boolean]
  /** Emitted only after the user confirms the dialog. */
  reshuffle: []
  /**
   * Emitted on swap button click. The adapter is responsible for choosing
   * the "off" target state (Mafia: 'night', Game Template: 'idle').
   */
  'toggle-swap-mode': []
}>()

const muteAllIcon = computed(() =>
  props.muteAllActive ? mafiaHostMuteAllActive : mafiaHostMuteAll,
)

/**
 * Local visibility for the reshuffle confirm dialog. `ConfirmDialog` writes
 * `false` here via `v-model:open` on confirm/close, so the toolbar does not
 * need to track the dialog lifecycle separately.
 */
const reshuffleConfirmOpen = ref(false)

function onMuteAllClick(): void {
  // Click derives the next action from the *visual* state, not a bare server
  // flag. If anyone is unmuted while the flag is conceptually active, clicking
  // re-asserts mute-all (sends `muted: true`). Preserved 1:1 from
  // `MafiaHostActionsBar`.
  emit('set-mute-all', !props.muteAllActive)
}

function onReshuffleClick(): void {
  if (!props.canReshuffle) return
  reshuffleConfirmOpen.value = true
}

function onReshuffleConfirmed(): void {
  if (!props.canReshuffle) return
  emit('reshuffle')
}

function onSwapClick(): void {
  emit('toggle-swap-mode')
}
</script>

<template>
  <div
    class="game-host-actions"
    :class="{ 'game-host-actions--no-swap': !showSwap }"
    role="toolbar"
    :aria-label="labels.toolbarAria"
  >
    <button
      type="button"
      class="game-host-actions__btn game-host-actions__btn--mute"
      :class="{ 'game-host-actions__btn--mute-active': muteAllActive }"
      :title="labels.muteAllTitle"
      :aria-label="labels.muteAllTitle"
      :aria-pressed="muteAllActive"
      @click="onMuteAllClick"
    >
      <img class="game-host-actions__full-art" :src="muteAllIcon" alt="" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="game-host-actions__btn game-host-actions__btn--roles"
      :disabled="!canReshuffle"
      :title="canReshuffle ? labels.reshuffleTitle : labels.reshuffleDisabledHint"
      :aria-label="canReshuffle ? labels.reshuffleTitle : labels.reshuffleDisabledHint"
      @click="onReshuffleClick"
    >
      <img class="game-host-actions__roles-art" :src="mafiaHostRoles" alt="" aria-hidden="true" />
    </button>
    <button
      v-if="showSwap"
      type="button"
      class="game-host-actions__btn game-host-actions__btn--swap"
      :class="{ 'game-host-actions__btn--swap-active': swapActive }"
      :title="labels.swapModeTitle"
      :aria-label="labels.swapModeAria"
      :aria-pressed="swapActive"
      @click="onSwapClick"
    >
      <svg
        class="game-host-actions__swap-art"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M5 8h12m0 0-3-3m3 3-3 3M19 16H7m0 0 3-3m-3 3 3 3"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <ConfirmDialog
      v-model:open="reshuffleConfirmOpen"
      :title="labels.reshuffleConfirmTitle"
      :message="labels.reshuffleConfirmBody"
      :confirm-label="labels.reshuffleConfirmProceed"
      :cancel-label="labels.reshuffleConfirmCancel"
      @confirm="onReshuffleConfirmed"
    />
  </div>
</template>

<style scoped>
/*
 * Class set + dimensions ported verbatim from the original
 * `MafiaHostActionsBar.vue` (Phase 5b extraction). Only the namespace
 * changed (`mafia-host-actions*` → `game-host-actions*`); every numeric
 * value, font token, shadow, transform, animation keyframe is preserved.
 */

.game-host-actions {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 153px;
  height: 55px;
  padding: 7px;
  gap: 8px;
  border-radius: 33px;
  background: rgb(32 20 51 / 0.29);
  pointer-events: auto;
}

/*
 * Two-button variant (swap-mode button hidden via `:show-swap="false"`).
 * Width collapses from 3-button (153 px) to 2-button (104 px); the
 * 2-button geometry matches the original 104 px container the Eat First
 * adapter used before it adopted the shared bar.
 */
.game-host-actions--no-swap {
  width: 104px;
}

.game-host-actions__btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 41px;
  height: 41px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: transparent;
  cursor: pointer;
  transition:
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.16s ease;
}

.game-host-actions__btn:hover:not(:disabled) {
  transform: scale(1.025);
}

.game-host-actions__btn--mute-active {
  filter: brightness(1.05);
}

.game-host-actions__btn:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.82);
  outline-offset: 2px;
}

.game-host-actions__btn:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.game-host-actions__full-art {
  --game-host-action-hover: 0;
  --game-host-action-x: 0px;
  --game-host-action-y: 0px;
  --game-host-action-scale: 0;
  --game-host-action-rotate: 0deg;
  display: block;
  width: 41px;
  height: 41px;
  object-fit: contain;
  transform:
    translate(
      calc(var(--game-host-action-x) * var(--game-host-action-hover)),
      calc(var(--game-host-action-y) * var(--game-host-action-hover))
    )
    scale(calc(1 + var(--game-host-action-scale) * var(--game-host-action-hover)))
    rotate(calc(var(--game-host-action-rotate) * var(--game-host-action-hover)));
  transform-origin: center;
  animation: game-host-action-mics 1.18s ease-in-out infinite;
  transition: --game-host-action-hover 0.24s ease;
}

.game-host-actions__btn:hover:not(:disabled) .game-host-actions__full-art {
  --game-host-action-hover: 1;
}

.game-host-actions__btn--roles {
  background: rgb(102 56 143 / 0.47);
}

.game-host-actions__btn--swap {
  background: rgb(74 50 116 / 0.62);
  color: rgb(255 255 255 / 0.92);
  transition:
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    background 0.16s ease,
    box-shadow 0.16s ease,
    color 0.16s ease,
    opacity 0.16s ease;
}

.game-host-actions__btn--swap:hover:not(:disabled) {
  background: rgb(84 57 132 / 0.78);
}

.game-host-actions__btn--swap-active {
  background: rgb(102 56 143 / 0.78);
  color: #ffd455;
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, #facc15 70%, transparent),
    0 0 0 1px rgb(250 204 21 / 0.28);
}

.game-host-actions__swap-art {
  display: block;
  width: 22px;
  height: 22px;
  pointer-events: none;
}

.game-host-actions__roles-art {
  --game-host-action-hover: 0;
  --game-host-action-x: 0px;
  --game-host-action-y: 0px;
  --game-host-action-scale: 0;
  --game-host-action-rotate: 0deg;
  display: block;
  width: 24px;
  height: 24px;
  object-fit: contain;
  transform:
    translate(
      calc(var(--game-host-action-x) * var(--game-host-action-hover)),
      calc(var(--game-host-action-y) * var(--game-host-action-hover))
    )
    scale(calc(1 + var(--game-host-action-scale) * var(--game-host-action-hover)))
    rotate(calc(var(--game-host-action-rotate) * var(--game-host-action-hover)));
  transform-origin: center;
  animation: game-host-action-dice 1.18s ease-in-out infinite;
  transition: --game-host-action-hover 0.24s ease;
}

.game-host-actions__btn:hover:not(:disabled) .game-host-actions__roles-art {
  --game-host-action-hover: 1;
}

@property --game-host-action-hover {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --game-host-action-x {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --game-host-action-y {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --game-host-action-scale {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --game-host-action-rotate {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@keyframes game-host-action-mics {
  0%,
  100% {
    --game-host-action-x: 0px;
    --game-host-action-y: 0px;
    --game-host-action-scale: 0;
    --game-host-action-rotate: 0deg;
  }

  42% {
    --game-host-action-y: -1.2px;
    --game-host-action-scale: 0.035;
    --game-host-action-rotate: -1.5deg;
  }

  74% {
    --game-host-action-y: -0.5px;
    --game-host-action-scale: 0.016;
    --game-host-action-rotate: 1deg;
  }
}

@keyframes game-host-action-dice {
  0%,
  100% {
    --game-host-action-x: 0px;
    --game-host-action-y: 0px;
    --game-host-action-scale: 0;
    --game-host-action-rotate: 0deg;
  }

  38% {
    --game-host-action-y: -1px;
    --game-host-action-scale: 0.055;
    --game-host-action-rotate: -5deg;
  }

  70% {
    --game-host-action-y: -0.4px;
    --game-host-action-scale: 0.024;
    --game-host-action-rotate: 2.5deg;
  }
}
</style>
