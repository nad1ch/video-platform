<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue'
import { isSameCheckersPosition } from '../core/checkersEngine'
import type { CheckersBoard, CheckersPiece, CheckersPosition } from '../core/types'
import CheckersCell from './CheckersCell.vue'
import CheckersPieceView from './CheckersPiece.vue'

const FILE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
const RANK_LABELS_DESC = [8, 7, 6, 5, 4, 3, 2, 1] as const

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
  <div class="checkers-board-frame">
    
    <div class="checkers-board-rotatable" :class="{ 'checkers-board-rotatable--flipped': flipped }">
      <div class="checkers-coordinate-corner checkers-coordinate-corner--tl" aria-hidden="true" />

      <div class="checkers-coordinates-top" role="presentation" aria-hidden="true">
        <span v-for="file in FILE_LABELS" :key="`tf-${file}`" class="checkers-coordinates-top__slot">
          <span class="checkers-coordinate-face">{{ file }}</span>
        </span>
      </div>

      <div class="checkers-coordinate-corner checkers-coordinate-corner--tr" aria-hidden="true" />

      <div class="checkers-coordinates-left" role="presentation" aria-hidden="true">
        <span v-for="rank in RANK_LABELS_DESC" :key="`lr-${rank}`" class="checkers-coordinates-left__slot">
          <span class="checkers-coordinate-face">{{ rank }}</span>
        </span>
      </div>

      <div class="checkers-board-glow-wrap">
        <div
          class="checkers-board"
          role="grid"
          aria-label="Checkers board"
          style="
            --checkers-piece-relative-pct: 0.705;
            --checkers-cell-size: calc(var(--checkers-board-size) / 8);
            --checkers-piece-size: calc(var(--checkers-cell-size) * var(--checkers-piece-relative-pct));
          "
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
      </div>

      <div class="checkers-coordinates-right" role="presentation" aria-hidden="true">
        <span v-for="rank in RANK_LABELS_DESC" :key="`rr-${rank}`" class="checkers-coordinates-right__slot">
          <span class="checkers-coordinate-face">{{ rank }}</span>
        </span>
      </div>

      <div class="checkers-coordinate-corner checkers-coordinate-corner--bl" aria-hidden="true" />

      <div class="checkers-coordinates-bottom" role="presentation" aria-hidden="true">
        <span v-for="file in FILE_LABELS" :key="`bf-${file}`" class="checkers-coordinates-bottom__slot">
          <span class="checkers-coordinate-face">{{ file }}</span>
        </span>
      </div>

      <div class="checkers-coordinate-corner checkers-coordinate-corner--br" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.checkers-board-frame {
  
  --checkers-board-glow-bleed: clamp(11px, 2.35cqmin, 20px);
  /*
   * Space reserved on each horizontal side OUTSIDE coords+mid grid so neon/box-shadow
   * survives ancestors with overflow clipping; must match subtraction in inner-max-inline.
   * Keep floor modest—the mid glow lives inside coordinated layout; extremes use cqmin scaling.
   */
  --checkers-board-glow-outer-safe: clamp(8px, 1.5cqmin, 18px);
  /*
   * Frame horizontal padding doubles as layout reserve: board math must subtract it from cqw.
   * Otherwise rotatable intrinsic width resolves to ~100cqw while the grid box is narrower
   * (content area = cqw − 2×padding), which clips glow/coords asymmetrically inside the shell.
   */
  --checkers-frame-padding-inline: clamp(10px, 2.35cqmin, 22px);
  
  --checkers-board-inner-max-inline: calc(
    100cqw - 2 * var(--checkers-frame-padding-inline) - 2 * var(--checkers-board-glow-outer-safe)
  );
  
  --checkers-coordinate-strip: clamp(1.06rem, 3.95cqmin, 1.58rem);
  
  --checkers-coordinate-gap: clamp(0px, 0.26cqmin, 3px);
  --checkers-layout-vertical-inset-top: clamp(0.1rem, 0.55cqmin, 0.3rem);
  /* Voice dock is `position: fixed`; do not shrink the playable square for it via CQ height. */
  --checkers-board-vertical-fudge: clamp(4px, 1.1cqmin, 12px);
  
  --checkers-board-inline-cap: max(
    0px,
    calc(
      var(--checkers-board-inner-max-inline) - 2 * var(--checkers-coordinate-strip) - 2 * var(--checkers-board-glow-bleed)
    )
  );
  --checkers-board-min-side: 180px;

  --checkers-board-size: max(
    var(--checkers-board-min-side),
    min(
      var(--checkers-board-inline-cap),
      calc(
        100cqh - 2 * var(--checkers-coordinate-strip) - 2 * var(--checkers-board-glow-bleed) -
          calc(var(--checkers-layout-vertical-inset-top) * 0.28) - var(--checkers-board-vertical-fudge)
      )
    )
  );

  --checkers-board-mid-span: calc(var(--checkers-board-size) + 2 * var(--checkers-board-glow-bleed));
  
  --checkers-cell-span: calc(var(--checkers-board-size) / 8);

  --checkers-board-radius: clamp(6px, 0.58cqmin, 8px);
  --checkers-board-border: rgba(220, 190, 255, 0.65);
  
  --checkers-board-glow-neon:
    0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 20px 2.35px rgba(180, 95, 255, 0.48),
    0 0 40px 4.25px rgba(120, 45, 220, 0.3),
    0 0 36px rgba(160, 80, 255, 0.2);
  --checkers-board-inset-physical: inset 0 2px 6px rgba(6, 2, 16, 0.55);
  --checkers-board-shadow-drop: 0 16px 40px rgba(0, 0, 0, 0.55);
  --checkers-coordinate-color: rgba(238, 228, 255, 0.82);
  --checkers-coordinate-size: clamp(1.375rem, calc(var(--checkers-board-size, 640px) * 0.038), 1.75rem);

  position: relative;
  z-index: 0;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding-block-start: calc(var(--checkers-layout-vertical-inset-top) * 0.28);
  padding-inline: var(--checkers-frame-padding-inline);
  padding-block-end: clamp(5px, 1.35cqmin, 12px);
  width: 100%;
  height: 100%;
  max-width: 100%;
  margin-inline: auto;
  overflow: visible;
}


.checkers-board-frame::before {
  position: absolute;
  inset: -12% -10% -14% -10%;
  z-index: -1;
  border-radius: clamp(12px, 3cqmin, 28px);
  background: radial-gradient(circle at 50% 48%, rgba(150, 60, 255, 0.2), transparent 65%);
  filter: blur(0.5px);
  pointer-events: none;
  content: '';
}

.checkers-board-rotatable {
  --checkers-coord-strip: var(--checkers-coordinate-strip);

  position: relative;
  z-index: 1;
  display: grid;
  overflow: visible;
  
  justify-content: center;
  align-content: center;
  justify-items: stretch;
  align-items: stretch;
  grid-template-columns:
    var(--checkers-coord-strip) var(--checkers-board-mid-span) var(--checkers-coord-strip);
  grid-template-rows:
    var(--checkers-coord-strip) var(--checkers-board-mid-span) var(--checkers-coord-strip);
  width: min(calc(var(--checkers-board-mid-span) + 2 * var(--checkers-coord-strip)), 100%);
  max-width: 100%;
  margin-inline: auto;
  transform-origin: 50% 50%;
}

.checkers-board-rotatable--flipped {
  transform: rotate(180deg);
}

.checkers-board-rotatable--flipped .checkers-coordinate-face {
  transform: rotate(180deg);
}

.checkers-coordinate-corner {
  min-width: 0;
}

.checkers-coordinate-corner--tl {
  grid-column: 1;
  grid-row: 1;
}

.checkers-coordinate-corner--tr {
  grid-column: 3;
  grid-row: 1;
}

.checkers-coordinate-corner--bl {
  grid-column: 1;
  grid-row: 3;
}

.checkers-coordinate-corner--br {
  grid-column: 3;
  grid-row: 3;
}

.checkers-coordinate-face {
  display: grid;
  place-items: center;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: visible;
  white-space: nowrap;
  padding-inline: clamp(0px, 0.2cqmin, 3px);
  color: var(--checkers-coordinate-color);
  font-family: 'Georgia', 'Palatino Linotype', 'Times New Roman', serif;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  font-size: var(--checkers-coordinate-size);
  letter-spacing: 0.04em;
  line-height: 1;
  text-shadow: 0 0 8px rgba(190, 130, 255, 0.35);
  user-select: none;
}

.checkers-coordinates-top {
  grid-column: 2;
  grid-row: 1;
  display: grid;
  justify-self: center;
  box-sizing: border-box;
  grid-template-columns: repeat(8, var(--checkers-cell-span));
  width: var(--checkers-board-size);
  margin-inline: 0;
}

.checkers-coordinates-top__slot {
  display: grid;
  box-sizing: border-box;
  width: var(--checkers-cell-span);
  min-width: var(--checkers-cell-span);
  max-width: var(--checkers-cell-span);
  place-items: end center;
  overflow: visible;
  padding-block-end: var(--checkers-coordinate-gap);
}

.checkers-coordinates-bottom {
  grid-column: 2;
  grid-row: 3;
  display: grid;
  justify-self: center;
  box-sizing: border-box;
  grid-template-columns: repeat(8, var(--checkers-cell-span));
  width: var(--checkers-board-size);
  margin-inline: 0;
}

.checkers-coordinates-bottom__slot {
  display: grid;
  box-sizing: border-box;
  width: var(--checkers-cell-span);
  min-width: var(--checkers-cell-span);
  max-width: var(--checkers-cell-span);
  place-items: start center;
  overflow: visible;
  padding-block-start: var(--checkers-coordinate-gap);
}

.checkers-coordinates-left {
  grid-column: 1;
  grid-row: 2;
  display: grid;
  box-sizing: border-box;
  width: 100%;
  height: var(--checkers-board-size);
  justify-self: center;
  justify-items: stretch;
  align-self: center;
  grid-template-rows: repeat(8, var(--checkers-cell-span));
}

.checkers-coordinates-left__slot {
  display: grid;
  width: 100%;
  min-height: var(--checkers-cell-span);
  align-self: stretch;
  padding-inline-end: clamp(1px, 0.35cqmin, 5px);
  place-items: center end;
  overflow: visible;
}

.checkers-coordinates-right {
  grid-column: 3;
  grid-row: 2;
  display: grid;
  box-sizing: border-box;
  width: 100%;
  height: var(--checkers-board-size);
  justify-self: center;
  justify-items: stretch;
  align-self: center;
  grid-template-rows: repeat(8, var(--checkers-cell-span));
}

.checkers-coordinates-right__slot {
  display: grid;
  width: 100%;
  min-height: var(--checkers-cell-span);
  align-self: stretch;
  padding-inline-start: clamp(1px, 0.35cqmin, 5px);
  place-items: center start;
  overflow: visible;
}

.checkers-board-glow-wrap {
  grid-column: 2;
  grid-row: 2;
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  justify-self: stretch;
  align-self: stretch;
  width: 100%;
  height: 100%;
  overflow: visible;
}


.checkers-board-glow-wrap::before {
  position: absolute;
  top: var(--checkers-board-glow-bleed);
  left: var(--checkers-board-glow-bleed);
  z-index: 0;
  width: var(--checkers-board-size);
  height: var(--checkers-board-size);
  border-radius: var(--checkers-board-radius);
  box-shadow: var(--checkers-board-glow-neon);
  transform: translateZ(0);
  pointer-events: none;
  content: '';
}

.checkers-board {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: grid;
  
  overflow: hidden;
  width: var(--checkers-board-size);
  height: var(--checkers-board-size);
  max-width: min(100%, var(--checkers-board-size));
  max-height: min(100%, var(--checkers-board-size));
  border: 1px solid var(--checkers-board-border);
  background-color: rgba(12, 5, 22, 0.72);
  box-shadow:
    var(--checkers-board-inset-physical),
    var(--checkers-board-shadow-drop),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  grid-template-columns: repeat(8, minmax(0, 1fr));
  grid-template-rows: repeat(8, minmax(0, 1fr));
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

/*
 * ≤1200px layout: central column becomes a vertical stack (`height: auto` on shells).
 * `container-type: size` block height then becomes cyclic with content; `100cqh` collapses (~0).
 * Driving `--checkers-board-size` off that corrupts nested grid tracks → tiny board/overlap siblings.
 */
@media (min-width: 1201px) {
  .checkers-board-frame {
    --checkers-frame-padding-inline: clamp(8px, 1.75cqmin, 14px);
    --checkers-board-glow-outer-safe: clamp(6px, 1.2cqmin, 12px);
    --checkers-board-glow-bleed: clamp(9px, 2cqmin, 16px);
    --checkers-coordinate-strip: clamp(1rem, 3.5cqmin, 1.45rem);
    --checkers-board-vertical-fudge: clamp(2px, 0.85cqmin, 8px);
  }
}

@media (max-width: 1200px) {
  .checkers-board-frame {
    height: auto;
    



    --checkers-board-viewport-block-playable-cap: max(
      1px,
      calc(
        min(90vmin, 92vw, 92dvh, 94svh) -
          env(safe-area-inset-bottom, 0px) -
          env(safe-area-inset-top, 0px) -
          2 * var(--checkers-coordinate-strip) -
          2 * var(--checkers-board-glow-bleed) -
          calc(var(--checkers-layout-vertical-inset-top) * 0.28) -
          var(--checkers-board-vertical-fudge)
      )
    );

    --checkers-board-size: max(
      var(--checkers-board-min-side),
      min(var(--checkers-board-inline-cap), var(--checkers-board-viewport-block-playable-cap))
    );
  }
}

</style>
