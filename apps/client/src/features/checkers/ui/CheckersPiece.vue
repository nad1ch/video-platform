<script setup lang="ts">
import { BRAND_LOGO_DARK_SVG, BRAND_LOGO_LIGHT_SVG } from '@/eat-first/constants/brand.js'

import type { CheckersPiece } from '../core/types'

defineProps<{
  piece: CheckersPiece
  selected?: boolean
  flipped?: boolean
}>()

/** Light king: dark mark. Dark king: light mark (`public/brand/*`). */
function kingBrandSrc(player: CheckersPiece['player']): string {
  return player === 'player1' ? BRAND_LOGO_DARK_SVG : BRAND_LOGO_LIGHT_SVG
}
</script>

<template>
  <span
    class="checkers-piece"
    :class="{
      'checkers-piece--light': piece.player === 'player1',
      'checkers-piece--dark': piece.player === 'player2',
      'checkers-piece--king': piece.king,
      'checkers-piece--selected': selected,
      'checkers-piece--flipped-visual': flipped,
    }"
    :aria-label="piece.king ? `${piece.player} king` : piece.player"
    role="img"
  >
    <span v-if="piece.king" class="checkers-piece__king" aria-hidden="true">
      <img
        class="checkers-piece__brand-mark"
        :class="
          piece.player === 'player1' ? 'checkers-piece__brand-mark--on-light' : 'checkers-piece__brand-mark--on-dark'
        "
        :src="kingBrandSrc(piece.player)"
        alt=""
        width="40"
        height="40"
        decoding="async"
      />
    </span>
  </span>
</template>

<style scoped>
.checkers-piece {
  position: relative;
  z-index: 2;
  box-sizing: border-box;
  display: grid;
  width: clamp(66%, calc(var(--checkers-piece-relative-pct, 0.705) * 100%), 72%);
  aspect-ratio: 1;
  place-items: center;
  isolation: isolate;
  border-radius: 50%;
  border: none;
  transform: translateZ(0);
  transition:
    transform 165ms ease,
    filter 165ms ease,
    box-shadow 165ms ease;
}

.checkers-piece--flipped-visual {
  transform: rotate(180deg);
}

.checkers-piece--selected.checkers-piece--flipped-visual {
  transform: rotate(180deg) scale(1.04);
}

.checkers-piece--selected:not(.checkers-piece--flipped-visual) {
  transform: scale(1.04);
}

/* Inner token bevel ring — stronger dome read */
.checkers-piece::before {
  position: absolute;
  inset: 7%;
  z-index: 1;
  box-sizing: border-box;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.3),
    inset 0 -3px 7px rgba(0, 0, 0, 0.45);
  content: '';
  pointer-events: none;
}

.checkers-piece--dark::before {
  border-color: rgba(238, 215, 255, 0.2);
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.16),
    inset 0 -3px 8px rgba(0, 0, 0, 0.55);
}

.checkers-piece--light::before {
  border-color: rgba(255, 255, 255, 0.42);
}

/* Top-left glossy specular — slightly stronger */
.checkers-piece::after {
  position: absolute;
  top: 16%;
  left: 21%;
  z-index: 2;
  width: 36%;
  height: 34%;
  border-radius: 50%;
  opacity: 0.5;
  background: radial-gradient(
    ellipse at 38% 32%,
    rgba(255, 255, 255, 0.62) 0%,
    rgba(255, 255, 255, 0.14) 46%,
    transparent 74%
  );
  content: '';
  pointer-events: none;
  filter: blur(0.45px);
}

.checkers-piece--light::after {
  opacity: 0.53;
}

/* Glossy dark-purple / onyx tokens */
.checkers-piece--dark {
  background:
    radial-gradient(circle at 34% 28%, rgba(210, 190, 255, 0.34) 0%, transparent 16%),
    radial-gradient(circle at 40% 34%, rgba(110, 84, 155, 0.48) 0%, transparent 38%),
    radial-gradient(circle at 58% 64%, #0a0712 0%, #171022 54%, #06030b 100%);
  box-shadow:
    inset 0 2px 5px rgba(255, 255, 255, 0.12),
    inset 0 -10px 16px rgba(0, 0, 0, 0.64),
    inset 1px -2px 0 rgba(148, 110, 200, 0.12),
    0 8px 14px rgba(0, 0, 0, 0.5),
    0 12px 22px rgba(0, 0, 0, 0.34),
    0 0 0 2px rgba(215, 190, 255, 0.24);
}

/* Pearl/lavender domed tokens */
.checkers-piece--light {
  background:
    radial-gradient(circle at 30% 23%, rgba(255, 255, 255, 0.96) 0%, transparent 18%),
    radial-gradient(circle at 42% 34%, #f6f2ff 0%, #ddd6f1 44%, #aba1c8 100%);
  box-shadow:
    inset 0 2px 5px rgba(255, 255, 255, 0.9),
    inset 0 -9px 15px rgba(104, 90, 145, 0.32),
    inset 0 -3px 0 rgba(172, 160, 200, 0.22),
    0 8px 13px rgba(0, 0, 0, 0.34),
    0 12px 22px rgba(8, 2, 20, 0.2),
    0 0 0 2px rgba(255, 255, 255, 0.42);
}

.checkers-piece--selected.checkers-piece--dark,
.checkers-piece--selected.checkers-piece--light {
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.12),
    inset 0 -8px 14px rgba(0, 0, 0, 0.55),
    0 0 0 3px rgba(190, 110, 255, 0.65),
    0 0 18px rgba(175, 75, 255, 0.55),
    0 9px 15px rgba(0, 0, 0, 0.48);
}

.checkers-piece__king {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  pointer-events: none;
}

.checkers-piece__brand-mark {
  box-sizing: content-box;
  display: block;
  flex-shrink: 0;
  width: min(41%, calc((var(--checkers-board-size, 320px) / 16)));
  max-width: 46%;
  min-width: 8px;
  height: auto;
  aspect-ratio: 252 / 322;
  object-fit: contain;
  object-position: center center;
  margin: auto;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.checkers-piece__brand-mark--on-dark {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.58));
  object-position: 50% 50%;
}

.checkers-piece__brand-mark--on-light {
  filter: drop-shadow(0 1px 1px rgba(100, 60, 160, 0.2));
  object-position: 50% 52%;
}

.checkers-piece--king::before {
  opacity: 0.55;
}

.checkers-piece--king::after {
  opacity: 0.16;
}

.checkers-piece--king.checkers-piece--light::after {
  opacity: 0.12;
}
</style>
