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
        ⌫
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
      gap: var(--sa-space-1);
    }

    .nadle-page__kbd :deep(.nadle-page__kbd-key) {
      height: 42px;
      min-width: 34px;
      font-size: 14px;
      padding: 0 0.2rem;
    }

    .nadle-page__kbd :deep(.nadle-page__kbd-side-action) {
      min-width: 48px;
      max-width: 4rem;
      height: 40px;
      padding: 0 0.22rem;
      font-size: 0.6rem;
    }

    .nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd) {
      height: 40px;
      min-width: 1.85rem;
      max-width: 2.5rem;
      font-size: 0.78rem;
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
  gap: var(--sa-space-2);
  align-items: center;
  flex-shrink: 0;
  min-width: 0;
  min-height: 160px;
  overflow: visible;
}

.nadle-page__kbd-inner {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.nadle-page__kbd-main {
  flex: 0 1 auto;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
  align-items: center;
}

.nadle-page__kbd-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  justify-content: center;
  width: 100%;
  min-width: 0;
}

.nadle-page__kbd-row--mid {
  padding-inline: min(1rem, 2.5vw);
}

.nadle-page__kbd :deep(.nadle-page__kbd-key) {
  box-sizing: border-box;
  flex: 1 1 0;
  width: 0;
  min-width: 40px;
  height: 48px;
  max-height: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
  overflow: hidden;
  line-height: 1;
  font-size: 16px;
  font-weight: 700;
  text-transform: none;
  border-color: color-mix(in srgb, var(--sa-color-border) 82%, rgba(255, 255, 255, 0.16));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 48%),
    color-mix(in srgb, var(--sa-color-surface-raised) 82%, transparent);
  color: var(--sa-color-text-main);
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
  border-color: color-mix(in srgb, var(--sa-color-primary-border) 72%, var(--sa-color-border));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 48%),
    color-mix(in srgb, var(--sa-color-primary) 12%, var(--sa-color-surface-raised));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 2px 0 rgba(0, 0, 0, 0.16),
    0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 24%, transparent);
}

.nadle-page__kbd :deep(.nadle-page__kbd-key--absent) {
  opacity: 0.52;
  border-color: color-mix(in srgb, var(--sa-color-border) 58%, transparent);
  background: color-mix(in srgb, var(--sa-color-surface) 78%, transparent);
  color: color-mix(in srgb, var(--sa-color-text-muted) 86%, var(--sa-color-text-main));
}

.nadle-page__kbd :deep(.nadle-page__kbd-key--present) {
  border-color: color-mix(in srgb, var(--sa-color-warning) 68%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-warning) 24%, var(--sa-color-surface-raised));
  color: var(--sa-color-text-main);
}

.nadle-page__kbd :deep(.nadle-page__kbd-key--correct) {
  border-color: color-mix(in srgb, var(--sa-color-success) 68%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-success) 28%, var(--sa-color-surface-raised));
  color: var(--sa-color-text-strong);
}

.nadle-page__kbd-row--actions {
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 2px;
  max-width: 100%;
}

.nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd) {
  box-sizing: border-box;
  flex: 0 1 auto;
  min-width: 2.25rem;
  max-width: 3.25rem;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nadle-page__kbd :deep(.nadle-page__kbd-side-action) {
  box-sizing: border-box;
  flex: 0 0 auto;
  min-width: 56px;
  max-width: 5rem;
  width: auto;
  height: 48px;
  min-height: 0;
  max-height: none;
  padding: 0 0.35rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.1;
  border-color: color-mix(in srgb, var(--sa-color-primary-border) 48%, var(--sa-color-border));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 48%),
    color-mix(in srgb, var(--sa-color-primary) 10%, var(--sa-color-surface-raised));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 2px 0 rgba(0, 0, 0, 0.18);
}

@media (min-width: 1201px) {
  .nadle-page__kbd :deep(.nadle-page__kbd-key) {
    height: 42px;
    min-width: 30px;
    font-size: 14px;
    padding: 0 0.1rem;
  }

  .nadle-page__kbd-row--actions :deep(.nadle-page__len-btn--kbd) {
    height: 42px;
    min-width: 2.05rem;
    max-width: 2.85rem;
    font-size: 0.82rem;
  }

  .nadle-page__kbd :deep(.nadle-page__kbd-side-action) {
    height: 42px;
    min-width: 52px;
    max-width: 4.75rem;
    font-size: 0.62rem;
    padding: 0 0.28rem;
  }
}

@media (max-width: 1200px) {
  .nadle-page__kbd {
    gap: clamp(0.35rem, 0.8vw, var(--sa-space-2));
  }

  .nadle-page__kbd-inner {
    gap: clamp(4px, 0.65vw, 6px);
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
    padding-inline: 0.25rem;
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
    gap: 4px;
  }

  .nadle-page__kbd-row--mid {
    padding-inline: 0;
  }

  .nadle-page__kbd :deep(.nadle-page__kbd-key) {
    min-width: 22px;
    font-size: 10.5px;
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
