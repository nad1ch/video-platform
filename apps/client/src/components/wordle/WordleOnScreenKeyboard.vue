<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import type { WordLength } from '@/wordle/wordleLogic'

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
    class="wordle-page__kbd"
    :style="{ '--wordle-len': String(wordLength) }"
    :aria-label="screenKeyboardAria"
  >
    <div class="wordle-page__kbd-inner">
      <div class="wordle-page__kbd-main">
        <div class="wordle-page__kbd-row">
          <AppButton
            v-for="ch in row1"
            :key="ch"
            type="button"
            variant="ghost"
            class="wordle-page__kbd-key"
            :class="letterClass(ch)"
            :disabled="keysDisabled"
            @click="emit('letter', ch)"
          >
            {{ ch }}
          </AppButton>
        </div>
        <div class="wordle-page__kbd-row wordle-page__kbd-row--mid">
          <AppButton
            v-for="ch in row2"
            :key="ch"
            type="button"
            variant="ghost"
            class="wordle-page__kbd-key"
            :class="letterClass(ch)"
            :disabled="keysDisabled"
            @click="emit('letter', ch)"
          >
            {{ ch }}
          </AppButton>
        </div>
        <div class="wordle-page__kbd-row">
          <AppButton
            v-for="ch in row3"
            :key="ch"
            type="button"
            variant="ghost"
            class="wordle-page__kbd-key"
            :class="letterClass(ch)"
            :disabled="keysDisabled"
            @click="emit('letter', ch)"
          >
            {{ ch }}
          </AppButton>
        </div>
      </div>
    </div>
    <div class="wordle-page__kbd-row wordle-page__kbd-row--actions" role="group" :aria-label="kbdToolbarAria">
      <AppButton
        type="button"
        variant="secondary"
        class="wordle-page__kbd-action wordle-page__kbd-side-action"
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
        class="wordle-page__len-btn wordle-page__len-btn--kbd"
        @click="emit('setWordLength', n)"
      >
        {{ n }}
      </AppButton>
      <AppButton
        type="button"
        variant="ghost"
        class="wordle-page__kbd-action wordle-page__kbd-side-action"
        :disabled="keysDisabled"
        @click="emit('backspace')"
      >
        ⌫
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
/* Mirrored from WordleStreamPage.vue; :deep targets AppButton merged classes. Parent :deep kept until dedup. */
@media (min-width: 1201px) {
  .wordle-page__kbd {
    min-width: 0;
  }

  @media (max-height: 820px) {
    .wordle-page__kbd {
      gap: var(--sa-space-1);
    }

    .wordle-page__kbd :deep(.wordle-page__kbd-key) {
      height: 42px;
      min-width: 34px;
      font-size: 14px;
      padding: 0 0.2rem;
    }

    .wordle-page__kbd :deep(.wordle-page__kbd-side-action) {
      min-width: 48px;
      max-width: 4rem;
      height: 40px;
      padding: 0 0.22rem;
      font-size: 0.6rem;
    }

    .wordle-page__kbd-row--actions :deep(.wordle-page__len-btn--kbd) {
      height: 40px;
      min-width: 1.85rem;
      max-width: 2.5rem;
      font-size: 0.78rem;
    }
  }
}

.wordle-page__kbd :deep(.wordle-page__len-btn) {
  min-width: 2.5rem;
}

.wordle-page__kbd :deep(.wordle-page__len-btn--kbd) {
  flex: 0 1 auto;
  max-width: 3.25rem;
}

.wordle-page__kbd {
  container-type: inline-size;
  container-name: wordle-kbd;
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

.wordle-page__kbd-inner {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.wordle-page__kbd-main {
  flex: 0 1 auto;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
  align-items: center;
}

.wordle-page__kbd-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  justify-content: center;
  width: 100%;
  min-width: 0;
}

.wordle-page__kbd-row--mid {
  padding-inline: min(1rem, 2.5vw);
}

.wordle-page__kbd :deep(.wordle-page__kbd-key) {
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
}

.wordle-page__kbd :deep(.wordle-page__kbd-key--absent) {
  opacity: 0.38;
  color: var(--sa-color-text-muted);
}

.wordle-page__kbd :deep(.wordle-page__kbd-key--present) {
  border-color: color-mix(in srgb, var(--sa-color-warning) 55%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-warning) 18%, var(--sa-color-surface-raised));
  color: var(--sa-color-text-main);
}

.wordle-page__kbd :deep(.wordle-page__kbd-key--correct) {
  border-color: color-mix(in srgb, var(--sa-color-success) 55%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-success) 22%, var(--sa-color-surface-raised));
  color: var(--sa-color-text-strong);
}

.wordle-page__kbd-row--actions {
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 2px;
  max-width: 100%;
}

.wordle-page__kbd-row--actions :deep(.wordle-page__len-btn--kbd) {
  box-sizing: border-box;
  flex: 0 1 auto;
  min-width: 2.25rem;
  max-width: 3.25rem;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.wordle-page__kbd :deep(.wordle-page__kbd-side-action) {
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
}

@media (min-width: 1201px) {
  .wordle-page__kbd :deep(.wordle-page__kbd-key) {
    height: 42px;
    min-width: 30px;
    font-size: 14px;
    padding: 0 0.1rem;
  }

  .wordle-page__kbd-row--actions :deep(.wordle-page__len-btn--kbd) {
    height: 42px;
    min-width: 2.05rem;
    max-width: 2.85rem;
    font-size: 0.82rem;
  }

  .wordle-page__kbd :deep(.wordle-page__kbd-side-action) {
    height: 42px;
    min-width: 52px;
    max-width: 4.75rem;
    font-size: 0.62rem;
    padding: 0 0.28rem;
  }
}

@media (max-width: 1200px) {
  .wordle-page__kbd {
    gap: clamp(0.35rem, 0.8vw, var(--sa-space-2));
  }

  .wordle-page__kbd-inner {
    gap: clamp(4px, 0.65vw, 6px);
  }

  .wordle-page__kbd-row {
    gap: clamp(3px, 0.6vw, 6px);
  }

  .wordle-page__kbd-row--mid {
    padding-inline: clamp(0.2rem, 1vw, 0.7rem);
  }

  .wordle-page__kbd :deep(.wordle-page__kbd-key) {
    height: clamp(34px, 3.4vw, 42px);
    min-width: clamp(24px, 2.8vw, 34px);
    font-size: clamp(11px, 1.1vw, 14px);
    padding: 0 clamp(0.08rem, 0.28vw, 0.2rem);
  }

  .wordle-page__kbd :deep(.wordle-page__kbd-side-action) {
    min-width: clamp(36px, 4.3vw, 48px);
    max-width: clamp(3rem, 5.5vw, 4.25rem);
    height: clamp(34px, 3.4vw, 42px);
    font-size: clamp(0.54rem, 0.8vw, 0.62rem);
    padding: 0 clamp(0.14rem, 0.35vw, 0.28rem);
  }

  .wordle-page__kbd-row--actions :deep(.wordle-page__len-btn--kbd) {
    height: clamp(34px, 3.4vw, 42px);
    min-width: clamp(1.5rem, 2vw, 2rem);
    max-width: clamp(2rem, 3vw, 2.75rem);
    font-size: clamp(0.68rem, 0.95vw, 0.78rem);
  }
}

@media (max-width: 520px) {
  .wordle-page__kbd-row--actions {
    gap: 0.45rem;
    padding-inline: 0.25rem;
    margin-top: 4px;
  }

  .wordle-page__kbd-row--actions :deep(.wordle-page__len-btn--kbd) {
    flex: 0 1 auto;
    min-width: 0;
    max-width: none;
    padding-inline: 0.35rem;
    font-size: 0.72rem;
  }

  .wordle-page__kbd-row {
    gap: 4px;
  }

  .wordle-page__kbd-row--mid {
    padding-inline: 0;
  }

  .wordle-page__kbd :deep(.wordle-page__kbd-key) {
    min-width: 22px;
    font-size: 10.5px;
  }

  .wordle-page__kbd :deep(.wordle-page__kbd-side-action) {
    min-width: 36px;
  }

  .wordle-page__kbd-row--actions :deep(.wordle-page__len-btn--kbd) {
    min-width: 1.5rem;
    max-width: 2rem;
  }
}
</style>
