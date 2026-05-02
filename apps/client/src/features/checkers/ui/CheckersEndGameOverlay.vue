<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CheckersPlayer } from '../core/types'
import type { CheckersMode } from '../ws/checkersWs'

type EndGameWinner = CheckersPlayer | 'you' | 'opponent'

const props = defineProps<{
  winner: EndGameWinner | null
  mode: CheckersMode
  isVisible: boolean
  playerLabels: Record<'player1' | 'player2', string>
}>()

const emit = defineEmits<{
  rematch: []
  playBot: []
  playFriend: []
  playLocal: []
}>()

const { locale } = useI18n()
const isUk = computed(() => String(locale.value || '').toLowerCase().startsWith('uk'))

const ui = computed(() => {
  const uk = isUk.value
  return {
    youWin: uk ? 'Ти переміг' : 'You win',
    youLose: uk ? 'Ти програв' : 'You lose',
    wins: (name: string) => (uk ? `${name} переміг` : `${name} wins`),
    rematch: uk ? 'Реванш' : 'Rematch',
    playBot: uk ? 'Проти бота' : 'Play vs bot',
    playFriend: uk ? 'З другом' : 'Play with friend',
    playLocal: uk ? 'На одному пристрої' : 'Same device',
  }
})

const title = computed(() => {
  const copy = ui.value
  if (props.winner === 'you') return copy.youWin
  if (props.winner === 'opponent') return copy.youLose
  if (props.winner === 'player1') return copy.wins(props.playerLabels.player1)
  if (props.winner === 'player2') return copy.wins(props.playerLabels.player2)
  return ''
})
</script>

<template>
  <Transition name="checkers-end-game">
    <div
      v-if="isVisible"
      class="checkers-end-game-overlay"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-labelledby="checkers-end-game-title"
    >
      <div class="checkers-end-game-confetti" aria-hidden="true">
        <span v-for="n in 22" :key="n" :style="{ '--i': n, '--x': `${(n * 37) % 100}%` }" />
      </div>

      <div class="checkers-end-game-card">
        <p id="checkers-end-game-title" class="checkers-end-game-title">{{ title }}</p>
        <slot />
        <div class="checkers-end-game-actions">
          <button type="button" class="checkers-end-game-button checkers-end-game-button--primary" @click="emit('rematch')">
            {{ ui.rematch }}
          </button>
          <button
            type="button"
            class="checkers-end-game-button"
            :class="{ 'checkers-end-game-button--active': mode === 'bot' }"
            @click="emit('playBot')"
          >
            {{ ui.playBot }}
          </button>
          <button
            type="button"
            class="checkers-end-game-button"
            :class="{ 'checkers-end-game-button--active': mode === 'friend' }"
            @click="emit('playFriend')"
          >
            {{ ui.playFriend }}
          </button>
          <button
            type="button"
            class="checkers-end-game-button"
            :class="{ 'checkers-end-game-button--active': mode === 'local' }"
            @click="emit('playLocal')"
          >
            {{ ui.playLocal }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.checkers-end-game-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: var(--sa-space-4);
  border-radius: 1rem;
  background: rgba(0, 0, 0, 0.5);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

.checkers-end-game-card {
  position: relative;
  z-index: 2;
  display: grid;
  width: min(100%, 22rem);
  gap: var(--sa-space-3);
  justify-items: center;
  padding: var(--sa-space-5);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  background: rgba(18, 8, 34, 0.9);
  box-shadow: 0 16px 44px rgba(3, 1, 9, 0.4);
}

.checkers-end-game-title {
  margin: 0;
  font-family: "Climate Crisis", var(--sa-font-display);
  font-size: clamp(1.25rem, 3vw, 2rem);
  color: #fff;
  text-align: center;
}

.checkers-end-game-actions {
  display: grid;
  width: 100%;
  gap: var(--sa-space-2);
}

.checkers-end-game-button {
  min-height: 2.45rem;
  padding: 0 var(--sa-space-4);
  border: 1px solid rgba(216, 180, 254, 0.42);
  border-radius: 999px;
  background: rgba(46, 26, 72, 0.82);
  color: #fff;
  cursor: pointer;
  font-family: "Marmelad", var(--sa-font-main);
  font-weight: 700;
  box-shadow: 0 0 16px rgba(168, 85, 247, 0.22);
}

.checkers-end-game-button:hover,
.checkers-end-game-button:focus-visible {
  border-color: rgba(255, 255, 255, 0.55);
  background: rgba(88, 28, 135, 0.88);
}

.checkers-end-game-button--primary {
  border-color: rgba(216, 180, 254, 0.58);
  background: rgba(126, 34, 206, 0.88);
  box-shadow: 0 0 20px rgba(168, 85, 247, 0.32);
}

.checkers-end-game-button--active {
  border-color: rgba(255, 255, 255, 0.38);
  background: rgba(146, 82, 206, 0.66);
}

.checkers-end-game-confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.checkers-end-game-confetti span {
  position: absolute;
  top: -12px;
  left: var(--x);
  width: 7px;
  height: 12px;
  border-radius: 2px;
  background: hsl(calc(var(--i) * 31) 80% 62%);
  animation: checkers-end-game-confetti-fall 1.7s ease-out calc((var(--i) % 8) * 0.08s) infinite;
}

.checkers-end-game-enter-active,
.checkers-end-game-leave-active {
  transition: opacity 0.18s ease-out;
}

.checkers-end-game-enter-from,
.checkers-end-game-leave-to {
  opacity: 0;
}

@keyframes checkers-end-game-confetti-fall {
  to {
    transform: translate3d(calc((var(--i) % 7 - 3) * 18px), 520px, 0) rotate(620deg);
    opacity: 0;
  }
}
</style>
