<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import type { WordLength } from '@/nadle/nadleLogic'

defineProps<{
  wordLength: WordLength
  row1: readonly string[]
  row2: readonly string[]
  row3: readonly string[]
  wordLengthOptions: readonly WordLength[]
  keysDisabled: boolean
  enterDisabled: boolean
  letterClass: (ch: string) => string | undefined
  screenKeyboardAria: string
  kbdToolbarAria: string
  enterLabel: string
}>()

const emit = defineEmits<{
  letter: [ch: string]
  backspace: []
  enter: []
  setWordLength: [len: WordLength]
}>()
</script>

<template>
  <div
    class="nadle-page__kbd"
    :style="{ '--nadle-len': String(wordLength) }"
    :aria-label="screenKeyboardAria"
  >
    <div class="nadle-page__kbd-inner">
      <div class="nadle-page__kbd-main">
        <div class="nadle-page__kbd-row">
          <AppButton
            v-for="ch in row1"
            :key="ch"
            type="button"
            variant="ghost"
            class="nadle-page__kbd-key"
            :class="letterClass(ch)"
            :disabled="keysDisabled"
            @click="emit('letter', ch)"
          >
            {{ ch }}
          </AppButton>
        </div>
        <div class="nadle-page__kbd-row nadle-page__kbd-row--mid">
          <AppButton
            v-for="ch in row2"
            :key="ch"
            type="button"
            variant="ghost"
            class="nadle-page__kbd-key"
            :class="letterClass(ch)"
            :disabled="keysDisabled"
            @click="emit('letter', ch)"
          >
            {{ ch }}
          </AppButton>
        </div>
        <div class="nadle-page__kbd-row">
          <AppButton
            v-for="ch in row3"
            :key="ch"
            type="button"
            variant="ghost"
            class="nadle-page__kbd-key"
            :class="letterClass(ch)"
            :disabled="keysDisabled"
            @click="emit('letter', ch)"
          >
            {{ ch }}
          </AppButton>
        </div>
      </div>
    </div>
    <div class="nadle-page__kbd-row nadle-page__kbd-row--actions" role="group" :aria-label="kbdToolbarAria">
      <AppButton
        type="button"
        variant="secondary"
        class="nadle-page__kbd-action nadle-page__kbd-side-action"
        :disabled="enterDisabled"
        @click="emit('enter')"
      >
        {{ enterLabel }}
      </AppButton>
      <AppButton
        v-for="n in wordLengthOptions"
        :key="n"
        type="button"
        :variant="wordLength === n ? 'primary' : 'ghost'"
        class="nadle-page__len-btn nadle-page__len-btn--kbd"
        @click="emit('setWordLength', n)"
      >
        {{ n }}
      </AppButton>
      <AppButton
        type="button"
        variant="ghost"
        class="nadle-page__kbd-action nadle-page__kbd-side-action"
        :disabled="keysDisabled"
        @click="emit('backspace')"
      >
        delete
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
/* Mirrored from NadleStreamPage.vue; :deep targets AppButton merged classes. Parent :deep kept until dedup. */
@media (min-width: 1201px) {
  .nadle-page__kbd {
    min-width: 0;
  }

  @media (max-height: 820px) {
    .nadle-page__kbd {
      gap: 6px;
    }

    .nadle-page__kbd :deep(.nadle-page__kbd-key) {
      height: 22px;
      min-width: 27px;
      font-size: 10px;
      padding: 0 0.2rem;
    }

    .nadle-page__kbd :deep(.nadle-page__kbd-side-action) {
      min-width: 58px;
      max-width: 64px;
      height: 24px;
      padding: 0 0.22rem;
      font-size: 8px;
    }

    .nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd) {
      height: 24px;
      min-width: 24px;
      max-width: 24px;
      font-size: 12px;
    }
  }
}

.nadle-page__kbd :deep(.nadle-page__len-btn) {
  min-width: 2.5rem;
}

.nadle-page__kbd :deep(.nadle-page__len-btn--kbd) {
  flex: 0 1 auto;
  max-width: 3.25rem;
}

.nadle-page__kbd {
  container-type: inline-size;
  container-name: nadle-kbd;
  width: 100%;
  /* Ширина поля слова < мінімуму рядка клавіатури (11 літер) — не обмежувати клавіатуру сіткою, інакше flex + min-width ріжуть краї. */
  max-width: 100%;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  flex-shrink: 0;
  min-width: 0;
  min-height: 0;
  overflow: visible;
}

.nadle-page__kbd-inner {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 7px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.nadle-page__kbd-main {
  flex: 0 1 auto;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 7px;
  align-items: center;
  max-width: 845px;
}

.nadle-page__kbd-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  justify-content: center;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.nadle-page__kbd-row--mid {
  padding-inline: 0;
}

.nadle-page__kbd :deep(.nadle-page__kbd-key) {
  box-sizing: border-box;
  flex: 1 1 0;
  width: 0;
  min-width: 53px;
  height: 33px;
  max-height: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
  overflow: hidden;
  line-height: 1;
  font-family: "Climate Crisis", var(--sa-font-display);
  font-size: 12px;
  font-weight: 400;
  text-transform: none;
  border-color: rgba(255, 255, 255, 0.13);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 48%),
    rgba(102, 56, 143, 0.31);
  color: #ffffff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 2px 0 rgba(0, 0, 0, 0.18);
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    color 0.16s ease;
}

.nadle-page__kbd :deep(.nadle-page__kbd-key:hover:not(:disabled)) {
  border-color: rgba(255, 255, 255, 0.24);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 48%),
    rgba(102, 56, 143, 0.44);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 2px 0 rgba(0, 0, 0, 0.16);
}

.nadle-page__kbd-row--actions :deep(.nadle-page__kbd-side-action:hover:not(:disabled)),
.nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd:hover:not(:disabled)) {
  transform: scale(1.025);
  filter: none;
}

.nadle-page__kbd-row--actions :deep(.nadle-page__kbd-side-action) {
  transition: transform 0.15s ease;
}

.nadle-page__kbd-row--actions :deep(.nadle-page__kbd-side-action:hover:not(:disabled)) {
  border-color: rgba(255, 255, 255, 0.14);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 48%),
    rgba(102, 56, 143, 0.05);
  color: #ffffff;
}

.nadle-page__kbd-row--actions :deep(.nadle-page__kbd-side-action:last-child:hover:not(:disabled)) {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 48%),
    rgba(255, 59, 48, 0.3);
}

.nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd) {
  transition: transform 0.15s ease;
}

.nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd.app-btn--ghost:hover:not(:disabled)) {
  border-color: color-mix(in srgb, var(--sa-color-border) 80%, transparent);
  background: color-mix(in srgb, var(--sa-color-surface) 75%, transparent);
  color: var(--sa-color-text-main);
}

.nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd.app-btn--primary:hover:not(:disabled)) {
  border-color: var(--sa-color-primary-border);
  background: color-mix(in srgb, var(--sa-color-primary) 88%, var(--sa-color-bg-deep));
  color: var(--sa-color-text-strong);
  box-shadow: none;
}

.nadle-page__kbd :deep(.nadle-page__kbd-key--absent) {
  opacity: 0.52;
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(102, 56, 143, 0.18);
  color: color-mix(in srgb, var(--sa-color-text-muted) 86%, var(--sa-color-text-main));
}

.nadle-page__kbd :deep(.nadle-page__kbd-key--present) {
  border-color: rgba(255, 212, 85, 0.28);
  background: rgba(167, 156, 59, 0.63);
  color: #ffffff;
}

.nadle-page__kbd :deep(.nadle-page__kbd-key--correct) {
  border-color: rgba(169, 209, 111, 0.34);
  background: rgba(105, 143, 56, 0.49);
  color: #ffffff;
}

.nadle-page__kbd-row--actions {
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  gap: 5px;
  margin-top: 0;
  padding-top: 0;
  max-width: 100%;
}

.nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd) {
  box-sizing: border-box;
  flex: 0 1 auto;
  min-width: 33px;
  max-width: 33px;
  height: 33px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nadle-page__kbd :deep(.nadle-page__kbd-side-action) {
  box-sizing: border-box;
  flex: 0 0 auto;
  min-width: 84px;
  max-width: 85px;
  width: auto;
  height: 33px;
  min-height: 0;
  max-height: none;
  padding: 0 0.35rem;
  font-family: "Climate Crisis", var(--sa-font-display);
  font-size: 10px;
  font-weight: 400;
  text-transform: lowercase;
  letter-spacing: 0;
  line-height: 1.1;
  border-color: rgba(255, 255, 255, 0.14);
  border-radius: 15.535px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 48%),
    rgba(102, 56, 143, 0.05);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 2px 0 rgba(0, 0, 0, 0.18);
}

.nadle-page__kbd-row--actions :deep(.nadle-page__kbd-side-action:last-child) {
  font-family: "Climate Crisis", var(--sa-font-display);
  font-size: 10px;
  text-transform: lowercase;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 48%),
    rgba(255, 59, 48, 0.3);
}

@media (min-width: 1201px) {
  .nadle-page__kbd {
    max-width: 845px;
    transform: translateY(-4px);
  }

  .nadle-page__kbd-row {
    width: auto;
    max-width: 100%;
  }

  .nadle-page__kbd-row--mid {
    transform: none;
  }

  .nadle-page__kbd-row:nth-child(3) {
    transform: none;
  }

  .nadle-page__kbd :deep(.nadle-page__kbd-key) {
    flex: 0 0 53px;
    width: 53px;
    height: 33px;
    min-width: 53px;
    font-size: 12px;
    padding: 0 0.1rem;
  }

  .nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd) {
    height: 33px;
    min-width: 33px;
    max-width: 33px;
    font-family: "Coda Caption", var(--sa-font-mono);
    font-size: 15px;
  }

  .nadle-page__kbd :deep(.nadle-page__kbd-side-action) {
    height: 33px;
    min-width: 84px;
    max-width: 85px;
    font-size: 10px;
    padding: 0 0.22rem;
  }

  .nadle-page__kbd-row--actions :deep(.nadle-page__kbd-side-action:last-child) {
    font-family: "Climate Crisis", var(--sa-font-display);
    font-size: 10px;
  }
}

@media (min-width: 1201px) and (max-width: 1480px) {
  .nadle-page__kbd-row {
    gap: clamp(4px, 0.55vw, 8px);
  }

  .nadle-page__kbd :deep(.nadle-page__kbd-key) {
    flex-basis: clamp(39px, 3.25vw, 53px);
    width: clamp(39px, 3.25vw, 53px);
    min-width: clamp(39px, 3.25vw, 53px);
  }
}

@media (max-width: 1200px) {
  .nadle-page__kbd {
    gap: clamp(0.35rem, 0.8vw, var(--sa-space-2));
  }

  .nadle-page__kbd-inner {
    align-items: center;
    gap: clamp(4px, 0.65vw, 6px);
  }

  .nadle-page__kbd-main {
    width: min(100%, 58rem);
  }

  .nadle-page__kbd-row {
    gap: clamp(3px, 0.6vw, 6px);
  }

  .nadle-page__kbd-row--mid {
    padding-inline: clamp(0.2rem, 1vw, 0.7rem);
  }

  .nadle-page__kbd :deep(.nadle-page__kbd-key) {
    height: clamp(34px, 3.4vw, 42px);
    min-width: clamp(24px, 2.8vw, 34px);
    font-size: clamp(11px, 1.1vw, 14px);
    padding: 0 clamp(0.08rem, 0.28vw, 0.2rem);
  }

  .nadle-page__kbd :deep(.nadle-page__kbd-side-action) {
    min-width: clamp(36px, 4.3vw, 48px);
    max-width: clamp(3rem, 5.5vw, 4.25rem);
    height: clamp(34px, 3.4vw, 42px);
    font-size: clamp(0.54rem, 0.8vw, 0.62rem);
    padding: 0 clamp(0.14rem, 0.35vw, 0.28rem);
  }

  .nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd) {
    height: clamp(34px, 3.4vw, 42px);
    min-width: clamp(1.5rem, 2vw, 2rem);
    max-width: clamp(2rem, 3vw, 2.75rem);
    font-size: clamp(0.68rem, 0.95vw, 0.78rem);
  }
}

@media (max-width: 520px) {
  .nadle-page__kbd-row--actions {
    gap: 0.45rem;
    padding-inline: 0;
    margin-top: 4px;
  }

  .nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd) {
    flex: 0 1 auto;
    min-width: 0;
    max-width: none;
    padding-inline: 0.35rem;
    font-size: 0.72rem;
  }

  .nadle-page__kbd-row {
    gap: clamp(2px, 0.85vw, 4px);
  }

  .nadle-page__kbd-row--mid {
    padding-inline: 0;
  }

  .nadle-page__kbd :deep(.nadle-page__kbd-key) {
    min-width: 0;
    font-size: clamp(8.5px, 2.9vw, 10.5px);
    padding-inline: 0.05rem;
  }

  .nadle-page__kbd :deep(.nadle-page__kbd-side-action) {
    min-width: 36px;
  }

  .nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd) {
    min-width: 1.5rem;
    max-width: 2rem;
  }
}
</style>
