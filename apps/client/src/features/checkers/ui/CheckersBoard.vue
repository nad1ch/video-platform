<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue'
import { isSameCheckersPosition } from '../core/checkersEngine'
import type { CheckersBoard, CheckersPiece, CheckersPosition } from '../core/types'
import CheckersCell from './CheckersCell.vue'
import CheckersPieceView from './CheckersPiece.vue'

const props = defineProps<{
  board: CheckersBoard
  selected: CheckersPosition | null
  validDestinations: CheckersPosition[]
  captureDestinations: CheckersPosition[]
  winningMove?: Pick<BoardPieceAnimation, 'from' | 'to'> | null
  flipped?: boolean
}>()

const emit = defineEmits<{
  cellClick: [pos: CheckersPosition]
}>()

type BoardCellView = {
  key: string
  row: number
  col: number
  piece: CheckersPiece | null
  selected: boolean
  validMove: boolean
  captureMove: boolean
  winningMove: boolean
  hidePiece: boolean
}

type BoardPieceAnimation = {
  piece: CheckersPiece
  from: CheckersPosition
  to: CheckersPosition
}

const previousBoard = ref<CheckersBoard | null>(null)
const pieceAnimation = ref<BoardPieceAnimation | null>(null)
let animationTimer: ReturnType<typeof setTimeout> | null = null

const cells = computed<BoardCellView[]>(() =>
  props.board.flatMap((rowCells, row) =>
    rowCells.map((piece, col) => {
      const pos = { row, col }
      return {
        key: `${row}-${col}`,
        row,
        col,
        piece,
        selected: props.selected ? isSameCheckersPosition(pos, props.selected) : false,
        validMove: props.validDestinations.some((destination) => isSameCheckersPosition(pos, destination)),
        captureMove: props.captureDestinations.some((destination) => isSameCheckersPosition(pos, destination)),
        winningMove: Boolean(
          props.winningMove &&
          (isSameCheckersPosition(pos, props.winningMove.from) || isSameCheckersPosition(pos, props.winningMove.to)),
        ),
        hidePiece: pieceAnimation.value ? isSameCheckersPosition(pos, pieceAnimation.value.to) : false,
      }
    }),
  ),
)

const animationStyle = computed<CSSProperties>(() => {
  const anim = pieceAnimation.value
  if (!anim) return {}
  return {
    '--from-x': `${anim.from.col * 100}%`,
    '--from-y': `${anim.from.row * 100}%`,
    '--to-x': `${anim.to.col * 100}%`,
    '--to-y': `${anim.to.row * 100}%`,
  } as CSSProperties
})

function samePiece(a: CheckersPiece | null, b: CheckersPiece | null): boolean {
  return Boolean(a && b && a.player === b.player && a.king === b.king)
}

function detectMove(prev: CheckersBoard, next: CheckersBoard): BoardPieceAnimation | null {
  const removed: Array<{ pos: CheckersPosition; piece: CheckersPiece }> = []
  const added: Array<{ pos: CheckersPosition; piece: CheckersPiece }> = []
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const before = prev[row]?.[col] ?? null
      const after = next[row]?.[col] ?? null
      if (before && !after) removed.push({ pos: { row, col }, piece: before })
      if (!before && after) added.push({ pos: { row, col }, piece: after })
    }
  }
  const target = added[0]
  if (!target) return null
  const source = removed.find((entry) => samePiece(entry.piece, target.piece)) ?? removed[0]
  return source ? { piece: target.piece, from: source.pos, to: target.pos } : null
}

watch(
  () => props.board,
  (next) => {
    const prev = previousBoard.value
    if (prev) {
      const move = detectMove(prev, next)
      if (move) {
        pieceAnimation.value = move
        if (animationTimer) clearTimeout(animationTimer)
        animationTimer = setTimeout(() => {
          pieceAnimation.value = null
          animationTimer = null
        }, 220)
      }
    }
    previousBoard.value = next.map((row) => row.map((piece) => (piece ? { ...piece } : null)))
  },
  { immediate: true },
)

function emitCellClick(pos: CheckersPosition): void {
  emit('cellClick', pos)
}
</script>

<template>
  <div
    class="checkers-board"
    :class="{ 'checkers-board--flipped': flipped }"
    role="grid"
    aria-label="Checkers board"
  >
    <CheckersCell
      v-for="cell in cells"
      :key="cell.key"
      :row="cell.row"
      :col="cell.col"
      :piece="cell.piece"
      :selected="cell.selected"
      :valid-move="cell.validMove"
      :capture-move="cell.captureMove"
      :winning-move="cell.winningMove"
      :hide-piece="cell.hidePiece"
      :flipped="flipped"
      @select="emitCellClick"
    />
    <span
      v-if="pieceAnimation"
      class="checkers-board__moving-piece"
      :style="animationStyle"
      aria-hidden="true"
    >
      <CheckersPieceView :piece="pieceAnimation.piece" :flipped="flipped" />
    </span>
  </div>
</template>

<style scoped>
.checkers-board {
  position: relative;
  display: grid;
  width: min(100cqw, 100cqh);
  aspect-ratio: 1;
  max-width: 100%;
  max-height: 100%;
  margin-inline: auto;
  overflow: hidden;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  grid-template-rows: repeat(8, minmax(0, 1fr));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1rem;
  background: rgba(10, 10, 10, 0.92);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 40px rgba(255, 255, 255, 0.05),
    0 16px 44px rgba(0, 0, 0, 0.34);
}

.checkers-board--flipped {
  transform: rotate(180deg);
}

@media (max-width: 1200px) {
  .checkers-board {
    width: 100%;
    max-width: min(100%, 640px);
  }
}

.checkers-board__moving-piece {
  position: absolute;
  z-index: 3;
  left: 0;
  top: 0;
  display: grid;
  width: 12.5%;
  height: 12.5%;
  place-items: center;
  pointer-events: none;
  animation: checkers-piece-move 0.2s ease-out forwards;
}

@keyframes checkers-piece-move {
  from {
    transform: translate(var(--from-x), var(--from-y));
  }
  to {
    transform: translate(var(--to-x), var(--to-y));
  }
}
</style>
