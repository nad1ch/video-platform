<script setup lang="ts">
import type { CheckersPiece } from '../core/types'

defineProps<{
  piece: CheckersPiece
  selected?: boolean
  flipped?: boolean
}>()
</script>

<template>
  <span
    class="relative inline-grid aspect-square w-[min(72%,3.5rem)] place-items-center overflow-hidden rounded-full ring-1 ring-white/10 transition-transform duration-200 ease-out before:absolute before:left-1 before:top-1 before:h-1/3 before:w-2/3 before:rounded-full before:blur-sm before:content-[''] after:pointer-events-none after:absolute after:left-[18%] after:top-[13%] after:h-[22%] after:w-[42%] after:-rotate-[18deg] after:rounded-full after:blur-[0.5px] after:content-[''] will-change-transform"
    :class="{
      'border border-violet-300/80 bg-[radial-gradient(circle_at_42%_30%,#ffffff_0%,#f3f4f6_46%,#d8dbe0_100%)] text-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.82),inset_0_-5px_12px_rgba(0,0,0,0.18),inset_0_4px_8px_rgba(255,255,255,0.78),0_0_18px_rgba(168,85,247,0.38),0_8px_22px_rgba(0,0,0,0.32)] before:bg-[radial-gradient(ellipse_at_center,rgba(192,132,252,0.42)_0%,rgba(168,85,247,0.22)_46%,rgba(124,58,237,0)_72%)] before:opacity-90 after:bg-[radial-gradient(ellipse_at_center,rgba(233,213,255,0.86)_0%,rgba(192,132,252,0.56)_30%,rgba(168,85,247,0.24)_58%,rgba(124,58,237,0)_76%)] after:opacity-95': piece.player === 'player1',
      'border border-neutral-500/70 bg-[radial-gradient(circle_at_42%_30%,#2a2a2a_0%,#111_42%,#000_100%)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10),inset_0_-4px_10px_rgba(0,0,0,0.6),inset_0_4px_8px_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.72)] before:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.05)_48%,rgba(255,255,255,0)_72%)] before:opacity-80 after:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.62)_32%,rgba(255,255,255,0.16)_58%,rgba(255,255,255,0)_76%)] after:opacity-75': piece.player === 'player2',
      'scale-105 ring-2 ring-white shadow-[0_0_22px_rgba(255,255,255,0.45)]': selected,
      'rotate-180': flipped,
    }"
    :aria-label="piece.king ? `${piece.player} king` : piece.player"
  >
    <span v-if="piece.king" class="relative z-10 text-[clamp(0.85rem,2vw,1.25rem)] font-black tracking-[0.08em]">K</span>
  </span>
</template>
