<script setup lang="ts">
/**
 * GameCallVideoGrid — minimal reusable tile grid for the Game Call Lab.
 *
 * Consumes the orchestrator context from `<GameCallShell>` via inject().
 * Computes a responsive grid via `computeCallVideoGridLayout` (the same
 * pure helper CallPage uses in production — reused unchanged).
 *
 * Renders one `<GameCallTile>` per tile and exposes a `#overlay` slot per
 * tile so a per-game overlay (e.g. `<DemoMafiaTileOverlay>`) can be layered
 * on top without modifying `ParticipantTile`.
 *
 * Mafia-agnostic: knows nothing about life states, seat numbers, or roles.
 * That logic lives in slot content provided by the lab page.
 */

import { computed, inject, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { computeCallVideoGridLayout } from '@/components/call/callVideoGridLayout'
import GameCallTile from './GameCallTile.vue'
import {
  GAME_CALL_SESSION_KEY,
  type GameCallTileLike,
} from './gameCallShellContext'

const props = defineProps<{
  /**
   * Optional ordering function. Receives the current tiles array and returns
   * the tiles in render order. Defaults to alphabetical-by-peerId. Game-
   * specific consumers can pass a host-last or seat-based ordering.
   * The output must contain the same peer ids as the input — the function
   * is for REORDERING only, not filtering.
   */
  orderTiles?: (tiles: readonly GameCallTileLike[]) => readonly GameCallTileLike[]
}>()

const ctx = inject(GAME_CALL_SESSION_KEY)
if (!ctx) {
  throw new Error(
    '<GameCallVideoGrid> must be mounted inside <GameCallShell>; missing GAME_CALL_SESSION_KEY context.',
  )
}

const stageRef = ref<HTMLElement | null>(null)
const stageSize = shallowRef({ width: 0, height: 0 })

let resizeObserver: ResizeObserver | null = null

function syncStageSize(): void {
  const el = stageRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  stageSize.value = {
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height)),
  }
}

onMounted(() => {
  syncStageSize()
  const el = stageRef.value
  if (el && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => syncStageSize())
    resizeObserver.observe(el)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver != null) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

const orderedTiles = computed<readonly GameCallTileLike[]>(() => {
  const list = ctx.tiles.value as readonly GameCallTileLike[]
  if (props.orderTiles) {
    return props.orderTiles(list)
  }
  // Default: alphabetical-by-peerId so the layout is deterministic when no
  // game-specific ordering is provided. Per-game consumers (e.g. Mafia-style
  // host-last) override via the `order-tiles` prop.
  return [...list].sort((a, b) => a.peerId.localeCompare(b.peerId))
})

const gridLayout = computed(() => {
  const n = orderedTiles.value.length
  return computeCallVideoGridLayout(n, stageSize.value.width, stageSize.value.height, {
    gapPx: 8,
    minTileWidthPx: 160,
    contentInsetPx: 16,
  })
})

const gridStyle = computed(() => {
  const { cols, rows, tileWidth, tileHeight } = gridLayout.value
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${Math.max(1, cols)}, ${tileWidth}px)`,
    gridTemplateRows: `repeat(${Math.max(1, rows)}, ${tileHeight}px)`,
    gap: '8px',
    justifyContent: 'center',
    alignContent: 'center',
    width: '100%',
    height: '100%',
  }
})

const sizeTier = computed(() => ctx.sizeTier.value)
</script>

<template>
  <!--
    Reuses production `call-page__stage` / `call-page__grid` classes so the
    template page picks up the same layout rules as production `<CallPage>`.
    Consumers must ensure `CallPage.css` is loaded (e.g. via a side-effect
    import on the page that mounts this grid).
  -->
  <div ref="stageRef" class="call-page__stage">
    <div class="call-page__grid" :style="gridStyle">
      <GameCallTile
        v-for="tile in orderedTiles"
        :key="tile.peerId"
        :tile="tile"
        :size-tier="sizeTier"
      >
        <template #overlay="overlaySlotProps">
          <slot name="tile-overlay" v-bind="overlaySlotProps" />
        </template>
      </GameCallTile>
    </div>
  </div>
</template>
